// Shift types get a soft color (Open, Close, All day, then others by name).
const NAMED = { open: 0, close: 1, 'all day': 2 }
export function tagClass(title, presets = []) {
  const t = (title || '').trim().toLowerCase()
  const chosen = presets.find((p) => (p.title || '').trim().toLowerCase() === t)?.color
  if (Number.isInteger(chosen)) return `sc-tag t${chosen}`
  if (t in NAMED) return `sc-tag t${NAMED[t]}`
  const hash = [...t].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return `sc-tag t${3 + (hash % 5)}`
}

