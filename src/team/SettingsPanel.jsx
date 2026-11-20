import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { supabase, usingSupabase } from '../lib/supabase.js'
import { dateKey } from '../lib/dates.js'
import { clockTime, dayLabel, fromTimeInput, scheduleOnly, toTimeInput } from './format.js'
import { NotifyOptions } from './NotifySettings.jsx'
import ShopLocation from './ShopLocation.jsx'
import { noticeAcked } from './settings.js'
import KioskSettings from './KioskSettings.jsx'
import { FEATURES, PRESETS, featuresOf, presetFeatures, useFeatures } from './features.js'
import { dayName, say } from './words.js'
import Icon from './Icon.jsx'
import { defaultHours, hoursProblem, normalizeHours, presetsFromHours, shrinkImage } from './onboardingHelpers.js'
import StoreHoursFields from './StoreHours.jsx'

// ⚙️ Settings. "Me" is for everyone: theme, notifications, contact details,
// the location notice and password. "Business" is for managers: the shop and
// how the app works for the whole team.
export default function SettingsPanel({ data, me, boss, onToggleTheme, onSignOut, start = 'me', onClose, asPage = false }) {
  const [page, setPage] = useState(boss ? start : 'me')
  const content = (
    <>
      {boss && (
        <div className="tm-switch">
          <div className="tm-seg" role="group" aria-label="Settings page">
            <button type="button" aria-pressed={page === 'me'} onClick={() => setPage('me')}>Me</button>
            <button type="button" aria-pressed={page === 'business'} onClick={() => setPage('business')}>Business</button>
          </div>
        </div>
      )}
      {page === 'me' ? (
        <MySettings data={data} me={me} boss={boss} onToggleTheme={onToggleTheme} onSignOut={onSignOut} />
      ) : (
        <BusinessSettings data={data} onClose={onClose} />
      )}
    </>
  )
  // As a page it fills the content area like the other tabs; as a pop-up it is the Modal.
  if (asPage) return <div className="tm-narrow desk st-page"><h2 className="sc-h">Settings</h2>{content}</div>
  return <Modal title="Settings" size={page === 'business' ? 'lg' : undefined} onClose={onClose}>{content}</Modal>
}

// Shown under each Save button.
function Result({ result }) {
  if (!result) return null
  if (result.ok) return <p className="tm-msg small mt-2 mb-0" role="status">{result.ok}</p>
  return <p className="tm-error small mt-2 mb-0" role="alert">{result.error}</p>
}
// A problem from saving, in plain words. Before update 018 the new columns and
// functions don't exist yet.
const explain = (problem) =>
  /schema cache|does not exist|could not find|employee_private|set_my_contact|ack_location_notice|clock_in_early|notice_/i.test(problem)
    ? 'Run supabase/updates/018-settings.sql in Supabase first.'
    : problem
const outcome = (problem, ok = 'Saved.') => (problem ? { error: explain(problem) } : { ok })

function MySettings({ data, me, boss, onToggleTheme, onSignOut }) {
  const f = useFeatures()
  return (
    <>
      <section className="st-section">
        <h3 className="tm-h3">{data.lang === 'es' ? 'Apariencia' : 'Appearance'}</h3>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onToggleTheme}>
          {data.lang === 'es' ? 'Cambiar claro / oscuro' : 'Switch light / dark'}
        </button>
      </section>
      <Language data={data} />
      <section className="st-section">
        <h3 className="tm-h3">Notifications</h3>
        <NotifyOptions data={data} boss={boss} />
      </section>
      <MyContact data={data} me={me} />
      {f.location && (
        <section className="st-section">
          <h3 className="tm-h3">Location notice</h3>
          <LocationNotice data={data} me={me} />
        </section>
      )}
      <Account onSignOut={onSignOut} />
      <section className="st-section">
        <h3 className="tm-h3">Help</h3>
        <ul className="small mb-0 st-help">
          <li>Add the app to your home screen: iPhone Safari → Share → <b>Add to Home Screen</b>; Android Chrome → ⋮ → <b>Install app</b>.</li>
          <li>Clock in asks for your location. If it says it isn't allowed, turn on Location for the browser or RI Sched in your phone's settings.</li>
          <li>Something wrong with your hours or a shift? Tell a manager; managers can fix any punch.</li>
        </ul>
      </section>
    </>
  )
}

