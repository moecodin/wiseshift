import { useState } from 'react'
import { dateKey, fromKey } from '../lib/dates.js'
import { scheduleOnly, useNow } from './format.js'
import { formatHours, punchMinutes, scheduleWeekOf, shiftMinutes } from './paycheck.js'

// Desktop manager Today: this schedule week as seven days of bars. Each day has a muted bar for
// the hours on the published schedule and a gold bar for the hours actually worked (punches),
// with today emphasised, so a short day or a quiet day stands out at a glance. It starts closed:
// tap the heading to open it. Hidden on phones.
const WORDS = {
  en: { title: 'Hours this week', scheduled: 'Scheduled', worked: 'Worked', today: 'Today', hrs: 'hrs' },
  es: { title: 'Horas esta semana', scheduled: 'Programadas', worked: 'Trabajadas', today: 'Hoy', hrs: 'hrs' },
}
const HEIGHT = 120

export default function WeekHoursChart({ data, lang }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const [open, setOpen] = useState(false)
  const now = useNow(60000)
  const today = dateKey(now)
  const week = scheduleWeekOf(now)
  const staff = new Set(data.employees.filter((e) => !scheduleOnly(e)).map((e) => e.id))
  const days = week.map((d) => ({
    d,
    scheduled: data.shifts.filter((s) => s.date === d && s.published).reduce((sum, s) => sum + shiftMinutes(s), 0),
    worked: data.punches.filter((p) => dateKey(new Date(p.clockIn)) === d && staff.has(p.employeeId)).reduce((sum, p) => sum + punchMinutes(p, now), 0),
  }))
  const max = Math.max(60, ...days.flatMap((x) => [x.scheduled, x.worked]))
  const px = (minutes) => Math.max(minutes > 0 ? 3 : 0, Math.round((minutes / max) * HEIGHT))
  const totalWorked = days.reduce((sum, x) => sum + x.worked, 0)
  const totalScheduled = days.reduce((sum, x) => sum + x.scheduled, 0)

  return (
    <section className={`mt-card wh-card ${open ? 'open' : ''}`} aria-label={w.title}>
      <button type="button" className="wh-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg className="wh-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        <b>{w.title}</b>
        <span className="wh-legend"><i className="sch" />{w.scheduled} {formatHours(totalScheduled)}<i className="wrk" />{w.worked} {formatHours(totalWorked)}</span>
      </button>
      {open && (
      <div className="wh-bars" style={{ height: HEIGHT + 22 }}>
        {days.map(({ d, scheduled, worked }) => (
          <div key={d} className={`wh-day ${d === today ? 'today' : ''}`} title={`${formatHours(worked)} ${w.hrs} worked · ${formatHours(scheduled)} ${w.hrs} scheduled`}>
            <span className="wh-pair" style={{ height: HEIGHT }}>
              <span className="wh-bar sch" style={{ height: px(scheduled) }} />
              <span className="wh-bar wrk" style={{ height: px(worked) }} />
            </span>
            <small>{d === today ? w.today : fromKey(d).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short' })}</small>
            <em>{worked > 0 ? formatHours(worked) : scheduled > 0 ? formatHours(scheduled) : ''}</em>
          </div>
        ))}
      </div>
      )}
    </section>
  )
}
