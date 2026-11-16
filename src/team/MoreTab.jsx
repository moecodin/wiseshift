import { TABS_ES } from './themes/index.js'
import { MORE } from './more.js'

// The More tab: Time off, and (managers) Team.
export default function MoreTab({ boss, look, lang, pending, onOpen }) {
  const es = lang === 'es'
  const names = es ? TABS_ES : look.tabs
  return (
    <div className="tm-more">
      {MORE.filter((m) => !m.managersOnly || boss).map((m) => (
        <button key={m.id} type="button" className="tm-card tm-more-item" onClick={() => onOpen(m.id)}>
          <span className="tm-more-icon" aria-hidden="true">{m.icon}</span>
          <span className="tm-more-text">
            <b>
              {names[m.id]}
              {m.id === 'off' && pending > 0 && <span className="tm-badge">{pending}</span>}
            </b>
            <small>
              {es ? m.es : m.en}
              {m.id === 'off' && pending > 0 && (es ? ` · ${pending} esperando` : ` · ${pending} waiting`)}
            </small>
          </span>
          <span className="tm-more-go" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  )
}
