import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { supabase, usingSupabase } from '../lib/supabase.js'
import { dateKey } from '../lib/dates.js'
import { clockTime, dayLabel, fromTimeInput, scheduleOnly, toTimeInput } from './format.js'
import { NotifyOptions } from './NotifySettings.jsx'
import ShopLocation from './ShopLocation.jsx'
import { noticeAcked, noticeFor } from './settings.js'
import KioskSettings from './KioskSettings.jsx'
import { FEATURES, PRESETS, featuresOf, presetFeatures, useFeatures } from './features.js'
import { dayName, say } from './words.js'
import Icon from './Icon.jsx'
import { AVATAR_COLORS } from './avatarColors.js'
import Avatar from './Avatar.jsx'
import { defaultHours, hoursProblem, normalizeHours, presetsFromHours, shrinkImage } from './onboardingHelpers.js'
import StoreHoursFields from './StoreHours.jsx'
import PayPeriodFields from './PayPeriodFields.jsx'
import Seg from './Seg.jsx'
import DesktopOnly from './DesktopOnly.jsx'
import { useIsPhone } from './useIsPhone.js'
import SlideIn from './SlideIn.jsx'
import { ID_SOURCES, missingIds, payrollCsv, payrollLayout } from './payroll.js'
import { reportRows } from './reportFilters.js'
import { payPeriodOf } from './paycheck.js'
import { tr } from './i18n.js'

// ⚙️ Settings. "Me" is for everyone: theme, notifications, contact details,
// the location notice and password. "Business" is for managers: the shop and
// how the app works for the whole team.
export default function SettingsPanel({ data, me, boss, onToggleTheme, onSignOut, start = 'me', onClose, onProfile, asPage = false }) {
  const [page, setPage] = useState(boss ? start : 'me')
  const phone = useIsPhone()
  const content = (
    <>
      {boss && (
        <div className="tm-switch">
          <Seg className="tm-seg" role="group" aria-label={tr('Settings page', 'Página de ajustes')}>
            <button type="button" aria-pressed={page === 'me'} onClick={() => setPage('me')}>{tr("Me", "Yo")}</button>
            <button type="button" aria-pressed={page === 'business'} onClick={() => setPage('business')}>{tr("Business", "Negocio")}</button>
          </Seg>
        </div>
      )}
      <SlideIn id={page} order={['me', 'business']}>
        {page === 'me' ? (
          <MySettings data={data} me={me} boss={boss} onToggleTheme={onToggleTheme} onSignOut={onSignOut} onProfile={onProfile} />
        ) : (
          phone ? <DesktopOnly name="Business settings" lang={data.lang} /> : <BusinessSettings data={data} onClose={onClose} />
        )}
      </SlideIn>
    </>
  )
  // As a page it fills the content area like the other tabs; as a pop-up it is the Modal.
  if (asPage) return <div className="tm-narrow desk st-page"><h2 className="sc-h">{tr("Settings", "Ajustes")}</h2>{content}</div>
  return <Modal title={tr('Settings', 'Ajustes')} size={page === 'business' ? 'lg' : undefined} onClose={onClose}>{content}</Modal>
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
const outcome = (problem, ok = tr('Saved.', 'Guardado.')) => (problem ? { error: explain(problem) } : { ok })

function MySettings({ data, me, boss, onToggleTheme, onSignOut, onProfile }) {
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
        <h3 className="tm-h3">{tr("Notifications", "Notificaciones")}</h3>
        <NotifyOptions data={data} boss={boss} />
      </section>
      <section className="st-section">
        <h3 className="tm-h3">{data.lang === 'es' ? 'Mi perfil' : 'My profile'}</h3>
        <p className="tm-muted mb-2">{data.lang === 'es' ? 'Tu color, teléfono y contacto de emergencia están en tu perfil.' : 'Your color, phone and emergency contact are on your profile.'}</p>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onProfile}>{data.lang === 'es' ? 'Abrir mi perfil' : 'Open my profile'}</button>
      </section>
      {f.location && (
        <section className="st-section">
          <h3 className="tm-h3">{tr("Location notice", "Aviso de ubicación")}</h3>
          <LocationNotice data={data} me={me} />
        </section>
      )}
      <Account onSignOut={onSignOut} />
      <section className="st-section">
        <h3 className="tm-h3">{tr("Help", "Ayuda")}</h3>
        <ul className="small mb-0 st-help">
          <li>{tr("Add the app to your home screen: iPhone Safari → Share →", "Agrega la app a tu pantalla de inicio: iPhone Safari → Compartir →")} <b>{tr("Add to Home Screen", "Agregar a pantalla de inicio")}</b>{tr("; Android Chrome → ⋮ →", "; Android Chrome → ⋮ →")} <b>{tr("Install app", "Instalar app")}</b>.</li>
          <li>{tr("Clock in asks for your location. If it says it isn't allowed, turn on Location for the browser or RI Sched in your phone's settings.", "Marcar entrada pide tu ubicación. Si dice que no está permitido, activa la Ubicación para el navegador en los ajustes de tu teléfono.")}</li>
          <li>{tr("Something wrong with your hours or a shift? Tell a manager; managers can fix any punch.", "¿Algo mal en tus horas o un turno? Avísale a un gerente; los gerentes pueden arreglar cualquier registro.")}</li>
        </ul>
      </section>
    </>
  )
}

