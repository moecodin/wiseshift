// Date and time helpers for WiseShift.
// Dates are stored as "YYYY-MM-DD" strings (called "date keys") and times as
// minutes after midnight (540 = 9:00), which keeps sorting and comparing simple.

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Hourly rows printed on every day, like the paper sheet.
export const SLOT_TIMES = [540, 600, 660, 720] // 9:00, 10:00, 11:00, 12:00

// Times the front desk can pick: 9:00 to 1:00 in 15-minute steps
// (a la carte services can take as little as 15 minutes).
export const TIME_OPTIONS = []
for (let t = 540; t <= 780; t += 15) TIME_OPTIONS.push(t)

export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function dateKey(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}


export const formatShort = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`
export const formatLong = (d) => `${DAY_NAMES[d.getDay()]}, ${formatShort(d)}`
export const formatDayKey = (key) => {
  const d = fromKey(key)
  return `${DAY_NAMES[d.getDay()].slice(0, 3)}, ${formatShort(d)}`
}

// Clock time of a saved timestamp, e.g. "9:14 AM".
export function formatClock(iso) {
  const d = new Date(iso)
  const h = d.getHours()
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function formatTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}`
}