// English or Spanish (update 021). For now it changes the tabs, the Tasks tab
// and task notifications; the rest of the page is still in English.
function Language({ data }) {
  const [result, setResult] = useState(null)
  const pick = async (lang) => {
    const problem = await data.actions.setLang(lang)
    setResult(problem ? { error: problem } : null)
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Language · Idioma</h3>
      <div className="tm-seg st-lang" role="group" aria-label="Language">
        <button type="button" aria-pressed={data.lang !== 'es'} onClick={() => pick('en')}>English</button>
        <button type="button" aria-pressed={data.lang === 'es'} onClick={() => pick('es')}>Español</button>
      </div>
      <p className="tm-muted small mt-2 mb-0">
        {data.lang === 'es' ? 'Las pestañas y las pantallas salen en español.' : 'Changes the tabs and screens to Spanish.'}
      </p>
      <Result result={result} />
    </section>
  )
}

function MyContact({ data, me }) {
  const saved = data.privateById[me.id] ?? {}
  const [form, setForm] = useState({ phone: saved.phone ?? '', emergencyName: saved.emergencyName ?? '', emergencyPhone: saved.emergencyPhone ?? '' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const save = async () => {
    setBusy(true)
    const problem = await data.actions.setMyContact({ phone: form.phone.trim(), emergencyName: form.emergencyName.trim(), emergencyPhone: form.emergencyPhone.trim() })
    setBusy(false)
    setResult(outcome(problem))
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">My phone & emergency contact</h3>
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-phone">My phone</label>
          <input id="st-phone" type="tel" autoComplete="tel" className="form-control" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="col-sm-6" />
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-ename">Emergency contact name</label>
          <input id="st-ename" className="form-control" placeholder="Name (and who they are)…" value={form.emergencyName} onChange={set('emergencyName')} />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-ephone">Their phone</label>
          <input id="st-ephone" type="tel" className="form-control" value={form.emergencyPhone} onChange={set('emergencyPhone')} />
        </div>
      </div>
      <div className="d-flex align-items-center gap-2 mt-2">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={save}>Save</button>
        <small className="tm-muted">Only you and managers can see these.</small>
      </div>
      <Result result={result} />
    </section>
  )
}

// The notice, with "I've read this". Also shown on the Clock tab until read.
export function LocationNotice({ data, me }) {
  const priv = data.privateById[me.id]
  const acked = noticeAcked(priv, data.settings)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const ack = async () => {
    setBusy(true)
    const problem = await data.actions.ackNotice()
    setBusy(false)
    setResult(problem ? outcome(problem) : null)
  }
  return (
    <>
      <div className="st-notice">{data.settings.noticeText}</div>
      {acked ? (
        <p className="small mt-2 mb-0">✓ {say(data.lang).readOn} <b>{dayName(dateKey(new Date(priv.noticeAckAt)), data.lang)}</b>.</p>
      ) : (
        <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={ack}>{say(data.lang).readIt}</button>
      )}
      <Result result={result} />
    </>
  )
}

function Account({ onSignOut }) {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  if (!usingSupabase) {
    return (
      <section className="st-section">
        <h3 className="tm-h3">Password</h3>
        <p className="tm-muted small mb-0">Change your password and sign out everywhere work on the live site, not in sample mode.</p>
      </section>
    )
  }
  const change = async () => {
    if (password.length < 8) return setResult({ error: 'Use at least 8 characters.' })
    if (password !== again) return setResult({ error: "The two passwords don't match." })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setResult({ error: error.message })
    setPassword('')
    setAgain('')
    setResult({ ok: 'Password changed. Use the new one next time you sign in.' })
  }
  // Signs this login out on every phone and computer, e.g. after losing a phone.
  const everywhere = async () => {
    if (!window.confirm('Sign out on every phone and computer, including this one?')) return
    await supabase.auth.signOut({ scope: 'global' })
    onSignOut?.()
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Password</h3>
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-pw">New password</label>
          <input id="st-pw" type="password" autoComplete="new-password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-pw2">Type it again</label>
          <input id="st-pw2" type="password" autoComplete="new-password" className="form-control" value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy || !password} onClick={change}>Change password</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={everywhere}>Sign out everywhere</button>
      </div>
      <Result result={result} />
    </section>
  )
}

// ---------- Business (managers) ----------

function BusinessSettings({ data, onClose }) {
  const f = useFeatures()
  return (
    <>
      {!data.settingsReady && (
        <p className="tm-warn">These use update 018. Run <code>supabase/updates/018-settings.sql</code> in Supabase, then reload, before saving here.</p>
      )}
      <BusinessProfile data={data} onClose={onClose} />
      <StoreHoursSettings data={data} />
      <Features data={data} />
      {f.location && <ShopLocation data={data} />}
      {f.timeClock && <ClockInRules data={data} />}
      {f.timeClock && f.kioskClock && <KioskSettings />}
      <ShiftPicks data={data} />
      {f.roles && <Roles data={data} />}
      <Groups data={data} />
      <Positions data={data} />
      <Reminders data={data} />
      {f.location && <NoticeEditor data={data} />}
    </>
  )
}

// The business's name and logo (they replace "WiseShift" in the header, menu and kiosk), and the setup wizard again.
function BusinessProfile({ data, onClose }) {
  const s = data.settings
  const [name, setName] = useState(s.businessName)
  const [logo, setLogo] = useState(s.businessLogo)
  const [error, setError] = useState('')
  const { busy, result, save } = useSave(data)
  const choose = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      setLogo(await shrinkImage(file))
    } catch (err) {
      setError(err.message === 'big' ? 'That image is too large. Try a smaller one.' : "That file isn't an image.")
    }
  }
  const again = async () => {
    await data.actions.saveSettings({ setupDone: false })
    onClose?.()
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Business name and logo</h3>
      <p className="tm-muted small mb-2">Shown in the menu, the header and on the kiosk.</p>
      <label className="form-label" htmlFor="bp-name">Business name</label>
      <input id="bp-name" className="form-control" value={name} maxLength={60} placeholder="WiseShift" onChange={(e) => setName(e.target.value)} />
      <div className="ob-logo mt-3">
        <span className="ob-logo-box">{logo ? <img src={logo} alt="" /> : <b>{(name.trim()[0] ?? 'W').toUpperCase()}</b>}</span>
        <label className="btn btn-outline-secondary btn-sm mb-0">
          {logo ? 'Change image' : 'Choose image'}
          <input type="file" accept="image/*" hidden onChange={choose} />
        </label>
        {logo && <button type="button" className="tm-link small" onClick={() => setLogo('')}>Remove</button>}
      </div>
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
      <div className="d-flex align-items-center gap-3 mt-3">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={() => save({ businessName: name.trim(), businessLogo: logo })}>Save</button>
        <button type="button" className="tm-link small" onClick={again}>Run the setup wizard again</button>
      </div>
      <Result result={result} />
    </section>
  )
}

