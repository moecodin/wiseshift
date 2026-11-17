import { describeSpot, mapUrl } from './location.js'
import { useFeature } from './features.js'

// Spanish for the place labels (⚙️ Settings → Language).
const toSpanish = (label) =>
  label === 'At the shop' ? 'En la tienda' : label === 'Location saved' ? 'Ubicación guardada' : label.replace(/ away$/, ' de distancia')

// A punch's place: "At the shop" or "2.3 mi away", opening the map. On busy cards
// (quiet) the ordinary "At the shop" is left out and only a punch that was away from the shop,
// or had no location, still shows. The punch details always show everything.
export default function SpotTag({ spot, shop, prefix = '', lang = 'en', quiet = false }) {
  const on = useFeature('location')
  if (!on) return null
  const { label, far, missing } = describeSpot(spot, shop)
  if (quiet && !far && !missing) return null
  if (missing) return <span className="tm-spot missing" title="The phone didn't share its location">{prefix}{lang === 'es' ? 'Sin ubicación' : 'No location'}</span>
  return (
    <a
      className={`tm-spot ${far ? 'far' : ''}`}
      href={mapUrl(spot)}
      target="_blank"
      rel="noreferrer"
      title={spot.accuracy ? `Accurate to about ${Math.round(spot.accuracy * 3.281)} ft. Open the map` : 'Open the map'}
    >
      {prefix}{lang === 'es' ? toSpanish(label) : label}
    </a>
  )
}
