import Modal from '../components/Modal.jsx'
import { fromKey } from '../lib/dates.js'
import { useNow } from './format.js'
import { formatHours, payPeriodOf, periodHours } from './paycheck.js'
import { rangeName } from './words.js'

// The "Worked this pay period" tile on the phone Today screen opens this pop-up: every day
// you clocked in this pay period and the hours for it, newest first, with the total on top.
const WORDS = {
  en: { title: 'Worked this pay period', hrs: 'hrs', total: 'Total', overtime: 'Overtime', still: 'still in', empty: 'No punches yet this pay period.' },
  es: { title: 'Trabajado este período', hrs: 'hrs', total: 'Total', overtime: 'Horas extra', still: 'sigue adentro', empty: 'Aún no hay registros en este período.' },
}
const locale = (lang) => (lang === 'es' ? 'es-US' : 'en-US')

export default function WorkedPeriod({ data, me, lang, onClose }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const now = useNow(60000)
  const period = payPeriodOf(now)
  const hours = periodHours(data.punches, me.id, period, now)
  const days = hours.byDay.filter((d) => d.punches.length > 0).reverse()

  return (
    <Modal title={w.title} onClose={onClose}>
      <p className="yd-date">{rangeName(period, lang)}</p>
      <section className="yd-block">
        <small className="yd-label">{w.total}</small>
        <b className="yd-big">{formatHours(hours.total)} {w.hrs}</b>
        {hours.overtime > 0 && <span className="yd-sub">{w.overtime} {formatHours(hours.overtime)} {w.hrs}</span>}
      </section>
      {days.length === 0 ? (
        <p className="yd-empty"><b>{w.empty}</b></p>
      ) : (
        <ul className="cu-list">
          {days.map((d) => (
            <li key={d.date} className="wp-row">
              <span>{fromKey(d.date).toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="wp-dash" aria-hidden="true">–</span>
              <b>{formatHours(d.minutes)} {w.hrs}{d.punches.some((p) => !p.clockOut) && <em>{w.still}</em>}</b>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
