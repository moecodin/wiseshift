import { useEffect, useRef, useState } from 'react'
import { useInstall } from './app.js'
import { featuresOf } from './features.js'
import { noticeAcked } from './settings.js'
import { LocationNotice } from './SettingsPanel.jsx'
import { markSeen, shrinkImage } from './onboardingHelpers.js'

// First-run wizards. A new business owner sees one short wizard (welcome, the business's name and logo, done);
// everyone else sees a short welcome once on their own device (notifications, home screen, the location notice).
// Every step can be skipped, and the owner wizard can be run again from Settings.

const WORDS = {
  en: {
    step: (n, total) => `Step ${n} of ${total}`, next: 'Next', back: 'Back', skip: 'Skip for now', done: 'Done', start: 'Get started',
    ownerTitle: 'Welcome to WiseShift', ownerBody: "Let's set up your business. It takes about a minute, and you can change everything later in Settings.",
    nameTitle: "What's your business called?", nameLabel: 'Business name', namePlaceholder: 'Corner Coffee', logoLabel: 'Logo (optional)', logoHint: 'A square image works best. It shows in the menu, the header and on the kiosk.', chooseLogo: 'Choose image', changeLogo: 'Change image', removeLogo: 'Remove', logoBig: 'That image is too large. Try a smaller one.', logoBad: "That file isn't an image.",
    readyTitle: "You're all set", readyBody: 'Next, add your team so you can build a schedule.', addTeam: 'Add your team', toToday: 'Go to Today',
    hi: (n) => `Welcome, ${n}`, hiBody: (b) => `Here is how ${b} uses WiseShift: see your shifts, clock in and out, and ask for time off. Two quick things first.`,
    notifTitle: 'Stay in the loop', notifBody: 'Get a nudge when the schedule is published or one of your shifts changes.', notifBtn: 'Choose notifications',
    installTitle: 'Add WiseShift to your home screen', installBody: 'It opens full screen, like any other app.', installBtn: 'Install', howIos: ['Open this page in Safari.', 'Tap Share at the bottom.', 'Tap Add to Home Screen, then Add.'],
    noticeTitle: 'Please read before clocking in', readyStaffTitle: "You're ready", readyStaffBody: 'Open Today any time to clock in. Your shifts are under Schedule.',
  },
  es: {
    step: (n, total) => `Paso ${n} de ${total}`, next: 'Siguiente', back: 'Atrás', skip: 'Omitir por ahora', done: 'Listo', start: 'Empezar',
    ownerTitle: 'Bienvenido a WiseShift', ownerBody: 'Vamos a configurar tu negocio. Toma un minuto y puedes cambiar todo después en Ajustes.',
    nameTitle: '¿Cómo se llama tu negocio?', nameLabel: 'Nombre del negocio', namePlaceholder: 'Café La Esquina', logoLabel: 'Logo (opcional)', logoHint: 'Una imagen cuadrada se ve mejor. Aparece en el menú, el encabezado y el quiosco.', chooseLogo: 'Elegir imagen', changeLogo: 'Cambiar imagen', removeLogo: 'Quitar', logoBig: 'La imagen es demasiado grande. Prueba con una más pequeña.', logoBad: 'Ese archivo no es una imagen.',
    readyTitle: 'Todo listo', readyBody: 'Ahora agrega a tu equipo para armar un horario.', addTeam: 'Agregar al equipo', toToday: 'Ir a Hoy',
    hi: (n) => `Bienvenido, ${n}`, hiBody: (b) => `Así usa ${b} WiseShift: ve tus turnos, marca entrada y salida, y pide tiempo libre. Primero dos cosas rápidas.`,
    notifTitle: 'Mantente al tanto', notifBody: 'Recibe un aviso cuando se publique el horario o cambie uno de tus turnos.', notifBtn: 'Elegir notificaciones',
    installTitle: 'Agrega WiseShift a tu pantalla de inicio', installBody: 'Se abre a pantalla completa, como cualquier app.', installBtn: 'Instalar', howIos: ['Abre esta página en Safari.', 'Toca Compartir abajo.', 'Toca Agregar a pantalla de inicio y luego Agregar.'],
    noticeTitle: 'Lee esto antes de marcar entrada', readyStaffTitle: 'Todo listo', readyStaffBody: 'Abre Hoy para marcar entrada. Tus turnos están en Horario.',
  },
}

// The shell: a centered card on a dimmed page, a progress line, and the step's own content.
function Shell({ w, steps, index, onBack, onNext, onSkip, nextLabel, nextDisabled, busy }) {
  const step = steps[index]
  const last = index === steps.length - 1
  const card = useRef(null)
  useEffect(() => {
    card.current?.focus({ preventScroll: true })
  }, [index])
  return (
    <div className="ob" role="dialog" aria-modal="true" aria-label={step.title}>
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
          {step.actions ?? <button type="button" className="btn btn-brand" disabled={nextDisabled || busy} onClick={onNext}>{nextLabel ?? (last ? w.done : w.next)}</button>}
        </div>
      </div>
    </div>
  )
}

// The owner of a new business: welcome, name and logo, done.
export function OwnerOnboarding({ data, me, lang, onTeam }) {
  const w = WORDS[lang === 'es' ? 'es' : 'en']
  const [index, setIndex] = useState(0)
  const [name, setName] = useState(data.settings.businessName)
  const [logo, setLogo] = useState(data.settings.businessLogo)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef(null)

  const finish = async (goTeam) => {
    setBusy(true)
    const problem = await data.actions.saveSettings({ businessName: name.trim(), businessLogo: logo, setupDone: true })
    setBusy(false)
    if (problem) return setError(String(problem))
    markSeen(me.id) // the owner has just had the welcome; no second one for staff
    if (goTeam) onTeam?.()
  }
  const skip = async () => {
    // Skipping still ends the wizard, so it doesn't come back; the name and logo can be set in Settings.
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
      title: w.readyTitle,
      body: <><p className="ob-p">{w.readyBody}</p>{error && <p className="tm-error mt-2" role="alert">{error}</p>}</>,
      actions: (
        <span className="ob-two">
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => finish(false)}>{w.toToday}</button>
          <button type="button" className="btn btn-brand" disabled={busy} onClick={() => finish(true)}>{w.addTeam}</button>
        </span>
      ),
    },
  ]
  return <Shell w={w} steps={steps} index={index} busy={busy} onBack={() => setIndex(index - 1)} onNext={() => setIndex(index + 1)} onSkip={skip} />
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
    { title: w.hi(first), body: <p className="ob-p">{w.hiBody(businessName)}</p> },
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
