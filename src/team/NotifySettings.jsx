import { useEffect, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { pushIsOn, pushSupport, tellPush, turnOffPush, turnOnPush } from './app.js'
import { clockTime } from './format.js'
import { tr } from './i18n.js'

// The kinds of notifications (send-push function, update 017).
// Everyone gets the first seven; managers also get the last three.
const KINDS = [
  { id: 'published', get label() { return tr('New schedule published', 'Horario nuevo publicado') }, get example() { return tr('“Your schedule for Oct 25–31 is up: 3 shifts, 24 hrs”', '“Tu horario del 25 al 31 de oct ya está: 3 turnos, 24 hrs”') } },
  { id: 'changed', get label() { return tr('My shift changed or was removed', 'Mi turno cambió o se quitó') }, get example() { return tr('“Your Tue shift changed: now 8 AM – 2 PM”', '“Tu turno del martes cambió: ahora 8 AM – 2 PM”') } },
  { id: 'timeoff', get label() { return tr('Time off approved or declined', 'Ausencia aprobada o rechazada') }, get example() { return tr('“Time off approved: Nov 12–14”', '“Ausencia aprobada: 12–14 de nov”') } },
  { id: 'shift', label: (t) => tr(`Shift reminder, ${t.remindBefore} min before`, `Recordatorio de turno, ${t.remindBefore} min antes`), get example() { return tr('“Shift at 8:00 AM. Don’t forget to clock in!”', '“Turno a las 8:00 AM. ¡No olvides marcar entrada!”') } },
  { id: 'stillin', get label() { return tr('Still clocked in after my shift', 'Sigo con entrada marcada después de mi turno') }, get example() { return tr('“Your shift ended at 2:00 PM. Clock out if you’re done.”', '“Tu turno terminó a las 2:00 PM. Marca salida si ya terminaste.”') } },
  { id: 'request', get label() { return tr('Time-off requests', 'Solicitudes de ausencia') }, get example() { return tr('“Sam asked for Nov 12–14 off”', '“Sam pidió libre del 12 al 14 de nov”') }, managers: true },
  { id: 'away', get label() { return tr('Clocked in away from the shop', 'Marcó entrada lejos del negocio') }, get example() { return tr('“Sam clocked in 2.0 mi away”', '“Sam marcó entrada a 2.0 mi”') }, managers: true },
  { id: 'late', label: (t) => tr(`Someone hasn’t clocked in, ${t.lateAfter} min into a shift`, `Alguien no ha marcado entrada, ${t.lateAfter} min después de empezar el turno`), get example() { return tr('“Maria hasn’t clocked in for the 8:00 AM shift”', '“Maria no ha marcado entrada para el turno de las 8:00 AM”') }, managers: true },
]

// 🔔 Turn notifications on or off for this phone, and choose which kinds.
export default function NotifySettings({ data, boss, onClose }) {
  return (
    <Modal title={tr('Notifications', 'Notificaciones')} onClose={onClose}>
      <NotifyOptions data={data} boss={boss} />
    </Modal>
  )
}

// The same, inside ⚙️ Settings.
export function NotifyOptions({ data, boss }) {
  const support = pushSupport()
  const [on, setOn] = useState(null) // null while checking
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const off = data.pushOff ?? []

  useEffect(() => {
    let alive = true
    pushIsOn().then((yes) => alive && setOn(yes), () => alive && setOn(false))
    return () => {
      alive = false
    }
  }, [])

  const toggleThisPhone = async () => {
    setBusy(true)
    setMessage('')
    const problem = on ? await turnOffPush() : await turnOnPush()
    setBusy(false)
    if (problem === 'blocked') setMessage('Notifications are blocked for this app. Turn them on in your phone’s Settings → Notifications → RI Sched (or the browser), then try again.')
    else if (problem) setMessage(problem)
    else setOn(!on)
  }
  const test = async () => {
    setMessage(tr('Sending…', 'Enviando…'))
    const result = await tellPush('test')
    setMessage(result?.sent ? tr('Sent! It should arrive in a few seconds.', '¡Enviada! Debe llegar en unos segundos.') : result?.error ? tr(`Couldn’t send: ${result.error}`, `No se pudo enviar: ${result.error}`) : tr('Nothing was sent. Is this phone turned on above?', 'No se envió nada. ¿Está activado este teléfono arriba?'))
  }
  const toggleKind = (id) => data.actions.setPushOff(off.includes(id) ? off.filter((k) => k !== id) : [...off, id])

  return (
    <>
      {support === 'install-first' && (
        <p className="tm-warn">{tr("On iPhone, notifications only work in the installed app. Add", "En iPhone, las notificaciones solo funcionan en la app instalada. Agrega")} <b>WiseShift</b> {tr("to your home screen (Safari → Share → Add to Home Screen), open it from the", "a tu pantalla de inicio (Safari → Compartir → Agregar a pantalla de inicio), ábrela desde el")} <b>RI Sched</b> {tr("icon, then come back here.", "ícono y vuelve aquí.")}</p>
      )}
      {support === 'blocked' && <p className="tm-warn">{tr("Notifications are blocked for this app. Turn them on in your phone’s settings, then come back here.", "Las notificaciones están bloqueadas para esta app. Actívalas en los ajustes de tu teléfono y vuelve aquí.")}</p>}
      {support === 'unsupported' && <p className="tm-warn">{tr("This phone or browser can’t get notifications. On iPhone, update to iOS 16.4 or newer.", "Este teléfono o navegador no puede recibir notificaciones. En iPhone, actualiza a iOS 16.4 o más nuevo.")}</p>}
      {support === 'not-ready' && <p className="tm-muted small">{tr("Notifications work on the live site (your WiseShift site), not while trying things out here.", "Las notificaciones funcionan en el sitio real (tu sitio de WiseShift), no mientras pruebas aquí.")}</p>}

      {support === 'ok' && (
        <div className="nt-phone">
          <div>
            <b>{tr("This phone", "Este teléfono")}</b>
            <small>{on === null ? tr('Checking…', 'Revisando…') : on ? tr('Notifications are on', 'Notificaciones activadas') : tr('Notifications are off', 'Notificaciones apagadas')}</small>
          </div>
          <button type="button" className={`btn ${on ? 'btn-outline-secondary' : 'btn-brand'}`} disabled={busy || on === null} onClick={toggleThisPhone}>
            {busy ? '…' : on ? tr('Turn off', 'Apagar') : tr('🔔 Turn on', '🔔 Activar')}
          </button>
        </div>
      )}
      {on && <button type="button" className="tm-link small" onClick={test}>{tr("Send me a test notification", "Enviarme una notificación de prueba")}</button>}
      {message && <p className="tm-msg small mt-2" role="status">{message}</p>}

      <h3 className="tm-h3">{tr("What to tell me about", "Avisarme de")}</h3>
      <div className="nt-kinds">
        {KINDS.filter((k) => !k.managers || boss).map((k) => (
          <label key={k.id} className="form-check form-switch nt-kind">
            <input type="checkbox" className="form-check-input" checked={!off.includes(k.id)} onChange={() => toggleKind(k.id)} />
            <span>
              {typeof k.label === 'function' ? k.label(data.settings) : k.label}
              <small>{k.example}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="tm-muted small mt-3 mb-0">
        {tr(`Quiet hours ${clockTime(data.settings.quietFrom)} – ${clockTime(data.settings.quietTo)}: nothing buzzes then except “still clocked in”. Other news waits until ${clockTime(data.settings.quietTo)}.`, `Horas de silencio ${clockTime(data.settings.quietFrom)} – ${clockTime(data.settings.quietTo)}: nada suena entonces excepto “sigue con entrada marcada”. Lo demás espera hasta las ${clockTime(data.settings.quietTo)}.`)}
      </p>
    </>
  )
}
