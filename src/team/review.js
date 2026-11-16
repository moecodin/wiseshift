// Review (Clock tab, managers): each punch's status and what's worth a second look.
import { dateKey } from '../lib/dates.js'
import { describeSpot } from './location.js'
import { punchMinutes } from './paycheck.js'
import { clockTime } from './format.js'

const LATE_MINUTES = 15 // early or late by more than this gets a warning
const LONG_HOURS = 12

export function punchStatus(p) {
  if (!p.clockOut) return 'progress'
  return p.approvedAt ? 'approved' : 'pending'
}
export const STATUS_LABEL = { progress: 'In progress', pending: 'Pending', approved: 'Approved' }

const minutesOfDay = (iso) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

// The shift a punch belongs to: that person's shift that day closest to when they clocked in.
export function shiftFor(p, shifts) {
  const date = dateKey(new Date(p.clockIn))
  const start = minutesOfDay(p.clockIn)
  return shifts
    .filter((s) => s.employeeId === p.employeeId && s.date === date)
    .sort((a, b) => Math.abs(a.start - start) - Math.abs(b.start - start))[0] ?? null
}

// Everything worth a second look, as short sentences ("Clocked in 2.3 mi away").
export function punchWarnings(p, shifts, shop, now = new Date()) {
  const out = []
  const sameDay = dateKey(new Date(p.clockIn)) === dateKey(now)
  if (!p.clockOut && !sameDay) out.push('Never clocked out')
  if (punchMinutes(p, now) > LONG_HOURS * 60) out.push(`Over ${LONG_HOURS} hours`)

  const shift = shiftFor(p, shifts)
  if (!shift) out.push('No shift scheduled that day')
  else {
    const late = minutesOfDay(p.clockIn) - shift.start
    if (late > LATE_MINUTES) out.push(`Clocked in ${late} min late (shift ${clockTime(shift.start)})`)
    if (late < -LATE_MINUTES) out.push(`Clocked in ${-late} min early (shift ${clockTime(shift.start)})`)
    if (p.clockOut && dateKey(new Date(p.clockOut)) === shift.date) {
      const over = minutesOfDay(p.clockOut) - shift.end
      if (over > LATE_MINUTES) out.push(`Clocked out ${over} min after the shift ended`)
      if (over < -LATE_MINUTES) out.push(`Left ${-over} min early (shift ended ${clockTime(shift.end)})`)
    }
  }

  // Where: a time a manager typed in has no location, so it isn't "missing".
  const place = (spot, what) => {
    if (!spot) {
      if (!p.editedBy) out.push(`No location at ${what}`)
      return
    }
    const where = describeSpot(spot, shop)
    if (where.far) out.push(`Clocked ${what === 'clock-in' ? 'in' : 'out'} ${where.label}`)
  }
  place(p.inSpot, 'clock-in')
  if (p.clockOut) place(p.outSpot, 'clock-out')
  return out
}
