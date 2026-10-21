// Look up meaning + phonetics for words in this project's dictionaries (public/dicts).
// Prefers entries that have both phonetics. Run from the repo root:
//   node .claude/skills/import-notion-pte/lookup.mjs confidence seminars ...
import { readdirSync, readFileSync } from 'node:fs'

const want = new Set(process.argv.slice(2).map((w) => w.toLowerCase()))
const best = {}
for (const f of readdirSync('public/dicts').filter((f) => f.endsWith('.json'))) {
  let list
  try {
    list = JSON.parse(readFileSync(`public/dicts/${f}`, 'utf8'))
  } catch {
    continue
  }
  if (!Array.isArray(list)) continue
  for (const e of list) {
    const k = String(e?.name ?? '').toLowerCase()
    if (!want.has(k) || !e.trans?.length) continue
    const score = (e.usphone ? 1 : 0) + (e.ukphone ? 1 : 0)
    if (!best[k] || score > best[k].score)
      best[k] = { score, word: e.name, trans: e.trans, usphone: e.usphone, ukphone: e.ukphone, dict: f }
  }
}
for (const w of want) {
  const { score, ...hit } = best[w] ?? { word: w, missing: true }
  console.log(JSON.stringify(hit))
}
