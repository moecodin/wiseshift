import { describeSpot, mapUrl } from './location.js'
import { useFeature } from './features.js'

// Spanish for the place labels (⚙️ Settings → Language).
const toSpanish = (label) =>
  label === 'At the shop' ? 'En la tienda' : label === 'Location saved' ? 'Ubicación guardada' : label.replace(/ away$/, ' de distancia')

// A punch's place: "📍 At the shop" or "📍 2.3 mi away", opening the map.
export default function SpotTag({ spot, shop, prefix = '', lang = 'en' }) {
  const on = useFeature('location')
  if (!on) return null
  const { label, far, missing } = describeSpot(spot, shop)
  if (missing) return <span className="tm-spot missing" title="The phone didn't share its location">{prefix}{lang === 'es' ? 'Sin ubicación' : 'No location'}</span>
  return (
    <a
      className={`tm-spot ${far ? 'far' : ''}`}
      href={mapUrl(spot)}
      target="_blank"
      rel="noreferrer"
      title={spot.accuracy ? `Accurate to about ${Math.round(spot.accuracy * 3.281)} ft. Open the map` : 'Open the map'}
    >
      📍 {prefix}{lang === 'es' ? toSpanish(label) : label}
    </a>
  )
}