// When the business is open. The day view's time range follows it; the quick-pick shifts can follow it too.
function StoreHoursSettings({ data }) {
  const [hours, setHours] = useState(() => normalizeHours(data.settings.storeHours) ?? defaultHours()) // seven days, Sunday first
  const [picks, setPicks] = useState(false)
  const { busy, result, save } = useSave(data)
  const bad = hoursProblem(hours)
  const submit = () => {
    const presets = picks ? presetsFromHours(hours) : null
    save({ storeHours: { days: hours }, ...(presets ? { shiftPresets: presets } : {}) }, 'Saved.')
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Store hours</h3>
      <p className="tm-muted small mb-2">Each day can have its own hours, or be closed. The day view on the schedule starts and ends with that day's opening and closing time.</p>
      <StoreHoursFields value={hours} onChange={setHours} lang={data.lang} />
      <div className="form-check mt-3">
        <input id="sh-picks" className="form-check-input" type="checkbox" checked={picks} onChange={(e) => setPicks(e.target.checked)} />
        <label className="form-check-label" htmlFor="sh-picks">Also set the Open, Close and All Day quick picks from these hours</label>
      </div>
      <button type="button" className="btn btn-brand btn-sm mt-3" disabled={busy || bad} onClick={submit}>Save</button>
      <Result result={result} />
    </section>
  )
}

