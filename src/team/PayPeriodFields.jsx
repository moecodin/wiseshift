import { configFromParts, partsOfConfig, payPeriodFor } from './paycheck.js'
import { DAY_LONG, DAY_SHORT } from './onboardingHelpers.js'
import { fromKey } from '../lib/dates.js'

// The pay period: how long (one week or two), which day it starts, and, for two weeks, which week we are in now.
// value is { days: 7 | 14, anchor }. A preview says it in words: "Friday to Thursday, every 2 weeks".
const WORDS = {
  en: { length: 'How long is a pay period?', one: 'Every week', two: 'Every 2 weeks', first: 'What day does it start?', which: 'Which week of the pay period is this week?', firstWeek: 'The first week', secondWeek: 'The second week', now: 'The current pay period', to: 'to', every: (n) => (n === 7 ? 'every week' : 'every 2 weeks') },
  es: { length: '¿Cuánto dura un período de pago?', one: 'Cada semana', two: 'Cada 2 semanas', first: '¿Qué día empieza?', which: '¿Qué semana del período es esta?', firstWeek: 'La primera semana', secondWeek: 'La segunda semana', now: 'El período actual', to: 'a', every: (n) => (n === 7 ? 'cada semana' : 'cada 2 semanas') },
}

export default function PayPeriodFields({ value, onChange, lang = 'en' }) {
  const l = lang === 'es' ? 'es' : 'en'
  const w = WORDS[l]
  const today = new Date()
  const parts = partsOfConfig(value, today)
  const change = (changes) => onChange(configFromParts({ ...parts, ...changes }, today))
  const period = payPeriodFor(today, value?.anchor ? value : configFromParts(parts, today))
  const fmt = (key) => fromKey(key).toLocaleDateString(l === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' })
  const startName = DAY_LONG[l][parts.weekday]
  const endName = DAY_LONG[l][(parts.weekday + 6) % 7]
  return (
    <div className="pp-fields">
      <span className="form-label d-block" id="pay-len-l">{w.length}</span>
      <div className="tm-seg" role="group" aria-labelledby="pay-len-l">
        <button type="button" aria-pressed={parts.days === 7} onClick={() => change({ days: 7 })}>{w.one}</button>
        <button type="button" aria-pressed={parts.days === 14} onClick={() => change({ days: 14 })}>{w.two}</button>
      </div>
      <span className="form-label d-block mt-3" id="pay-day-l">{w.first}</span>
      <div className="rl-picks" role="group" aria-labelledby="pay-day-l">
        {DAY_SHORT[l].map((n, d) => <button key={n} type="button" className="rl-pick" aria-pressed={parts.weekday === d} onClick={() => change({ weekday: d })}>{n}</button>)}
      </div>
      {parts.days === 14 && (
        <>
          <span className="form-label d-block mt-3" id="pay-wk-l">{w.which}</span>
          <div className="tm-seg" role="group" aria-labelledby="pay-wk-l">
            <button type="button" aria-pressed={!parts.secondWeek} onClick={() => change({ secondWeek: false })}>{w.firstWeek}</button>
            <button type="button" aria-pressed={parts.secondWeek} onClick={() => change({ secondWeek: true })}>{w.secondWeek}</button>
          </div>
        </>
      )}
      <p className="pp-preview mt-3 mb-0"><b>{startName} {w.to} {endName}</b>, {w.every(parts.days)}. {w.now}: {fmt(period[0])} – {fmt(period.at(-1))}.</p>
    </div>
  )
}
