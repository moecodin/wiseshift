// Small helpers for the first-run wizards and the Business settings (kept apart from the components).

const SEEN_PREFIX = 'wiseshift-welcome-'
export const welcomeSeen = (id) => {
  try {
    return localStorage.getItem(SEEN_PREFIX + id) === '1'
  } catch {
    return true // if this device can't remember, don't ask every time
  }
}
export const markSeen = (id) => {
  try {
    localStorage.setItem(SEEN_PREFIX + id, '1')
  } catch {
    // Not important if this can't be saved.
  }
}

// A chosen image, shrunk to at most 192px on its longest side and returned as a PNG data URL.
export function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('bad'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 192 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const out = canvas.toDataURL('image/png')
      if (out.length > 100000) reject(new Error('big'))
      else resolve(out)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad'))
    }
    img.src = url
  })
}

// ---------- Store hours ----------
// Stored as { days: [Sun, Mon, … Sat] } where each day is { open, close } in minutes after midnight, or null when closed.
// The first version stored one { open, close, closed: [days] } for the whole week; that still reads as seven days.
export const DAY_SHORT = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] }
export const DAY_LONG = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] }

const validDay = (d) => d && Number.isFinite(d.open) && Number.isFinite(d.close)
export const defaultHours = () => Array.from({ length: 7 }, () => ({ open: 480, close: 1200 }))

// Whatever was saved → seven days, or null when no hours were ever set.
export function normalizeHours(value) {
  if (Array.isArray(value?.days) && value.days.length === 7) return value.days.map((d) => (validDay(d) ? { open: d.open, close: d.close } : null))
  if (Number.isFinite(value?.open) && Number.isFinite(value?.close)) {
    const closed = value.closed ?? []
    return Array.from({ length: 7 }, (_, d) => (closed.includes(d) ? null : { open: value.open, close: value.close }))
  }
  return null
}
export const hoursProblem = (days) => days.some((d) => d && d.close <= d.open)

// Open, Close and All Day quick-pick shifts: from the earliest opening to the latest closing of the open days,
// with the middle hour between them.
export function presetsFromHours(days) {
  const open = days.filter((d) => d && d.close > d.open)
  if (!open.length) return null
  const start = Math.min(...open.map((d) => d.open))
  const end = Math.max(...open.map((d) => d.close))
  const mid = Math.round((start + end) / 2 / 60) * 60
  const middle = mid <= start || mid >= end ? Math.round((start + end) / 2) : mid
  return [
    { title: 'Open', start, end: middle },
    { title: 'Close', start: middle, end },
    { title: 'All Day', start, end },
  ]
}

// One line per run of days with the same hours: "Mon–Fri 8:00 AM to 8:00 PM", "Sun closed".
export function hoursLines(days, clock, names, closedWord = 'closed') {
  const text = (d) => (d ? `${clock(d.open)} to ${clock(d.close)}` : closedWord)
  const lines = []
  let from = 0
  for (let i = 1; i <= 7; i++) {
    if (i < 7 && text(days[i]) === text(days[from])) continue
    lines.push(`${from === i - 1 ? names[from] : `${names[from]}–${names[i - 1]}`} ${text(days[from])}`)
    from = i
  }
  return lines
}

// The hours for one date's weekday (null if closed or not set), for the day view's time range.
export function hoursOnDate(value, dateKey) {
  const days = normalizeHours(value)
  if (!days) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  return days[new Date(y, m - 1, d).getDay()]
}
