import { useEffect, useRef, useState } from 'react'
import { useInstall } from './app.js'
import { PRESETS, featuresOf, presetFeatures } from './features.js'
import { noticeAcked } from './settings.js'
import { LocationNotice } from './SettingsPanel.jsx'
import Logo from './Logo.jsx'
import { DAY_SHORT, defaultHours, hoursLines, hoursProblem, markSeen, normalizeHours, presetsFromHours, shrinkImage } from './onboardingHelpers.js'
import { clockTime } from './format.js'
import ShopLocation from './ShopLocation.jsx'
import StoreHoursFields from './StoreHours.jsx'
import PayPeriodFields from './PayPeriodFields.jsx'

// First-run wizards. A new business owner sees one short wizard (welcome, the business's name and logo, done);
// everyone else sees a short welcome once on their own device (notifications, home screen, the location notice).
// Every step can be skipped, and the owner wizard can be run again from Settings.

const WORDS = {
  en: {
    step: (n, total) => `Step ${n} of ${total}`, next: 'Next', back: 'Back', skip: 'Skip for now', done: 'Done', start: 'Get started',
    ownerTitle: 'Welcome to WiseShift', ownerBody: "Let's set up your business. It takes about a minute, and you can change everything later in Settings.",
    nameTitle: "What's your business called?", nameLabel: 'Business name', namePlaceholder: 'Corner Coffee', logoLabel: 'Logo (optional)', logoHint: 'A square image works best. It shows in the menu, the header and on the kiosk.', chooseLogo: 'Choose image', changeLogo: 'Change image', removeLogo: 'Remove', logoBig: 'That image is too large. Try a smaller one.', logoBad: "That file isn't an image.",
    goalsTitle: 'What should WiseShift do for you?', goalsHint: 'You can turn any of it on or off later in Settings.', recommended: 'Recommended', payLabel: 'Also track hourly pay rates and paycheck estimates', payHelp: 'Only managers see pay. Off by default.',
    howTitle: 'How will your team clock in?', howPhones: 'On their own phones', howPhonesHelp: 'Each person clocks in from the app, with the shop location saved on each punch.', howKiosk: 'On a shared store computer (kiosk)', howKioskHelp: 'Everyone types a PIN on one screen at the counter. No location is saved.', howBoth: 'Both', howBothHelp: 'Phones, and a kiosk at the counter.',
    rulesTitle: 'Clocking in rules', earlyLabel: 'How early can someone clock in before their shift?', earlyOpt: (m) => (m === 0 ? 'Only at shift start' : `${m} minutes before`), anywayLabel: "Let people clock in even when they aren't on the schedule", anywayHelp: 'The punch is flagged for you to review.',
    payTitle: 'How often do you pay your team?', payHint: 'Hours and timesheets are grouped by pay period. You can change this later in Settings.',
    hoursTitle: 'When are you open?', hoursHint: 'The schedule day view starts and ends with these times.', hoursPicks: 'Make the Open, Close and All Day quick-pick shifts from these hours',
    locTitle: 'Where is the shop?', locHint: 'Optional. It lets a punch say "At the shop". You can do this later in Settings.',
    hoursPrefix: 'Hours:', closedWord: 'closed',
    summaryTitle: 'What you chose', kioskNext: 'Next: pair the kiosk in Settings → Business → Kiosk, then give everyone a PIN in Team.', 
    readyTitle: "You're all set", readyBody: 'Next, add your team so you can build a schedule.', addTeam: 'Add your team', toToday: 'Go to Today',
    hi: (n) => `Welcome, ${n}`, hiBody: (b) => `Here is how ${b ?? 'your team'} uses WiseShift: see your shifts, clock in and out, and ask for time off. Two quick things first.`,
    notifTitle: 'Stay in the loop', notifBody: 'Get a nudge when the schedule is published or one of your shifts changes.', notifBtn: 'Choose notifications',
    installTitle: 'Add WiseShift to your home screen', installBody: 'It opens full screen, like any other app.', installBtn: 'Install', howIos: ['Open this page in Safari.', 'Tap Share at the bottom.', 'Tap Add to Home Screen, then Add.'],
    noticeTitle: 'Please read before clocking in', readyStaffTitle: "You're ready", readyStaffBody: 'Open Today any time to clock in. Your shifts are under Schedule.',
  },
  es: {
    step: (n, total) => `Paso ${n} de ${total}`, next: 'Siguiente', back: 'Atrás', skip: 'Omitir por ahora', done: 'Listo', start: 'Empezar',
    ownerTitle: 'Bienvenido a WiseShift', ownerBody: 'Vamos a configurar tu negocio. Toma un minuto y puedes cambiar todo después en Ajustes.',
    nameTitle: '¿Cómo se llama tu negocio?', nameLabel: 'Nombre del negocio', namePlaceholder: 'Café La Esquina', logoLabel: 'Logo (opcional)', logoHint: 'Una imagen cuadrada se ve mejor. Aparece en el menú, el encabezado y el quiosco.', chooseLogo: 'Elegir imagen', changeLogo: 'Cambiar imagen', removeLogo: 'Quitar', logoBig: 'La imagen es demasiado grande. Prueba con una más pequeña.', logoBad: 'Ese archivo no es una imagen.',
    goalsTitle: '¿Qué debe hacer WiseShift por ti?', goalsHint: 'Puedes activar o desactivar cualquier parte después en Ajustes.', recommended: 'Recomendado', payLabel: 'También llevar tarifas por hora y estimados de pago', payHelp: 'Solo los gerentes ven el pago. Desactivado por defecto.',
    howTitle: '¿Cómo marcará entrada tu equipo?', howPhones: 'En su propio teléfono', howPhonesHelp: 'Cada persona marca desde la app y se guarda la ubicación en cada registro.', howKiosk: 'En una computadora compartida (quiosco)', howKioskHelp: 'Todos escriben un PIN en una pantalla del mostrador. No se guarda ubicación.', howBoth: 'Ambos', howBothHelp: 'Teléfonos y un quiosco en el mostrador.',
    rulesTitle: 'Reglas para marcar entrada', earlyLabel: '¿Con cuánta anticipación puede marcar entrada antes de su turno?', earlyOpt: (m) => (m === 0 ? 'Solo al empezar el turno' : `${m} minutos antes`), anywayLabel: 'Permitir marcar entrada aunque no esté en el horario', anywayHelp: 'El registro queda marcado para que lo revises.',
    payTitle: '¿Cada cuánto pagas a tu equipo?', payHint: 'Las horas y hojas de tiempo se agrupan por período de pago. Puedes cambiarlo después en Ajustes.',
    hoursTitle: '¿Cuándo abren?', hoursHint: 'La vista del día en el horario empieza y termina con estas horas.', hoursPicks: 'Crear los turnos rápidos Abrir, Cerrar y Todo el día con estas horas',
    locTitle: '¿Dónde está la tienda?', locHint: 'Opcional. Permite que un registro diga "En la tienda". Puedes hacerlo después en Ajustes.',
    hoursPrefix: 'Horario:', closedWord: 'cerrado',
    summaryTitle: 'Lo que elegiste', kioskNext: 'Siguiente: vincula el quiosco en Ajustes → Negocio → Quiosco y da un PIN a cada persona en Equipo.',
    readyTitle: 'Todo listo', readyBody: 'Ahora agrega a tu equipo para armar un horario.', addTeam: 'Agregar al equipo', toToday: 'Ir a Hoy',
    hi: (n) => `Bienvenido, ${n}`, hiBody: (b) => `Así usa ${b ?? "tu equipo"} WiseShift: ve tus turnos, marca entrada y salida, y pide tiempo libre. Primero dos cosas rápidas.`,
    notifTitle: 'Mantente al tanto', notifBody: 'Recibe un aviso cuando se publique el horario o cambie uno de tus turnos.', notifBtn: 'Elegir notificaciones',
    installTitle: 'Agrega WiseShift a tu pantalla de inicio', installBody: 'Se abre a pantalla completa, como cualquier app.', installBtn: 'Instalar', howIos: ['Abre esta página en Safari.', 'Toca Compartir abajo.', 'Toca Agregar a pantalla de inicio y luego Agregar.'],
    noticeTitle: 'Lee esto antes de marcar entrada', readyStaffTitle: 'Todo listo', readyStaffBody: 'Abre Hoy para marcar entrada. Tus turnos están en Horario.',
  },
}

