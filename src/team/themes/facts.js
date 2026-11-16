// What the themed clock screens need, worked out once from the team data.
import { dateKey, fromKey } from '../../lib/dates.js'
import { punchMinutes, scheduleWeekOf } from '../paycheck.js'
import { describeSpot } from '../location.js'

// Everything the clock screens need, worked out once.
export function clockFacts({ data, me, now, open }) {
  const today = dateKey(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const mine = data.shifts.filter((s) => s.employeeId === me.id).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  const todayShift = mine.find((s) => s.date === today && s.end > nowMin) ?? mine.find((s) => s.date === today) ?? null
  const nextShift = mine.find((s) => s.date > today || (s.date === today && s.start > nowMin)) ?? null
  const openMinutes = open ? punchMinutes(open, now) : 0
  const rate = me.payType === 'hourly' ? data.payById[me.id]?.hourlyRate ?? 0 : 0
  // How far through today's shift (0 to 1); without a shift, out of 8 hours.
  const span = todayShift ? todayShift.end - todayShift.start : 480
  const progress = open ? Math.min(1, Math.max(0, openMinutes / span)) : 0
  // This week's shifts as hearts: worked, on now, or still to come.
  const week = scheduleWeekOf(now)
  const worked = new Set(data.punches.filter((p) => p.employeeId === me.id && p.clockOut).map((p) => dateKey(new Date(p.clockIn))))
  const hearts = mine
    .filter((s) => week.includes(s.date))
    .map((s) => (open && s.date === today ? 'half' : s.date < today || (s.date === today && worked.has(today) && !open) ? 'full' : 'empty'))
  // Clock in shows from a set time before a shift (⚙️ → Business, 30 minutes to
  // start) until it ends.
  const early = data.settings?.clockInEarly ?? 30
  const windowShift = mine.find((s) => s.date === today && nowMin >= s.start - early && nowMin < s.end) ?? null
  return {
    today, nowMin, todayShift, nextShift, windowShift, early, openMinutes, rate, progress, hearts,
    earned: (openMinutes / 60) * rate,
    spot: open ? describeSpot(open.inSpot, data.shop) : null,
    span,
  }
}


// Time on the clock as "3:42:18".
export function stopwatch(open, now) {
  const secs = Math.max(0, Math.floor((now - new Date(open.clockIn)) / 1000))
  const pad = (n) => String(n).padStart(2, '0')
  return `${Math.floor(secs / 3600)}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`
}


// Pocket Trainer level: pay periods worked since the start date (at least 1).
export function trainerLevel(me, now) {
  if (!me.startedOn) return 1
  return Math.max(1, Math.floor((now - fromKey(me.startedOn)) / (14 * 86400000)) + 1)
}