// Save part of the business settings from a section.
function useSave(data) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const save = async (changes, ok) => {
    setBusy(true)
    const problem = await data.actions.saveSettings(changes)
    setBusy(false)
    setResult(outcome(problem, ok))
  }
  return { busy, result, save, setResult }
}

function ClockInRules({ data }) {
  const s = data.settings
  const [early, setEarly] = useState(s.clockInEarly)
  const [anyway, setAnyway] = useState(s.allowAnyway)
  const [round, setRound] = useState(s.roundWithin)
  const { busy, result, save } = useSave(data)
  return (
    <section className="st-section">
      <h3 className="tm-h3">Clocking in</h3>
      <label className="form-label" htmlFor="st-early">Clock in appears</label>
      <select id="st-early" className="form-select st-short" value={early} onChange={(e) => setEarly(Number(e.target.value))}>
        {[5, 10, 15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min before a shift</option>)}
      </select>
      <label className="form-check mt-2">
        <input type="checkbox" className="form-check-input" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} /> Allow “Clock in anyway” when nothing is scheduled
      </label>
      <div className="form-text">Off: people can only clock in for a shift on the schedule. Either way, Review flags punches without a shift.</div>
      <label className="form-label mt-3" htmlFor="st-round">Round punches to the hour</label>
      <select id="st-round" className="form-select st-short" value={round} onChange={(e) => setRound(Number(e.target.value))}>
        <option value={0}>Off (exact times)</option>
        {[5, 7, 10, 15].map((m) => <option key={m} value={m}>Within {m} min of the hour</option>)}
      </select>
      <div className="form-text">
        {round ? `Clock out at 6:0${Math.min(round - 1, 9)} PM counts as 6:00 PM; clock in at 7:${60 - round + 1} AM counts as 8:00 AM.` : 'Hours use the exact punch times.'}{' '}
        The real times stay saved, and each punch's details show them.
      </div>
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={() => save({ clockInEarly: early, allowAnyway: anyway, roundWithin: round })}>Save</button>
      <Result result={result} />
    </section>
  )
}

// Which parts of the app this business uses. Switched-off features disappear for everyone;
// nothing is deleted, so switching one back on brings everything back.
function Features({ data }) {
  const [features, setFeatures] = useState(() => featuresOf(data.settings))
  const { busy, result, save } = useSave(data)
  const chosen = PRESETS.find((p) => FEATURES.every((f) => Boolean(p.on.includes(f.id)) === Boolean(features[f.id])))?.id
  const toggle = (id) => setFeatures({ ...features, [id]: !features[id] })
  return (
    <section className="st-section">
      <h3 className="tm-h3">Features</h3>
      <p className="tm-muted small mb-2">Pick what your team uses. Anything switched off is hidden for everyone, and nothing is deleted.</p>
      <div className="ft-presets" role="group" aria-label="Starting point">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="ft-preset" aria-pressed={chosen === p.id} onClick={() => setFeatures(presetFeatures(p))}>
            <b>{p.label}</b>
            <small>{p.help}</small>
          </button>
        ))}
      </div>
      <p className="ft-always">Always on: the schedule and your team list.</p>
      {FEATURES.map((f) => {
        const blocked = f.needs && !features[f.needs]
        return (
          <label key={f.id} className={`ft-row ${blocked ? 'blocked' : ''}`}>
            <input type="checkbox" className="form-check-input" checked={Boolean(features[f.id]) && !blocked} disabled={blocked} onChange={() => toggle(f.id)} />
            <span>
              <b>{f.label}</b>
              <small>{blocked ? `Needs ${FEATURES.find((x) => x.id === f.needs).label}.` : f.help}</small>
            </span>
          </label>
        )
      })}
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={() => save({ features })}>Save</button>
      <Result result={result} />
    </section>
  )
}

