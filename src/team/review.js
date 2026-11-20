// Review (Clock tab, managers): each punch's status and what's worth a second look.
import { dateKey } from '../lib/dates.js'
import { describeSpot } from './location.js'
import { punchMinutes } from './paycheck.js'
import { clockTime } from './format.js'
import { tr } from './i18n.js'

const LATE_MINUTES = 15 // early or late by more than this gets a warning
const LONG_HOURS = 12

export function punchStatus(p) {
  if (!p.clockOut) return 'progress'
  return p.approvedAt ? 'approved' : 'pending'
}
export const STATUS_LABEL = {
  get progress() { return tr('In progress', 'En curso') },
  get pending() { return tr('Pending', 'Pendiente') },
  get approved() { return tr('Approved', 'Aprobado') },
}

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

// Only lateness gets the ⚠️: clocking in late, or clocking out after the shift ended.
// The other reasons (away from the shop, early, no shift…) still show as plain text.
export const isLateWarning = (w) => ((w.startsWith('Clocked in ') && w.includes(' min late')) || w.includes('after the shift ended')) || ((w.startsWith('Marcó entrada ') && w.includes(' min tarde')) || w.includes('después de que terminó el turno'))

// Everything worth a second look, as short sentences ("Clocked in 2.3 mi away").
export function punchWarnings(p, shifts, shop, now = new Date()) {
  const out = []
  const sameDay = dateKey(new Date(p.clockIn)) === dateKey(now)
  if (!p.clockOut && !sameDay) out.push(tr('Never clocked out', 'Nunca marcó salida'))
  if (punchMinutes(p, now) > LONG_HOURS * 60) out.push(`Over ${LONG_HOURS} hours`)

  const shift = shiftFor(p, shifts)
  if (!shift) out.push(tr('No shift scheduled that day', 'Sin turno programado ese día'))
  else {
    const late = minutesOfDay(p.clockIn) - shift.start
    if (late > LATE_MINUTES) out.push(tr(`Clocked in ${late} min late (shift ${clockTime(shift.start)})`, `Marcó entrada ${late} min tarde (turno ${clockTime(shift.start)})`))
    if (late < -LATE_MINUTES) out.push(tr(`Clocked in ${-late} min early (shift ${clockTime(shift.start)})`, `Marcó entrada ${-late} min antes (turno ${clockTime(shift.start)})`))
    if (p.clockOut && dateKey(new Date(p.clockOut)) === shift.date) {
      const over = minutesOfDay(p.clockOut) - shift.end
      if (over > LATE_MINUTES) out.push(tr(`Clocked out ${over} min after the shift ended`, `Marcó salida ${over} min después de que terminó el turno`))
      if (over < -LATE_MINUTES) out.push(tr(`Left ${-over} min early (shift ended ${clockTime(shift.end)})`, `Salió ${-over} min antes (el turno terminó ${clockTime(shift.end)})`))
    }
  }

  // Where: a time a manager typed in has no location, so it isn't "missing".
  const place = (spot, what, kiosk) => {
    if (!spot) {
      if (!p.editedBy && !kiosk) out.push(what === 'clock-in' ? tr('No location at clock-in', 'Sin ubicación al marcar entrada') : tr('No location at clock-out', 'Sin ubicación al marcar salida'))
      return
    }
    const where = describeSpot(spot, shop)
    if (where.far) out.push(what === 'clock-in' ? tr(`Clocked in ${where.label}`, `Marcó entrada ${where.label}`) : tr(`Clocked out ${where.label}`, `Marcó salida ${where.label}`))
  }
  place(p.inSpot, 'clock-in', p.inKiosk)
  if (p.clockOut) place(p.outSpot, 'clock-out', p.outKiosk)
  return out
}
