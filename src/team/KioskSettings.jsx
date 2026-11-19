// Settings → Business → Kiosk (managers): register the store computer and copy its one-time link.
import { useCallback, useEffect, useState } from 'react'
import { addKioskDevice, kioskLink, listKioskDevices, revokeKioskDevice } from './kioskApi.js'

const lastSeen = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never used')

export default function KioskSettings() {
  const [devices, setDevices] = useState([])
  const [name, setName] = useState('')
  const [link, setLink] = useState('') // shown once, right after adding
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState(null)

  const load = useCallback(async () => {
    const r = await listKioskDevices()
    setDevices(r.devices)
    if (r.error) setError(/kiosk_devices|schema cache/.test(r.error) ? "The kiosk isn't in the database yet (update 025)." : r.error)
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const add = async () => {
    if (!name.trim()) return setError('Name the computer, like "Front counter".')
    setBusy(true)
    setError('')
    const r = await addKioskDevice(name.trim())
    setBusy(false)
    if (r.error) return setError(/new_kiosk_device|schema cache/.test(r.error) ? "The kiosk isn't in the database yet (update 025)." : r.error)
    setLink(kioskLink(r.token))
    setCopied(false)
    setName('')
    load()
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      document.getElementById('ks-link')?.select()
    }
  }
  const revoke = async (id) => {
    const problem = await revokeKioskDevice(id)
    setRevoking(null)
    if (problem) setError(problem)
    load()
  }

  return (
    <section className="st-section">
      <h3 className="tm-h3">Kiosk</h3>
      <p className="tm-muted small">
        A shared store computer or tablet where people clock in with their PIN. Add the computer here, open the link once on it, and set each person's PIN in Team. Clocking in uses the same early window as the phone.
      </p>
      {devices.length > 0 && (
        <ul className="list-unstyled mb-2">
          {devices.map((d) => (
            <li key={d.id} className="d-flex align-items-center gap-2 py-1">
              <span className="me-auto"><b>{d.name}</b> <small className="tm-muted">· {lastSeen(d.lastUsedAt)}</small></span>
              {revoking === d.id ? (
                <>
                  <small>Stop this computer?</small>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRevoking(null)}>Keep</button>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => revoke(d.id)}>Remove</button>
                </>
              ) : (
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRevoking(d.id)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="d-flex gap-2 flex-wrap">
        <label className="visually-hidden" htmlFor="ks-name">Computer name</label>
        <input id="ks-name" className="form-control" style={{ maxWidth: 260 }} placeholder="Front counter" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={add}>Add kiosk</button>
      </div>
      {link && (
        <div className="mt-2">
          <p className="small mb-1"><b>Open this link on the store computer.</b> It is shown only once.</p>
          <div className="d-flex gap-2">
            <input id="ks-link" className="form-control" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      )}
      {error && <p className="tm-error mt-2" role="alert">{error}</p>}
    </section>
  )
}
