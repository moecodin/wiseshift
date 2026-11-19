import { fromTimeInput, toTimeInput } from './format.js'
import { DAY_LONG } from './onboardingHelpers.js'

// When the business is open, one row per day from Sunday to Saturday: an Open box, an opening time and a closing time.
// A closed day has no times. value is seven days: { open, close } in minutes after midnight, or null for closed.
// Used by the setup wizard and by Settings → Business.
const WORDS = {
  en: { open: 'Open', closed: 'Closed', to: 'to', same: 'Use the same hours every day', opens: 'Opens', closes: 'Closes', bad: 'Closing has to be after opening.' },
  es: { open: 'Abierto', closed: 'Cerrado', to: 'a', same: 'Usar el mismo horario todos los días', opens: 'Abre', closes: 'Cierra', bad: 'La hora de cierre debe ser después de la apertura.' },
}

export default function StoreHoursFields({ value, onChange, lang = 'en' }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const names = DAY_LONG[lang === 'es' ? 'es' : 'en']
  const change = (day, next) => onChange(value.map((d, i) => (i === day ? next : d)))
  // "Same every day" gives all seven days the first open day's hours.
  const first = value.find(Boolean) ?? { open: 480, close: 1200 }
  return (
    <div className="sh-fields">
      {value.map((d, i) => {
        const bad = d && d.close <= d.open
        return (
          <div key={names[i]} className={`sh-row ${d ? '' : 'closed'}`}>
            <label className="sh-day">
              <input className="form-check-input" type="checkbox" checked={Boolean(d)} onChange={(e) => change(i, e.target.checked ? { open: first.open, close: first.close } : null)} />
              <span>{names[i]}</span>
            </label>
            {d ? (
              <span className="sh-times">
                <input type="time" step="900" className="form-control form-control-sm" aria-label={`${names[i]} ${w.opens}`} value={toTimeInput(d.open)} onChange={(e) => { const m = fromTimeInput(e.target.value); if (m !== null) change(i, { ...d, open: m }) }} />
                <span aria-hidden="true">{w.to}</span>
                <input type="time" step="900" className="form-control form-control-sm" aria-label={`${names[i]} ${w.closes}`} value={toTimeInput(d.close)} onChange={(e) => { const m = fromTimeInput(e.target.value); if (m !== null) change(i, { ...d, close: m }) }} />
              </span>
            ) : (
              <span className="sh-closed">{w.closed}</span>
            )}
            {bad && <span className="tm-error sh-bad" role="alert">{w.bad}</span>}
          </div>
        )
      })}
      <button type="button" className="tm-link small mt-2" onClick={() => onChange(value.map(() => ({ open: first.open, close: first.close })))}>{w.same}</button>
    </div>
  )
}