// The shell: a centered card on a dimmed page, a progress line, and the step's own content.
function Shell({ w, steps, index, onBack, onNext, onSkip, nextLabel, nextDisabled, busy, page }) {
  const step = steps[index]
  const last = index === steps.length - 1
  const card = useRef(null)
  useEffect(() => {
    card.current?.focus({ preventScroll: true })
  }, [index])
  return (
    <div className={`ob ${page ? 'page' : ''}`} role="dialog" aria-modal="true" aria-label={step.title}>
      {page && <div className="ob-brand"><span aria-hidden="true"><Logo /></span>WiseShift</div>}
      <div className="ob-card" ref={card} tabIndex={-1}>
        <div className="ob-top">
          <small>{w.step(index + 1, steps.length)}</small>
          {!last && onSkip && <button type="button" className="tm-link small" onClick={onSkip}>{w.skip}</button>}
        </div>
        <div className="ob-bar" aria-hidden="true"><i style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
        <div key={index} className="ob-body">
          <h2>{step.title}</h2>
          {step.body}
        </div>
        <div className="ob-foot">
          {index > 0 ? <button type="button" className="btn btn-outline-secondary" onClick={onBack}>{w.back}</button> : <span />}
          {step.actions ?? <button type="button" className="btn btn-brand" disabled={nextDisabled || step.nextDisabled || busy} onClick={onNext}>{nextLabel ?? (last ? w.done : w.next)}</button>}
        </div>
      </div>
    </div>
  )
}