function ShiftPicks({ data }) {
  const [picks, setPicks] = useState(() => data.settings.shiftPresets.map((p) => ({ ...p })))
  const { busy, result, save, setResult } = useSave(data)
  const setPick = (i, field, value) => setPicks(picks.map((p, j) => (j === i ? { ...p, [field]: value } : p)))
  const submit = () => {
    const clean = picks.map((p) => ({ ...p, title: p.title.trim() })).filter((p) => p.title)
    if (clean.some((p) => p.start === null || p.end === null || p.end <= p.start)) return setResult({ error: 'Each quick pick needs a start time before its end time.' })
    if (!clean.length) return setResult({ error: 'Keep at least one quick pick.' })
    save({ shiftPresets: clean })
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Shift types</h3>
      <p className="tm-muted small mb-2">The buttons in the Add shift pop-up. The color shows on everyone's schedule.</p>
      {picks.map((p, i) => (
        <div key={i} className="st-pick">
          <input className="form-control form-control-sm" aria-label="Name" placeholder="Name…" value={p.title} onChange={(e) => setPick(i, 'title', e.target.value)} />
          <input type="time" step="900" className="form-control form-control-sm" aria-label="Start" value={p.start === null ? '' : toTimeInput(p.start)} onChange={(e) => setPick(i, 'start', fromTimeInput(e.target.value))} />
          <input type="time" step="900" className="form-control form-control-sm" aria-label="End" value={p.end === null ? '' : toTimeInput(p.end)} onChange={(e) => setPick(i, 'end', fromTimeInput(e.target.value))} />
          <button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove ${p.title || 'quick pick'}`} onClick={() => setPicks(picks.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          <span className="st-colors" role="group" aria-label="Color">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
              <button key={c} type="button" className={`sc-tag t${c} st-swatch ${p.color === c ? 'on' : ''}`} aria-label={`Color ${c + 1}`} aria-pressed={p.color === c} onClick={() => setPick(i, 'color', c)} />
            ))}
          </span>
        </div>
      ))}
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPicks([...picks, { title: '', start: 540, end: 1020 }])}>+ Add</button>
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={submit}>Save</button>
      </div>
      <Result result={result} />
    </section>
  )
}

function Roles({ data }) {
  const [list, setList] = useState(() => data.settings.roles.map((r) => ({ ...r })))
  const { busy, result, save, setResult } = useSave(data)
  const setRole = (i, field, value) => setList(list.map((r, j) => (j === i ? { ...r, [field]: value } : r)))
  const submit = () => {
    const clean = list.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name)
    const names = clean.map((r) => r.name.toLowerCase())
    if (new Set(names).size !== names.length) return setResult({ error: 'Each role needs its own name.' })
    save({ roles: clean })
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Roles</h3>
      <p className="tm-muted small mb-2">What someone does on a shift (for example Front desk). You pick one when you add a shift, and your team sees it on their schedule.</p>
      {list.map((r, i) => (
        <div key={i} className="st-pick st-role">
          <input className="form-control form-control-sm" aria-label="Role name" placeholder="e.g. Front desk…" value={r.name} onChange={(e) => setRole(i, 'name', e.target.value)} />
          <button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove ${r.name || 'role'}`} onClick={() => setList(list.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          <span className="st-colors" role="group" aria-label="Color">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
              <button key={c} type="button" className={`rl-dot t${c} st-swatch ${r.color === c ? 'on' : ''}`} aria-label={`Color ${c + 1}`} aria-pressed={r.color === c} onClick={() => setRole(i, 'color', c)} />
            ))}
          </span>
        </div>
      ))}
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setList([...list, { name: '', color: list.length % 8 }])}>+ Add</button>
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={submit}>Save</button>
      </div>
      <Result result={result} />
    </section>
  )
}