// The color of your badge, so the manager (and everyone) can tell you apart at a glance (update 032).
export function MyColor({ data, me }) {
  const [result, setResult] = useState(null)
  const pick = async (color) => {
    const problem = await data.actions.setMyAvatarColor(color)
    setResult(problem ? { error: problem } : null)
  }
  const mine = data.employees.find((e) => e.id === me.id) ?? me
  return (
    <section className="st-section">
      <h3 className="tm-h3">{data.lang === 'es' ? 'Tu color' : 'Your color'}</h3>
      <div className="av-picks" role="group" aria-label={data.lang === 'es' ? 'Color de tu insignia' : 'Your badge color'}>
        {AVATAR_COLORS.map((c) => (
          <button key={c} type="button" className="av-pick" aria-pressed={!mine.avatarAuto && mine.avatarColor === c} aria-label={c} onClick={() => pick(c)}>
            <Avatar employee={{ ...mine, avatarColor: c }} size={40} />
          </button>
        ))}
      </div>
      <button type="button" className="tm-link small mt-2" disabled={Boolean(mine.avatarAuto)} onClick={() => pick(null)}>{data.lang === 'es' ? 'Color automático' : 'Use an automatic color'}</button>
      <Result result={result} />
    </section>
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
      <h3 className="tm-h3">{tr("Language · Idioma", "Idioma · Language")}</h3>
      <Seg className="tm-seg st-lang" role="group" aria-label={tr('Language', 'Idioma')}>
        <button type="button" aria-pressed={data.lang !== 'es'} onClick={() => pick('en')}>English</button>
        <button type="button" aria-pressed={data.lang === 'es'} onClick={() => pick('es')}>Español</button>
      </Seg>
      <p className="tm-muted small mt-2 mb-0">
        {data.lang === 'es' ? 'Las pestañas y las pantallas salen en español.' : 'Changes the tabs and screens to Spanish.'}
      </p>
      <Result result={result} />
    </section>
  )
}