// A pressable choice with a title and a line of help (one is picked at a time).
function Choice({ on, title, help, tag, onClick }) {
  return (
    <button type="button" className="ob-choice" aria-pressed={on} onClick={onClick}>
      <b>{title}{tag && <em>{tag}</em>}</b>
      <small>{help}</small>
    </button>
  )
}

// The owner of a new business: welcome, name and logo, what to use, how people clock in, the rules, hours, done.
export function OwnerOnboarding({ data, me, lang, onTeam }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const [index, setIndex] = useState(0)
  const [name, setName] = useState(data.settings.businessName)
  const [logo, setLogo] = useState(data.settings.businessLogo)
  const [goal, setGoal] = useState('clock') // a PRESETS id
  const [pay, setPay] = useState(false)
  const [how, setHow] = useState('phones') // 'phones' | 'kiosk' | 'both'
  const [early, setEarly] = useState(data.settings.clockInEarly)
  const [anyway, setAnyway] = useState(data.settings.allowAnyway)
  const [hours, setHours] = useState(() => normalizeHours(data.settings.storeHours) ?? defaultHours()) // seven days, Sunday first
  const [picks, setPicks] = useState(true)
  const [payPeriod, setPayPeriod] = useState(data.settings.payPeriod)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef(null)

  // What the choices turn on.
  const features = (() => {
    const f = presetFeatures(PRESETS.find((p) => p.id === goal))
    if (f.timeClock) {
      f.location = how !== 'kiosk'
      f.kioskClock = how !== 'phones'
      f.payRates = pay
    } else {
      f.payRates = false
    }
    return f
  })()
  const clock = features.timeClock
  const phones = clock && features.location

  const finish = async (goTeam) => {
    setBusy(true)
    const presets = picks && !hoursProblem(hours) ? presetsFromHours(hours) : null
    const problem = await data.actions.saveSettings({
      businessName: name.trim(), businessLogo: logo, setupDone: true, features, storeHours: { days: hours },
      ...(clock ? { clockInEarly: early, allowAnyway: anyway, payPeriod } : {}),
      ...(presets ? { shiftPresets: presets } : {}),
    })
    setBusy(false)
    if (problem) return setError(String(problem))
    markSeen(me.id) // the owner has just had the welcome; no second one for staff
    if (goTeam) onTeam?.()
  }
  const skip = async () => {
    // Skipping still ends the wizard, so it doesn't come back; everything can be set in Settings.
    setBusy(true)
    await data.actions.saveSettings({ setupDone: true })
    markSeen(me.id)
    setBusy(false)
  }
  const pick = async (e) => {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    setError('')
    try {
      setLogo(await shrinkImage(chosen))
    } catch (err) {
      setError(err.message === 'big' ? w.logoBig : w.logoBad)
    }
  }
  const hoursBad = hoursProblem(hours)

  const summary = [
    PRESETS.find((p) => p.id === goal).label,
    clock && (how === 'phones' ? w.howPhones : how === 'kiosk' ? w.howKiosk : w.howBoth),
    ...hoursLines(hours, clockTime, DAY_SHORT[lang === 'es' ? 'es' : 'en'], w.closedWord).map((l) => `${w.hoursPrefix} ${l}`),
  ].filter(Boolean)

  const steps = [
    { title: w.ownerTitle, body: <p className="ob-p">{w.ownerBody}</p>, actions: <button type="button" className="btn btn-brand" onClick={() => setIndex(1)}>{w.start}</button> },
    {
      title: w.nameTitle,
      body: (
        <>
          <label className="form-label" htmlFor="ob-name">{w.nameLabel}</label>
          <input id="ob-name" className="form-control" value={name} maxLength={60} placeholder={w.namePlaceholder} autoFocus onChange={(e) => setName(e.target.value)} />
          <span className="form-label d-block mt-3">{w.logoLabel}</span>
          <div className="ob-logo">
            <span className="ob-logo-box">{logo ? <img src={logo} alt="" /> : <b>{(name.trim()[0] ?? 'W').toUpperCase()}</b>}</span>
            <div>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => file.current?.click()}>{logo ? w.changeLogo : w.chooseLogo}</button>
              {logo && <button type="button" className="tm-link small ms-3" onClick={() => setLogo('')}>{w.removeLogo}</button>}
              <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
            </div>
          </div>
          <p className="tm-muted small mt-2 mb-0">{w.logoHint}</p>
          {error && <p className="tm-error mt-2" role="alert">{error}</p>}
        </>
      ),
    },
    {
      title: w.goalsTitle,
      body: (
        <>
          <div className="ob-choices">
            {PRESETS.filter((p) => p.id !== 'all').map((p) => <Choice key={p.id} on={goal === p.id} title={p.label} help={p.help} tag={p.id === 'clock' ? w.recommended : ''} onClick={() => setGoal(p.id)} />)}
            <Choice on={goal === 'all'} title={PRESETS[2].label} help={PRESETS[2].help} onClick={() => setGoal('all')} />
          </div>
          {clock && (
            <div className="form-check mt-3">
              <input id="ob-pay" className="form-check-input" type="checkbox" checked={pay} onChange={(e) => setPay(e.target.checked)} />
              <label className="form-check-label" htmlFor="ob-pay">{w.payLabel}<br /><small className="tm-muted">{w.payHelp}</small></label>
            </div>
          )}
          <p className="tm-muted small mt-2 mb-0">{w.goalsHint}</p>
        </>
      ),
    },
    ...(clock
      ? [
          {
            title: w.howTitle,
            body: (
              <div className="ob-choices">
                <Choice on={how === 'phones'} title={w.howPhones} help={w.howPhonesHelp} onClick={() => setHow('phones')} />
                <Choice on={how === 'kiosk'} title={w.howKiosk} help={w.howKioskHelp} onClick={() => setHow('kiosk')} />
                <Choice on={how === 'both'} title={w.howBoth} help={w.howBothHelp} onClick={() => setHow('both')} />
              </div>
            ),
          },
          {
            title: w.rulesTitle,
            body: (
              <>
                <label className="form-label" htmlFor="ob-early">{w.earlyLabel}</label>
                <select id="ob-early" className="form-select" value={early} onChange={(e) => setEarly(Number(e.target.value))}>
                  {[0, 15, 30, 45, 60].map((m) => <option key={m} value={m}>{w.earlyOpt(m)}</option>)}
                </select>
                <div className="form-check mt-3">
                  <input id="ob-anyway" className="form-check-input" type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} />
                  <label className="form-check-label" htmlFor="ob-anyway">{w.anywayLabel}<br /><small className="tm-muted">{w.anywayHelp}</small></label>
                </div>
              </>
            ),
          },
        ]
      : []),
    ...(clock ? [{ title: w.payTitle, body: <><p className="ob-p">{w.payHint}</p><PayPeriodFields value={payPeriod} onChange={setPayPeriod} lang={lang} /></> }] : []),
    {
      title: w.hoursTitle,
      body: (
        <>
          <p className="ob-p">{w.hoursHint}</p>
          <StoreHoursFields value={hours} onChange={setHours} lang={lang} />
          <div className="form-check mt-3">
            <input id="ob-picks" className="form-check-input" type="checkbox" checked={picks} onChange={(e) => setPicks(e.target.checked)} />
            <label className="form-check-label" htmlFor="ob-picks">{w.hoursPicks}</label>
          </div>
        </>
      ),
      nextDisabled: hoursBad,
    },
    ...(phones ? [{ title: w.locTitle, body: <><p className="ob-p">{w.locHint}</p><ShopLocation data={data} /></> }] : []),
    {
      title: w.readyTitle,
      body: (
        <>
          <p className="ob-p">{w.readyBody}</p>
          <p className="ob-sum-h">{w.summaryTitle}</p>
          <ul className="ob-sum">{summary.map((t) => <li key={t}>{t}</li>)}</ul>
          {clock && features.kioskClock && <p className="tm-muted small">{w.kioskNext}</p>}
          {error && <p className="tm-error mt-2" role="alert">{error}</p>}
        </>
      ),
      actions: (
        <span className="ob-two">
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => finish(false)}>{w.toToday}</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={() => finish(true)}>{w.addTeam}</button>
        </span>
      ),
    },
  ]
  return <Shell page w={w} steps={steps} index={Math.min(index, steps.length - 1)} busy={busy} onBack={() => setIndex(index - 1)} onNext={() => setIndex(index + 1)} onSkip={skip} />
}