function Groups({ data }) {
  // `was` remembers a group's name from when this list opened, so renaming one moves its people.
  const [list, setList] = useState(() => (data.settings.groups ?? []).map((g) => ({ ...g, was: g.name })))
  const { busy, result, setResult } = useSave(data)
  const set = (i, field, value) => setList(list.map((g, j) => (j === i ? { ...g, [field]: value } : g)))
  const move = (i, by) => {
    const j = i + by
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    setList(next)
  }
  const submit = async () => {
    const clean = list.map((g) => ({ ...g, name: g.name.trim() })).filter((g) => g.name)
    const names = clean.map((g) => g.name.toLowerCase())
    if (new Set(names).size !== names.length) return setResult({ error: 'Each group needs its own name.' })
    const renames = clean.filter((g) => g.was && g.was !== g.name).map((g) => ({ from: g.was, to: g.name }))
    const kept = new Set(clean.map((g) => g.was).filter(Boolean))
    const removed = (data.settings.groups ?? []).map((g) => g.name).filter((n) => !kept.has(n))
    setResult(null)
    const problem = await data.actions.saveGroups({ groups: clean.map(({ name, color }) => ({ name, color })), renames, removed })
    setResult(problem ? { error: problem } : { ok: 'Saved.' })
    if (!problem) setList(clean.map((g) => ({ ...g, was: g.name })))
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Groups</h3>
      <p className="tm-muted small mb-2">For a bigger team: Cashiers, Waiters, Kitchen. Hours → Review shows one column per group. Put each person in a group on the Team tab. Removing a group leaves its people without one.</p>
      {!data.settings.groupsReady && data.settingsReady && (
        <p className="tm-warn">This uses update 030. Run <code>supabase/updates/030-staff-groups.sql</code> in Supabase, then reload, before saving here.</p>
      )}
      {list.map((g, i) => (
        <div key={i} className="st-pick st-role">
          <input className="form-control form-control-sm" aria-label="Group name" placeholder="e.g. Waiters…" maxLength={40} value={g.name} onChange={(e) => set(i, 'name', e.target.value)} />
          <span className="st-order">
            <button type="button" className="btn btn-outline-secondary btn-sm" aria-label={`Move ${g.name || 'group'} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" aria-label={`Move ${g.name || 'group'} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove ${g.name || 'group'}`} onClick={() => setList(list.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          </span>
          <span className="st-colors" role="group" aria-label="Color">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
              <button key={c} type="button" className={`rl-dot t${c} st-swatch ${g.color === c ? 'on' : ''}`} aria-label={`Color ${c + 1}`} aria-pressed={g.color === c} onClick={() => set(i, 'color', c)} />
            ))}
          </span>
        </div>
      ))}
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setList([...list, { name: '', color: list.length % 8, was: '' }])}>+ Add</button>
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={submit}>Save</button>
      </div>
      <Result result={result} />
    </section>
  )
}

function Positions({ data }) {
  const [list, setList] = useState(data.settings.positions.join('\n'))
  const { busy, result, save, setResult } = useSave(data)
  const submit = () => {
    const clean = [...new Set(list.split('\n').map((p) => p.trim()).filter(Boolean))]
    if (!clean.length) return setResult({ error: 'Keep at least one position.' })
    save({ positions: clean })
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Positions</h3>
      <label className="form-label small" htmlFor="st-pos">Suggested when adding someone on the Team tab. One per line.</label>
      <textarea id="st-pos" className="form-control" rows={5} value={list} onChange={(e) => setList(e.target.value)} />
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={submit}>Save</button>
      <Result result={result} />
    </section>
  )
}

function Reminders({ data }) {
  const s = data.settings
  const [form, setForm] = useState({ remindBefore: s.remindBefore, remindAfter: s.remindAfter, lateAfter: s.lateAfter, quietFrom: s.quietFrom, quietTo: s.quietTo })
  const { busy, result, save, setResult } = useSave(data)
  const minutes = (field, label, choices) => (
    <div className="col-sm-4">
      <label className="form-label small" htmlFor={`st-${field}`}>{label}</label>
      <select id={`st-${field}`} className="form-select form-select-sm" value={form[field]} onChange={(e) => setForm({ ...form, [field]: Number(e.target.value) })}>
        {choices.map((m) => <option key={m} value={m}>{m} min</option>)}
      </select>
    </div>
  )
  const submit = () => {
    if (form.quietFrom === null || form.quietTo === null) return setResult({ error: 'Choose when quiet hours start and end.' })
    save(form)
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Notification timing</h3>
      <div className="row g-2">
        {minutes('remindBefore', 'Shift reminder, before', [10, 15, 30, 45, 60])}
        {minutes('remindAfter', '“Still clocked in?”, after the shift', [15, 30, 45, 60, 90])}
        {minutes('lateAfter', 'Late alert to managers, after start', [5, 10, 15, 20, 30])}
        <div className="col-6 col-sm-4">
          <label className="form-label small" htmlFor="st-qf">Quiet hours from</label>
          <input id="st-qf" type="time" step="900" className="form-control form-control-sm" value={form.quietFrom === null ? '' : toTimeInput(form.quietFrom)} onChange={(e) => setForm({ ...form, quietFrom: fromTimeInput(e.target.value) })} />
        </div>
        <div className="col-6 col-sm-4">
          <label className="form-label small" htmlFor="st-qt">until</label>
          <input id="st-qt" type="time" step="900" className="form-control form-control-sm" value={form.quietTo === null ? '' : toTimeInput(form.quietTo)} onChange={(e) => setForm({ ...form, quietTo: fromTimeInput(e.target.value) })} />
        </div>
      </div>
      <div className="form-text">
        Nothing buzzes during quiet hours ({form.quietFrom !== null && clockTime(form.quietFrom)} – {form.quietTo !== null && clockTime(form.quietTo)}) except “still clocked in”.
      </div>
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={submit}>Save</button>
      <Result result={result} />
    </section>
  )
}

function NoticeEditor({ data }) {
  const s = data.settings
  const [text, setText] = useState(s.noticeText)
  const { busy, result, save, setResult } = useSave(data)
  const people = data.employees.filter((e) => e.active && !scheduleOnly(e)).sort((a, b) => a.name.localeCompare(b.name))
  const read = people.filter((e) => noticeAcked(data.privateById[e.id], s))
  const submit = (askAgain) => {
    if (!text.trim()) return setResult({ error: 'The notice can’t be empty.' })
    save({ noticeText: text.trim(), noticeVersion: askAgain ? s.noticeVersion + 1 : s.noticeVersion }, askAgain ? 'Saved. Everyone will be asked to read it again.' : 'Saved.')
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">Location notice</h3>
      <p className="tm-muted small mb-2">
        New York (Civil Rights Law § 52-c) requires telling employees in writing that their location is recorded, and having them acknowledge it.
        Everyone sees this on the Clock tab until they tap <b>I've read this</b>.
      </p>
      <textarea className="form-control" rows={8} aria-label="Notice text" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="d-flex flex-wrap gap-2 mt-2">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy || text === s.noticeText} onClick={() => submit(true)}>Save and ask everyone again</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || text === s.noticeText} onClick={() => submit(false)}>Save small fix (don’t ask again)</button>
      </div>
      <Result result={result} />
      <h4 className="st-h4">Read it: {read.length} of {people.length}</h4>
      <ul className="st-readers">
        {people.map((e) => {
          const priv = data.privateById[e.id]
          const ok = noticeAcked(priv, s)
          return (
            <li key={e.id}>
              <span>{e.name}</span>
              {ok ? <span className="tm-chip approved">{dayLabel(dateKey(new Date(priv.noticeAckAt)))}</span> : <span className="tm-chip pending">Not yet</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
