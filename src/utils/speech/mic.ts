// Microphone capture owned by the app, not by the Speech SDK. The SDK's own
// microphone input creates an AudioContext outside of any user gesture and
// waits on `resume()`, which Safari never resolves; recognition then hangs.
// Here one AudioContext is created when practice starts, resumed again on any
// key or click while suspended, and 16 kHz PCM is pushed to the SDK by hand.

export const TARGET_SAMPLE_RATE = 16000

// iPhone and iPad (Chrome there is WebKit too). iPadOS reports itself as a Mac with touch.
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

let preparedContext: AudioContext | null = null

function createContext() {
  // iOS records at the hardware rate; a 16 kHz context fed by the microphone can come out
  // silent there, so it keeps the native rate and toPcm16 resamples.
  if (isIOS) return new AudioContext()
  // Ask for 16 kHz so the browser resamples; fall back to resampling here.
  try {
    return new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
  } catch {
    return new AudioContext()
  }
}

/**
 * Call inside a tap or key handler, before asking for the microphone. iOS only lets audio
 * start during a user gesture, and the microphone prompt resolves after the gesture is over.
 */
export function prepareAudioContext() {
  if (preparedContext && preparedContext.state !== 'closed') return
  preparedContext = createContext()
  preparedContext.resume().catch(() => undefined)
}

type Listener = (pcm: ArrayBuffer) => void

// iOS Safari counts touchend / click as gestures that may start audio, not pointerdown.
const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'touchend', 'click'] as const

export class MicCapture {
  readonly stream: MediaStream
  readonly context: AudioContext
  /** Input level 0-1 of the latest audio block. */
  level = 0
  private readonly listeners = new Set<Listener>()
  private readonly source: MediaStreamAudioSourceNode
  private readonly processor: ScriptProcessorNode
  private readonly sink: GainNode
  private readonly unlock: () => void

  constructor(stream: MediaStream) {
    this.stream = stream
    const context = preparedContext && preparedContext.state !== 'closed' ? preparedContext : createContext()
    preparedContext = null
    this.context = context
    this.source = context.createMediaStreamSource(stream)
    this.processor = context.createScriptProcessor(4096, 1, 1)
    // A silent sink: Chrome only runs the processor when it is connected to the destination.
    this.sink = context.createGain()
    this.sink.gain.value = 0
    this.processor.onaudioprocess = (event) => this.onAudio(event.inputBuffer.getChannelData(0))
    this.source.connect(this.processor)
    this.processor.connect(this.sink)
    this.sink.connect(context.destination)

    // iOS also has an "interrupted" state (a call, switching apps) that needs a tap to leave.
    this.unlock = () => {
      if (this.context.state !== 'running' && this.context.state !== 'closed') this.context.resume().catch(() => undefined)
    }
    UNLOCK_EVENTS.forEach((type) => document.addEventListener(type, this.unlock))
    this.unlock()
  }

  get isRunning() {
    return this.context.state === 'running'
  }

  resume() {
    this.unlock()
  }

  /** Receive 16-bit mono PCM at 16 kHz while subscribed. */
  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private onAudio(input: Float32Array) {
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    this.level = Math.min(1, Math.sqrt(sum / input.length) * 6)
    if (this.listeners.size === 0) return
    const pcm = toPcm16(input, this.context.sampleRate)
    this.listeners.forEach((listener) => listener(pcm))
  }

  close() {
    UNLOCK_EVENTS.forEach((type) => document.removeEventListener(type, this.unlock))
    this.processor.onaudioprocess = null
    this.source.disconnect()
    this.processor.disconnect()
    this.sink.disconnect()
    this.context.close().catch(() => undefined)
    this.stream.getTracks().forEach((track) => track.stop())
  }
}

/** Float samples at `sampleRate` -> little-endian 16-bit PCM at 16 kHz. */
function toPcm16(input: Float32Array, sampleRate: number): ArrayBuffer {
  let samples = input
  if (sampleRate !== TARGET_SAMPLE_RATE) {
    const ratio = sampleRate / TARGET_SAMPLE_RATE
    const length = Math.floor(input.length / ratio)
    samples = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      const position = i * ratio
      const index = Math.floor(position)
      const next = Math.min(index + 1, input.length - 1)
      const fraction = position - index
      samples[i] = input[index] * (1 - fraction) + input[next] * fraction
    }
  }
  const out = new DataView(new ArrayBuffer(samples.length * 2))
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return out.buffer
}
