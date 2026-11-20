// Settings → Business → Kiosk (managers): pair the store computer with a short code, choose
// how its screen looks, and remove it. The computer types the code once at <site>/kiosk.
import { useCallback, useEffect, useState } from 'react'
import { kioskAddress, listKioskDevices, newKioskPairing, repairKioskDevice, revokeKioskDevice, setKioskTheme } from './kioskApi.js'
import { tr } from './i18n.js'

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never used')
const clockOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const NO_DB = "The kiosk isn't in the database yet (update 025)."

export default function KioskSettings() {
  const [devices, setDevices] = useState([])
  const [name, setName] = useState('')
  const [pairing, setPairing] = useState(null) // { code, expiresAt, name }: shown once, right after asking
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState(null)

  const load = useCallback(async () => {
    const r = await listKioskDevices()
    setDevices(r.devices)
    if (r.error) setError(/kiosk_devices|schema cache|paired_at|pair_expires/.test(r.error) ? NO_DB : r.error)
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const show = (r, label) => {
    if (r.error) return setError(/new_kiosk_pairing|repair_kiosk_device|schema cache/.test(r.error) ? NO_DB : r.error)
    setPairing({ code: r.code, expiresAt: r.expiresAt, name: label })
    load()
  }
  const add = async () => {
    if (!name.trim()) return setError('Name the computer, like "Front counter".')
    setBusy(true)
    setError('')
    const r = await newKioskPairing(name.trim())
    setBusy(false)
    if (!r.error) setName('')
    show(r, name.trim())
  }
  const again = async (d) => {
    setBusy(true)
    setError('')
    const r = await repairKioskDevice(d.id)
    setBusy(false)
    show(r, d.name)
  }
  const changeTheme = async (id, theme) => {
    const problem = await setKioskTheme(id, theme)
    if (problem) setError(/set_kiosk_theme|schema cache|theme/.test(problem) ? 'Kiosk themes need the latest update 025 in the database.' : problem)
    load()
  }
  const revoke = async (id) => {
    const problem = await revokeKioskDevice(id)
    setRevoking(null)
    if (problem) setError(problem)
    load()
  }
  const status = (d) => {
    if (d.paired) return `Paired · last used ${when(d.lastUsedAt)}`
    return d.pairExpiresAt && new Date(d.pairExpiresAt) > new Date() ? `Waiting for pairing (code good until ${clockOf(d.pairExpiresAt)})` : 'Code expired. Get a new one'
  }

  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Kiosk", "Quiosco")}</h3>
      <p className="tm-muted small">
        A shared store computer or tablet where people clock in with their PIN. Tap Pair a computer, then open the kiosk address on that computer and type the code once. Set each person's PIN in Team. Clocking in uses the same early window as the phone.
      </p>
      {devices.length > 0 && (
        <ul className="list-unstyled mb-2">
          {devices.map((d) => (
            <li key={d.id} className="d-flex align-items-center gap-2 py-1 flex-wrap">
              <span className="me-auto"><b>{d.name}</b> <small className="tm-muted">· {status(d)}</small></span>
              <label className="visually-hidden" htmlFor={`ks-theme-${d.id}`}>Look of {d.name}</label>
              <select id={`ks-theme-${d.id}`} className="form-select form-select-sm" style={{ width: 'auto' }} value={d.theme} onChange={(e) => changeTheme(d.id, e.target.value)}>
                <option value="auto">{tr("Auto (follows the computer)", "Automático (igual que la computadora)")}</option>
                <option value="light">{tr("Light", "Claro")}</option>
                <option value="dark">{tr("Dark", "Oscuro")}</option>
              </select>
              {revoking === d.id ? (
                <>
                  <small>{tr("Stop this computer?", "¿Desactivar esta computadora?")}</small>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRevoking(null)}>{tr("Keep", "Mantener")}</button>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => revoke(d.id)}>{tr("Remove", "Quitar")}</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => again(d)}>{tr("New code", "Código nuevo")}</button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRevoking(d.id)}>{tr("Remove", "Quitar")}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="d-flex gap-2 flex-wrap">
        <label className="visually-hidden" htmlFor="ks-name">{tr("Computer name", "Nombre de la computadora")}</label>
        <input id="ks-name" className="form-control" style={{ maxWidth: 260 }} placeholder="Front counter" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={add}>{tr("Pair a computer", "Vincular una computadora")}</button>
      </div>
      {pairing && (
        <div className="mt-2" role="status">
          <p className="small mb-1">
            On <b>{pairing.name}</b>{tr(", open", ", abre")} <b>{kioskAddress()}</b> and type this code. It is shown only once and works until {clockOf(pairing.expiresAt)}.
          </p>
          <p className="mb-0" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.12em' }}>{pairing.code}</p>
        </div>
      )}
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </section>
  )
}