export function MyContact({ data, me }) {
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
      <h3 className="tm-h3">{tr("My phone & emergency contact", "Mi teléfono y contacto de emergencia")}</h3>
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-phone">{tr("My phone", "Mi teléfono")}</label>
          <input id="st-phone" type="tel" autoComplete="tel" className="form-control" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="col-sm-6" />
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-ename">{tr("Emergency contact name", "Nombre del contacto de emergencia")}</label>
          <input id="st-ename" className="form-control" placeholder={tr('Name (and who they are)…', 'Nombre (y quién es)…')} value={form.emergencyName} onChange={set('emergencyName')} />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-ephone">{tr("Their phone", "Su teléfono")}</label>
          <input id="st-ephone" type="tel" className="form-control" value={form.emergencyPhone} onChange={set('emergencyPhone')} />
        </div>
      </div>
      <div className="d-flex align-items-center gap-2 mt-2">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={save}>{tr("Save", "Guardar")}</button>
        <small className="tm-muted">{tr("Only you and managers can see these.", "Solo tú y los gerentes pueden ver esto.")}</small>
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
      <div className="st-notice">{noticeFor(data.settings, data.lang)}</div>
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
        <h3 className="tm-h3">{tr("Password", "Contraseña")}</h3>
        <p className="tm-muted small mb-0">{tr("Change your password and sign out everywhere work on the live site, not in sample mode.", "Cambiar tu contraseña y cerrar sesión en todas partes funcionan en el sitio real, no en el modo de muestra.")}</p>
      </section>
    )
  }
  const change = async () => {
    if (password.length < 8) return setResult({ error: tr('Use at least 8 characters.', 'Usa al menos 8 caracteres.') })
    if (password !== again) return setResult({ error: tr("The two passwords don't match.", 'Las dos contraseñas no coinciden.') })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setResult({ error: error.message })
    setPassword('')
    setAgain('')
    setResult({ ok: tr('Password changed. Use the new one next time you sign in.', 'Contraseña cambiada. Usa la nueva la próxima vez que entres.') })
  }
  // Signs this login out on every phone and computer, e.g. after losing a phone.
  const everywhere = async () => {
    if (!window.confirm(tr('Sign out on every phone and computer, including this one?', '¿Cerrar sesión en todos los teléfonos y computadoras, incluido este?'))) return
    await supabase.auth.signOut({ scope: 'global' })
    onSignOut?.()
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Password", "Contraseña")}</h3>
      <div className="row g-2">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-pw">{tr("New password", "Contraseña nueva")}</label>
          <input id="st-pw" type="password" autoComplete="new-password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="st-pw2">{tr("Type it again", "Escríbela otra vez")}</label>
          <input id="st-pw2" type="password" autoComplete="new-password" className="form-control" value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy || !password} onClick={change}>{tr("Change password", "Cambiar contraseña")}</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={everywhere}>{tr("Sign out everywhere", "Cerrar sesión en todas partes")}</button>
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
        <p className="tm-warn">{tr("These use update 018. Run", "Estos usan la actualización 018. Ejecuta")} <code>supabase/updates/018-settings.sql</code> {tr("in Supabase, then reload, before saving here.", "en Supabase y recarga antes de guardar aquí.")}</p>
      )}
      <BusinessProfile data={data} onClose={onClose} />
      <StoreHoursSettings data={data} />
      {f.timeClock && <PayPeriodSettings data={data} />}
      {f.timeClock && <PayrollExportSettings data={data} />}
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
      setError(err.message === 'big' ? tr('That image is too large. Try a smaller one.', 'Esa imagen es muy grande. Prueba una más pequeña.') : tr("That file isn't an image.", 'Ese archivo no es una imagen.'))
    }
  }
  const again = async () => {
    await data.actions.saveSettings({ setupDone: false })
    onClose?.()
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Business name and logo", "Nombre y logo del negocio")}</h3>
      <p className="tm-muted small mb-2">{tr("Shown in the menu, the header and on the kiosk.", "Se muestra en el menú, el encabezado y el quiosco.")}</p>
      <label className="form-label" htmlFor="bp-name">{tr("Business name", "Nombre del negocio")}</label>
      <input id="bp-name" className="form-control" value={name} maxLength={60} placeholder="WiseShift" onChange={(e) => setName(e.target.value)} />
      <div className="ob-logo mt-3">
        <span className="ob-logo-box">{logo ? <img src={logo} alt="" /> : <b>{(name.trim()[0] ?? 'W').toUpperCase()}</b>}</span>
        <label className="btn btn-outline-secondary btn-sm mb-0">
          {logo ? tr('Change image', 'Cambiar imagen') : tr('Choose image', 'Elegir imagen')}
          <input type="file" accept="image/*" hidden onChange={choose} />
        </label>
        {logo && <button type="button" className="tm-link small" onClick={() => setLogo('')}>{tr("Remove", "Quitar")}</button>}
      </div>
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
      <div className="d-flex align-items-center gap-3 mt-3">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={() => save({ businessName: name.trim(), businessLogo: logo })}>{tr("Save", "Guardar")}</button>
        <button type="button" className="tm-link small" onClick={again}>{tr("Run the setup wizard again", "Volver a abrir la configuración inicial")}</button>
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
    save({ storeHours: { days: hours }, ...(presets ? { shiftPresets: presets } : {}) }, tr('Saved.', 'Guardado.'))
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Store hours", "Horario del negocio")}</h3>
      <p className="tm-muted small mb-2">{tr("Each day can have its own hours, or be closed. The day view on the schedule starts and ends with that day's opening and closing time.", "Cada día puede tener su propio horario o estar cerrado. La vista de día del horario empieza y termina con la apertura y el cierre de ese día.")}</p>
      <StoreHoursFields value={hours} onChange={setHours} lang={data.lang} />
      <div className="form-check mt-3">
        <input id="sh-picks" className="form-check-input" type="checkbox" checked={picks} onChange={(e) => setPicks(e.target.checked)} />
        <label className="form-check-label" htmlFor="sh-picks">{tr("Also set the Open, Close and All Day quick picks from these hours", "También crear los botones rápidos Apertura, Cierre y Todo el día con este horario")}</label>
      </div>
      <button type="button" className="btn btn-brand btn-sm mt-3" disabled={busy || bad} onClick={submit}>{tr("Save", "Guardar")}</button>
      <Result result={result} />
    </section>
  )
}