// Anyone else, the first time on this device.
export function StaffOnboarding({ data, me, lang, businessName, onNotify, onClose }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const install = useInstall()
  const features = featuresOf(data.settings)
  const [index, setIndex] = useState(0)
  const needsNotice = features.location && data.settingsReady && !noticeAcked(data.privateById[me.id], data.settings)
  const first = (me.name ?? '').split(' ')[0] || me.name
  const close = () => {
    markSeen(me.id)
    onClose()
  }

  const steps = [
    { title: w.hi(first), body: <p className="ob-p">{w.hiBody(businessName && businessName.trim() && businessName.trim().toLowerCase() !== 'wiseshift' ? businessName.trim() : null)}</p> },
    {
      title: w.notifTitle,
      body: <><p className="ob-p">{w.notifBody}</p><button type="button" className="btn btn-outline-secondary" onClick={onNotify}>{w.notifBtn}</button></>,
    },
    ...(install.how
      ? [{
          title: w.installTitle,
          body: (
            <>
              <p className="ob-p">{w.installBody}</p>
              {install.how === 'prompt' ? <button type="button" className="btn btn-outline-secondary" onClick={install.install}>{w.installBtn}</button> : <ol className="app-how">{w.howIos.map((t) => <li key={t}>{t}</li>)}</ol>}
            </>
          ),
        }]
      : []),
    ...(needsNotice ? [{ title: w.noticeTitle, body: <LocationNotice data={data} me={me} /> }] : []),
    { title: w.readyStaffTitle, body: <p className="ob-p">{w.readyStaffBody}</p>, actions: <button type="button" className="btn btn-brand" onClick={close}>{w.done}</button> },
  ]
  return <Shell w={w} steps={steps} index={index} onBack={() => setIndex(index - 1)} onNext={() => setIndex(index + 1)} onSkip={close} />
}
