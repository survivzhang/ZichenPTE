/**
 * Call the app's JSON API. Failures are logged and resolve to null rather than
 * throwing, so that a network hiccup never interrupts typing practice.
 */
async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 401) {
      // The session has ended (e.g. signed out in another tab); show the login page.
      window.location.reload()
      return null
    }
    if (!res.ok) {
      console.error(`${method} /api${path} failed: ${res.status}`, await res.text())
      return null
    }
    return (await res.json()) as T
  } catch (error) {
    console.error(`${method} /api${path} failed`, error)
    return null
  }
}

export const getJSON = <T>(path: string) => request<T>('GET', path)
export const postJSON = <T = unknown>(path: string, body: unknown) => request<T>('POST', path, body)
export const putJSON = <T = unknown>(path: string, body: unknown) => request<T>('PUT', path, body)
export const deleteJSON = <T = unknown>(path: string) => request<T>('DELETE', path)