// How long a pay period is and which day it starts. Hours, timesheets, overtime weeks and the exports all follow it.
function PayPeriodSettings({ data }) {
  const [value, setValue] = useState(data.settings.payPeriod)
  const { busy, result, save } = useSave(data)
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Pay period", "Período de pago")}</h3>
      <p className="tm-muted small mb-2">{tr("Hours, timesheets and exports are grouped by pay period. Overtime counts after 40 hours in each week of it.", "Las horas, hojas de horas y exportaciones se agrupan por período de pago. Las horas extra cuentan después de 40 horas en cada semana.")}</p>
      {!data.settings.payPeriodReady && <p className="tm-warn">{tr("This uses update 033. Run", "Esto usa la actualización 033. Ejecuta")} <code>supabase/updates/033-pay-period.sql</code> {tr("in Supabase, then reload, before saving here.", "en Supabase y recarga antes de guardar aquí.")}</p>}
      <PayPeriodFields value={value} onChange={setValue} lang={data.lang} />
      <button type="button" className="btn btn-brand btn-sm mt-3" disabled={busy} onClick={() => save({ payPeriod: value }, tr('Saved. Hours now follow this pay period.', 'Guardado. Las horas ahora siguen este período de pago.'))}>{tr("Save", "Guardar")}</button>
      <Result result={result} />
    </section>
  )
}

