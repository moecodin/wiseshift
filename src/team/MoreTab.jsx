import { useState } from 'react'
import Avatar from './Avatar.jsx'
import { useFeatures } from './features.js'

const ICONS = {
  off: <><path d="M4 20c1-7 5-11 8-11s7 4 8 11z" /><path d="M12 9V4" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16.5 14.2c3 .2 4.5 2.4 4.5 5.8" /></>,
  reports: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  out: <><path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" /></>,
}
const Icon = ({ name }) => <svg className="mo-icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>
const Chevron = () => <svg className="mo-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>

const WORDS = {
  en: { off: 'Time off', people: 'Team', reports: 'Reports', reportsSub: 'Timesheets and exports. Best on a computer.', notify: 'Notifications', lang: 'Language', settings: 'Settings', out: 'Sign out', waiting: (n) => `${n} waiting`, peopleSub: 'People, pay rates, W-4', peopleOnly: 'People on your team', offSub: 'Ask for days off', signed: 'Signed in as' },
  es: { off: 'Ausencias', people: 'Equipo', reports: 'Informes', reportsSub: 'Hojas de tiempo y exportaciones. Mejor en una computadora.', notify: 'Notificaciones', lang: 'Idioma', settings: 'Ajustes', out: 'Cerrar sesión', waiting: (n) => `${n} esperando`, peopleSub: 'Personas, pagos, W-4', peopleOnly: 'Personas en tu equipo', offSub: 'Pedir días libres', signed: 'Sesión de' },
}

// The More tab: who you are, then Time off, Team (managers), Notifications,
// Language, Settings and Sign out.
export default function MoreTab({ data, me, boss, lang, email, pending, onOpen, onNotify, onSignOut }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const f = useFeatures()
  const [error, setError] = useState('')
  const pick = async (next) => setError((await data.actions.setLang(next)) || '')
  return (
    <div className="tm-narrow mo">
      <h2 className="sc-h desk-title">{lang === 'es' ? 'Más' : 'More'}</h2>
      <section className="mo-card mo-me">
        <Avatar employee={me} size={56} />
        <div>
          <b>{me.name}</b>
          <small>{[me.position, email].filter(Boolean).join(' · ')}</small>
        </div>
      </section>

      <section className="mo-card">
        {f.timeOff && (
        <button type="button" className="mo-item" onClick={() => onOpen('off')}>
          <Icon name="off" />
          <span><b>{w.off}</b><small>{pending > 0 ? w.waiting(pending) : w.offSub}</small></span>
          <Chevron />
        </button>
        )}
        {boss && f.timesheets && (
          <button type="button" className="mo-item mo-phone-only" onClick={() => onOpen('reports')}>
            <Icon name="reports" />
            <span><b>{w.reports}</b><small>{w.reportsSub}</small></span>
            <Chevron />
          </button>
        )}
        {boss && (
          <button type="button" className="mo-item" onClick={() => onOpen('people')}>
            <Icon name="people" />
            <span><b>{w.people}</b><small>{f.payRates ? w.peopleSub : w.peopleOnly}</small></span>
            <Chevron />
          </button>
        )}
        <button type="button" className="mo-item" onClick={onNotify}>
          <Icon name="bell" />
          <span><b>{w.notify}</b></span>
          <Chevron />
        </button>
        <div className="mo-item">
          <Icon name="globe" />
          <span><b>{w.lang}</b></span>
          <span className="mo-seg" role="group" aria-label={w.lang}>
            <button type="button" aria-pressed={lang !== 'es'} onClick={() => pick('en')}>English</button>
            <button type="button" aria-pressed={lang === 'es'} onClick={() => pick('es')}>Español</button>
          </span>
        </div>
      </section>
      {error && <p className="tm-error" role="alert">{error}</p>}

      {onSignOut && (
        <section className="mo-card">
          <button type="button" className="mo-item mo-out" onClick={onSignOut}>
            <Icon name="out" />
            <span><b>{w.out}</b></span>
          </button>
        </section>
      )}
    </div>
  )
}
