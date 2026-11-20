import { useState } from 'react'
import { currentSpot, findAddress, mapUrl, streetAddress } from './location.js'
import { tr } from './i18n.js'

// Where the shop is, so punches can say "At the shop" or how far away they were.
// Type the address, or stand in the shop and use the phone's location.
export default function ShopLocation({ data }) {
  const shop = data.shop
  const [radius, setRadius] = useState(shop?.radius ?? 152.4)
  const [busy, setBusy] = useState('') // 'here' or 'find' while working
  const [typed, setTyped] = useState('')
  const [found, setFound] = useState(null) // search results to pick from
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const save = async (place) => {
    const problem = await data.actions.saveShop({ ...place, radius: Math.max(25, Number(radius) || 152.4) })
    if (problem) setError(problem.includes('team_settings') ? 'Run supabase/updates/014-clock-location.sql in Supabase first.' : problem)
    else setMessage('Saved.')
  }
  const start = (what) => {
    setBusy(what)
    setError('')
    setMessage('')
    setFound(null)
  }
  const useHere = async () => {
    start('here')
    const here = await currentSpot()
    if (here.error) {
      setBusy('')
      return setError(here.error === 'denied' ? 'This browser isn\'t allowed to see your location. Allow it in the browser settings and try again.' : "Couldn't find where you are. Try again.")
    }
    const address = await streetAddress(here)
    setBusy('')
    await save({ lat: here.lat, lng: here.lng, address })
    if (here.accuracy > 100) setMessage(`Saved, but only accurate to about ${Math.round(here.accuracy * 3.281)} ft. A phone outside or by a window does better.`)
  }
  const find = async (e) => {
    e.preventDefault()
    if (typed.trim().length < 5) return setError('Type the street address, town and state.')
    start('find')
    const places = await findAddress(typed.trim())
    setBusy('')
    if (places === null) return setError("Couldn't search right now. Try again in a minute.")
    if (!places.length) return setError('No match. Check the spelling, or add the town and ZIP code.')
    setFound(places)
  }
  const pick = async (place) => {
    setFound(null)
    setTyped('')
    await save({ lat: place.lat, lng: place.lng, address: place.label })
  }

  return (
    <section className="st-section">
      <h3 className="tm-h3">{tr("Shop location", "Ubicación del negocio")}</h3>
      {shop ? (
        <p className="mb-2">
          {shop.address && (
            <>
              <b>{shop.address}</b>
              <br />
            </>
          )}
          {tr('Punches within', 'Los registros a menos de')} <b>{Math.round(shop.radius * 3.281)} {tr('ft', 'pies')}</b> {tr('show as “At the shop”.', 'aparecen como “En el negocio”.')}{' '}
          <a href={mapUrl(shop)} target="_blank" rel="noreferrer">{tr("Check the pin on the map", "Revisa el punto en el mapa")}</a>
        </p>
      ) : (
        <p className="tm-muted mb-2">{tr("Not set yet. Type the shop's address, or stand in the shop and use your phone's location.", "Aún no está configurado. Escribe la dirección del negocio o párate en el negocio y usa la ubicación de tu teléfono.")}</p>
      )}
      <form className="d-flex gap-2 mb-2" onSubmit={find}>
        <input className="form-control form-control-sm" aria-label="Shop address" placeholder="e.g. 100 Main St, Springfield…" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button type="submit" className="btn btn-brand btn-sm text-nowrap" disabled={Boolean(busy)}>{busy === 'find' ? 'Finding…' : 'Find'}</button>
      </form>
      {found && (
        <div className="st-found" role="listbox" aria-label="Pick the shop">
          <small className="tm-muted">{tr("Pick the right one:", "Elige la correcta:")}</small>
          {found.map((p) => (
            <button key={`${p.lat},${p.lng}`} type="button" className="st-found-opt" onClick={() => pick(p)}>{p.label}</button>
          ))}
          <button type="button" className="tm-link small" onClick={() => setFound(null)}>{tr("None of these", "Ninguna de estas")}</button>
        </div>
      )}
      <div className="d-flex flex-wrap align-items-end gap-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={Boolean(busy)} onClick={useHere}>
          {busy === 'here' ? 'Finding you…' : 'Or use where I am now'}
        </button>
        <label className="small">
          {tr('“At the shop” within (ft)', '“En el negocio” a menos de (pies)')}
          <input
            type="number"
            min="80"
            step="50"
            className="form-control form-control-sm"
            value={Math.round(radius * 3.281)}
            onChange={(e) => setRadius((Number(e.target.value) || 0) / 3.281)}
            onBlur={() => shop && save(shop)}
          />
        </label>
      </div>
      <p className="tm-muted small mt-2 mb-0">{tr("A typed address puts the pin on the street, which can be off by a few houses. Check the pin, and if it’s off, use “where I am now” from inside the shop.", "Una dirección escrita pone el punto en la calle, que puede quedar a unas casas. Revisa el punto y, si está mal, usa “donde estoy ahora” desde dentro del negocio.")}</p>
      {message && <p className="tm-msg small mt-2 mb-0" role="status">{message}</p>}
      {error && <p className="tm-error small mt-2 mb-0" role="alert">{error}</p>}
    </section>
  )
}