// The payroll CSV layout, set once: how people are identified, which columns (renamed, in order), hour and date formats,
// with a preview from this pay period. Exports on Reports use it (update 035).
function PayrollExportSettings({ data }) {
  const [layout, setLayout] = useState(() => payrollLayout(data.settings.payrollExport))
  const { busy, result, save } = useSave(data)
  const setCol = (i, change) => setLayout({ ...layout, columns: layout.columns.map((c, j) => (j === i ? { ...c, ...change } : c)) })
  const move = (i, by) => {
    const cols = [...layout.columns]
    const j = i + by
    if (j < 0 || j >= cols.length) return
    ;[cols[i], cols[j]] = [cols[j], cols[i]]
    setLayout({ ...layout, columns: cols })
  }
  const [now] = useState(() => new Date())
  const days = payPeriodOf(now)
  const rows = reportRows(data, days, now)
  const preview = payrollCsv(rows.slice(0, 3), days, data, layout)
  const missing = missingIds(rows, data, layout)
  return (
    <section className="st-section" data-search="payroll-export">
      <h3 className="tm-h3">{tr("Payroll export", "Exportación de nómina")}</h3>
      <p className="tm-muted small mb-2">{tr("Set this once to match the file your payroll service imports (Gusto, QuickBooks, ADP, Paychex…). Reports → Timesheet → Payroll CSV then downloads it in one click.", "Configúralo una vez para que coincida con el archivo que importa tu servicio de nómina (Gusto, QuickBooks, ADP, Paychex…). Luego Informes → Hoja de horas → CSV de nómina lo descarga con un clic.")}</p>
      {!data.settings.payrollReady && <p className="tm-warn">{tr("This uses update 035. Run", "Esto usa la actualización 035. Ejecuta")} <code>supabase/updates/035-payroll-export.sql</code> {tr("in Supabase, then reload, before saving here.", "en Supabase y recarga antes de guardar aquí.")}</p>}
      <div className="row g-2 mb-2">
        <div className="col-sm-4">
          <label className="form-label" htmlFor="px-id">{tr("Identify people by", "Identificar a las personas por")}</label>
          <select id="px-id" className="form-select form-select-sm" value={layout.idBy} onChange={(e) => setLayout({ ...layout, idBy: e.target.value })}>
            {ID_SOURCES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div className="col-sm-4">
          <label className="form-label" htmlFor="px-hours">{tr("Hours as", "Horas como")}</label>
          <select id="px-hours" className="form-select form-select-sm" value={layout.hours} onChange={(e) => setLayout({ ...layout, hours: e.target.value })}>
            <option value="decimal">{tr("Decimals (8.50)", "Decimales (8.50)")}</option>
            <option value="hm">{tr("Hours and minutes (8:30)", "Horas y minutos (8:30)")}</option>
          </select>
        </div>
        <div className="col-sm-4">
          <label className="form-label" htmlFor="px-dates">{tr("Dates as", "Fechas como")}</label>
          <select id="px-dates" className="form-select form-select-sm" value={layout.dates} onChange={(e) => setLayout({ ...layout, dates: e.target.value })}>
            <option value="us">MM/DD/YYYY</option>
            <option value="iso">YYYY-MM-DD</option>
          </select>
        </div>
      </div>
      <p className="form-label mb-1">{tr("Columns, in order (tick the ones your payroll file has, and use its column names)", "Columnas, en orden (marca las que tiene tu archivo de nómina y usa sus nombres)")}</p>
      <ul className="px-cols">
        {layout.columns.map((c, i) => (
          <li key={c.id} className={c.on ? '' : 'off'}>
            <input type="checkbox" className="form-check-input" checked={c.on} aria-label={tr(`Include ${c.label}`, `Incluir ${c.label}`)} onChange={(e) => setCol(i, { on: e.target.checked })} />
            <input className="form-control form-control-sm" value={c.label} maxLength={40} aria-label={tr('Column name', 'Nombre de la columna')} disabled={!c.on} onChange={(e) => setCol(i, { label: e.target.value })} />
            <button type="button" className="btn btn-outline-secondary btn-sm" aria-label={tr('Move up', 'Subir')} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" aria-label={tr('Move down', 'Bajar')} disabled={i === layout.columns.length - 1} onClick={() => move(i, 1)}>↓</button>
          </li>
        ))}
      </ul>
      <p className="form-label mb-1 mt-3">{tr("Preview (this pay period, first 3 people)", "Vista previa (este período, primeras 3 personas)")}</p>
      <div className="px-preview"><table><tbody>{preview.map((line, i) => <tr key={i}>{line.map((v, j) => (i === 0 ? <th key={j}>{v}</th> : <td key={j}>{String(v)}</td>))}</tr>)}</tbody></table></div>
      {missing.length > 0 && <p className="tm-warn mt-2">{tr(`${missing.length} ${missing.length === 1 ? 'person has' : 'people have'} no ${ID_SOURCES.find((x) => x.id === layout.idBy).label}: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}. Add it on Team → their page → Edit.`, `${missing.length} ${missing.length === 1 ? 'persona no tiene' : 'personas no tienen'} ${ID_SOURCES.find((x) => x.id === layout.idBy).label}: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}. Agrégalo en Equipo → su página → Editar.`)}</p>}
      <button type="button" className="btn btn-brand btn-sm mt-3" disabled={busy || !layout.columns.some((c) => c.on)} onClick={() => save({ payrollExport: layout }, tr('Saved. Payroll CSV downloads use this layout.', 'Guardado. Las descargas de CSV de nómina usan este formato.'))}>{tr("Save", "Guardar")}</button>
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
      <h3 className="tm-h3">{tr("Clocking in", "Marcar entrada")}</h3>
      <label className="form-label" htmlFor="st-early">{tr("Clock in appears", "Marcar entrada aparece")}</label>
      <select id="st-early" className="form-select st-short" value={early} onChange={(e) => setEarly(Number(e.target.value))}>
        {[5, 10, 15, 30, 45, 60].map((m) => <option key={m} value={m}>{tr(`${m} min before a shift`, `${m} min antes de un turno`)}</option>)}
      </select>
      <label className="form-check mt-2">
        <input type="checkbox" className="form-check-input" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} /> {tr('Allow “Clock in anyway” when nothing is scheduled', 'Permitir “Marcar entrada de todos modos” cuando no hay nada programado')}
      </label>
      <div className="form-text">{tr("Off: people can only clock in for a shift on the schedule. Either way, Review flags punches without a shift.", "Apagado: solo se puede marcar entrada para un turno del horario. De cualquier forma, Revisar marca los registros sin turno.")}</div>
      <label className="form-label mt-3" htmlFor="st-round">{tr("Round punches to the hour", "Redondear registros a la hora")}</label>
      <select id="st-round" className="form-select st-short" value={round} onChange={(e) => setRound(Number(e.target.value))}>
        <option value={0}>{tr("Off (exact times)", "Apagado (horas exactas)")}</option>
        {[5, 7, 10, 15].map((m) => <option key={m} value={m}>{tr(`Within ${m} min of the hour`, `A ${m} min o menos de la hora`)}</option>)}
      </select>
      <div className="form-text">
        {round ? tr(`Clock out at 6:0${Math.min(round - 1, 9)} PM counts as 6:00 PM; clock in at 7:${60 - round + 1} AM counts as 8:00 AM.`, `Marcar salida a las 6:0${Math.min(round - 1, 9)} PM cuenta como 6:00 PM; marcar entrada a las 7:${60 - round + 1} AM cuenta como 8:00 AM.`) : tr('Hours use the exact punch times.', 'Las horas usan las horas exactas de los registros.')}{' '}
        {tr("The real times stay saved, and each punch's details show them.", 'Las horas reales quedan guardadas y se ven en los detalles de cada registro.')}
      </div>
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={() => save({ clockInEarly: early, allowAnyway: anyway, roundWithin: round })}>{tr("Save", "Guardar")}</button>
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
      <h3 className="tm-h3">{tr("Features", "Funciones")}</h3>
      <p className="tm-muted small mb-2">{tr("Pick what your team uses. Anything switched off is hidden for everyone, and nothing is deleted.", "Elige lo que usa tu equipo. Lo que apagues se oculta para todos y no se borra nada.")}</p>
      <div className="ft-presets" role="group" aria-label={tr('Starting point', 'Punto de partida')}>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="ft-preset" aria-pressed={chosen === p.id} onClick={() => setFeatures(presetFeatures(p))}>
            <b>{p.label}</b>
            <small>{p.help}</small>
          </button>
        ))}
      </div>
      <p className="ft-always">{tr("Always on: the schedule and your team list.", "Siempre activos: el horario y la lista del equipo.")}</p>
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
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={() => save({ features })}>{tr("Save", "Guardar")}</button>
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
    if (clean.some((p) => p.start === null || p.end === null || p.end <= p.start)) return setResult({ error: tr('Each quick pick needs a start time before its end time.', 'Cada botón rápido necesita una hora de inicio antes de la final.') })
    if (!clean.length) return setResult({ error: tr('Keep at least one quick pick.', 'Deja al menos un botón rápido.') })
    save({ shiftPresets: clean })
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Shift types", "Tipos de turno")}</h3>
      <p className="tm-muted small mb-2">{tr("The buttons in the Add shift pop-up. The color shows on everyone's schedule.", "Los botones de la ventana Agregar turno. El color se ve en el horario de todos.")}</p>
      {picks.map((p, i) => (
        <div key={i} className="st-pick">
          <input className="form-control form-control-sm" aria-label={tr('Name', 'Nombre')} placeholder={tr('Name…', 'Nombre…')} value={p.title} onChange={(e) => setPick(i, 'title', e.target.value)} />
          <input type="time" step="900" className="form-control form-control-sm" aria-label={tr('Start', 'Inicio')} value={p.start === null ? '' : toTimeInput(p.start)} onChange={(e) => setPick(i, 'start', fromTimeInput(e.target.value))} />
          <input type="time" step="900" className="form-control form-control-sm" aria-label={tr('End', 'Fin')} value={p.end === null ? '' : toTimeInput(p.end)} onChange={(e) => setPick(i, 'end', fromTimeInput(e.target.value))} />
          <button type="button" className="btn btn-outline-danger btn-sm" aria-label={tr(`Remove ${p.title || 'quick pick'}`, `Quitar ${p.title || 'botón rápido'}`)} onClick={() => setPicks(picks.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          <span className="st-colors" role="group" aria-label={tr('Color', 'Color')}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
              <button key={c} type="button" className={`sc-tag t${c} st-swatch ${p.color === c ? 'on' : ''}`} aria-label={`Color ${c + 1}`} aria-pressed={p.color === c} onClick={() => setPick(i, 'color', c)} />
            ))}
          </span>
        </div>
      ))}
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPicks([...picks, { title: '', start: 540, end: 1020 }])}>{tr("+ Add", "+ Agregar")}</button>
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={submit}>{tr("Save", "Guardar")}</button>
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
    if (new Set(names).size !== names.length) return setResult({ error: tr('Each role needs its own name.', 'Cada rol necesita su propio nombre.') })
    save({ roles: clean })
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Roles", "Roles")}</h3>
      <p className="tm-muted small mb-2">{tr("What someone does on a shift (for example Front desk). You pick one when you add a shift, and your team sees it on their schedule.", "Lo que alguien hace en un turno (por ejemplo, Recepción). Eliges uno al agregar un turno y tu equipo lo ve en su horario.")}</p>
      {list.map((r, i) => (
        <div key={i} className="st-pick st-role">
          <input className="form-control form-control-sm" aria-label={tr('Role name', 'Nombre del rol')} placeholder={tr('e.g. Front desk…', 'p. ej., Recepción…')} value={r.name} onChange={(e) => setRole(i, 'name', e.target.value)} />
          <button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove ${r.name || 'role'}`} onClick={() => setList(list.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          <span className="st-colors" role="group" aria-label={tr('Color', 'Color')}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
              <button key={c} type="button" className={`rl-dot t${c} st-swatch ${r.color === c ? 'on' : ''}`} aria-label={`Color ${c + 1}`} aria-pressed={r.color === c} onClick={() => setRole(i, 'color', c)} />
            ))}
          </span>
        </div>
      ))}
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setList([...list, { name: '', color: list.length % 8 }])}>{tr("+ Add", "+ Agregar")}</button>
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={submit}>{tr("Save", "Guardar")}</button>
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
    if (new Set(names).size !== names.length) return setResult({ error: tr('Each group needs its own name.', 'Cada grupo necesita su propio nombre.') })
    const renames = clean.filter((g) => g.was && g.was !== g.name).map((g) => ({ from: g.was, to: g.name }))
    const kept = new Set(clean.map((g) => g.was).filter(Boolean))
    const removed = (data.settings.groups ?? []).map((g) => g.name).filter((n) => !kept.has(n))
    setResult(null)
    const problem = await data.actions.saveGroups({ groups: clean.map(({ name, color }) => ({ name, color })), renames, removed })
    setResult(problem ? { error: problem } : { ok: tr('Saved.', 'Guardado.') })
    if (!problem) setList(clean.map((g) => ({ ...g, was: g.name })))
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Groups", "Grupos")}</h3>
      <p className="tm-muted small mb-2">{tr("For a bigger team: Cashiers, Waiters, Kitchen. Hours → Review shows one column per group. Put each person in a group on the Team tab. Removing a group leaves its people without one.", "Para un equipo más grande: Cajeros, Meseros, Cocina. Horas → Revisar muestra una columna por grupo. Pon a cada persona en un grupo en Equipo. Quitar un grupo deja a sus personas sin grupo.")}</p>
      {!data.settings.groupsReady && data.settingsReady && (
        <p className="tm-warn">{tr("This uses update 030. Run", "Esto usa la actualización 030. Ejecuta")} <code>supabase/updates/030-staff-groups.sql</code> {tr("in Supabase, then reload, before saving here.", "en Supabase y recarga antes de guardar aquí.")}</p>
      )}
      {list.map((g, i) => (
        <div key={i} className="st-pick st-role">
          <input className="form-control form-control-sm" aria-label={tr('Group name', 'Nombre del grupo')} placeholder={tr('e.g. Waiters…', 'p. ej., Meseros…')} maxLength={40} value={g.name} onChange={(e) => set(i, 'name', e.target.value)} />
          <span className="st-order">
            <button type="button" className="btn btn-outline-secondary btn-sm" aria-label={`Move ${g.name || 'group'} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" aria-label={`Move ${g.name || 'group'} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove ${g.name || 'group'}`} onClick={() => setList(list.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          </span>
          <span className="st-colors" role="group" aria-label={tr('Color', 'Color')}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
              <button key={c} type="button" className={`rl-dot t${c} st-swatch ${g.color === c ? 'on' : ''}`} aria-label={`Color ${c + 1}`} aria-pressed={g.color === c} onClick={() => set(i, 'color', c)} />
            ))}
          </span>
        </div>
      ))}
      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setList([...list, { name: '', color: list.length % 8, was: '' }])}>{tr("+ Add", "+ Agregar")}</button>
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={submit}>{tr("Save", "Guardar")}</button>
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
    if (!clean.length) return setResult({ error: tr('Keep at least one position.', 'Deja al menos un puesto.') })
    save({ positions: clean })
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Positions", "Puestos")}</h3>
      <label className="form-label small" htmlFor="st-pos">{tr("Suggested when adding someone on the Team tab. One per line.", "Se sugieren al agregar a alguien en Equipo. Uno por línea.")}</label>
      <textarea id="st-pos" className="form-control" rows={5} value={list} onChange={(e) => setList(e.target.value)} />
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={submit}>{tr("Save", "Guardar")}</button>
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
    if (form.quietFrom === null || form.quietTo === null) return setResult({ error: tr('Choose when quiet hours start and end.', 'Elige cuándo empiezan y terminan las horas de silencio.') })
    save(form)
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Notification timing", "Cuándo avisar")}</h3>
      <div className="row g-2">
        {minutes('remindBefore', tr('Shift reminder, before', 'Recordatorio de turno, antes'), [10, 15, 30, 45, 60])}
        {minutes('remindAfter', tr('“Still clocked in?”, after the shift', '“¿Sigues con entrada marcada?”, después del turno'), [15, 30, 45, 60, 90])}
        {minutes('lateAfter', tr('Late alert to managers, after start', 'Aviso de tardanza a gerentes, después del inicio'), [5, 10, 15, 20, 30])}
        <div className="col-6 col-sm-4">
          <label className="form-label small" htmlFor="st-qf">{tr("Quiet hours from", "Horas de silencio desde")}</label>
          <input id="st-qf" type="time" step="900" className="form-control form-control-sm" value={form.quietFrom === null ? '' : toTimeInput(form.quietFrom)} onChange={(e) => setForm({ ...form, quietFrom: fromTimeInput(e.target.value) })} />
        </div>
        <div className="col-6 col-sm-4">
          <label className="form-label small" htmlFor="st-qt">{tr("until", "hasta")}</label>
          <input id="st-qt" type="time" step="900" className="form-control form-control-sm" value={form.quietTo === null ? '' : toTimeInput(form.quietTo)} onChange={(e) => setForm({ ...form, quietTo: fromTimeInput(e.target.value) })} />
        </div>
      </div>
      <div className="form-text">
        {tr('Nothing buzzes during quiet hours', 'Nada suena durante las horas de silencio')} ({form.quietFrom !== null && clockTime(form.quietFrom)} – {form.quietTo !== null && clockTime(form.quietTo)}) {tr('except “still clocked in”.', 'excepto “sigue con entrada marcada”.')}
      </div>
      <button type="button" className="btn btn-brand btn-sm mt-2" disabled={busy} onClick={submit}>{tr("Save", "Guardar")}</button>
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
    if (!text.trim()) return setResult({ error: tr('The notice can’t be empty.', 'El aviso no puede estar vacío.') })
    save({ noticeText: text.trim(), noticeVersion: askAgain ? s.noticeVersion + 1 : s.noticeVersion }, askAgain ? tr('Saved. Everyone will be asked to read it again.', 'Guardado. Se le pedirá a todos que lo lean otra vez.') : tr('Saved.', 'Guardado.'))
  }
  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Location notice", "Aviso de ubicación")}</h3>
      <p className="tm-muted small mb-2">
        {tr('New York (Civil Rights Law § 52-c) requires telling employees in writing that their location is recorded, and having them acknowledge it. Everyone sees this on the Clock tab until they tap', 'Nueva York (Ley de Derechos Civiles § 52-c) exige avisar por escrito a los empleados que se registra su ubicación y que lo confirmen. Todos lo ven en la pestaña Hoy hasta que tocan')} <b>{tr("I've read this", "Ya lo leí")}</b>.
      </p>
      <textarea className="form-control" rows={8} aria-label={tr('Notice text', 'Texto del aviso')} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="d-flex flex-wrap gap-2 mt-2">
        <button type="button" className="btn btn-brand btn-sm" disabled={busy || text === s.noticeText} onClick={() => submit(true)}>{tr("Save and ask everyone again", "Guardar y preguntar a todos otra vez")}</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || text === s.noticeText} onClick={() => submit(false)}>{tr("Save small fix (don’t ask again)", "Guardar arreglo pequeño (no volver a preguntar)")}</button>
      </div>
      <Result result={result} />
      <h4 className="st-h4">{tr(`Read it: ${read.length} of ${people.length}`, `Lo leyeron: ${read.length} de ${people.length}`)}</h4>
      <ul className="st-readers">
        {people.map((e) => {
          const priv = data.privateById[e.id]
          const ok = noticeAcked(priv, s)
          return (
            <li key={e.id}>
              <span>{e.name}</span>
              {ok ? <span className="tm-chip approved">{dayLabel(dateKey(new Date(priv.noticeAckAt)))}</span> : <span className="tm-chip pending">{tr("Not yet", "Todavía no")}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
