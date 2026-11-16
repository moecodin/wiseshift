// Where someone clocked in or out (supabase/updates/014-clock-location.sql).
// The phone's location is asked for only at the moment of clocking in or out.

const ASK_MS = 12000 // give the phone this long to find where it is

// The phone's location: { lat, lng, accuracy } or { error } when it can't or
// isn't allowed. Never fails, so clocking in still works without it.
export function currentSpot() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: 'unsupported' })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => resolve({ error: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: ASK_MS, maximumAge: 30000 },
    )
  })
}

// The street address at a place ("542 Main St"), from OpenStreetMap, or '' if
// it can't be found quickly. Only asked once per clock-in or clock-out.
export async function streetAddress(spot, waitMs = 4000) {
  if (spot?.lat == null) return ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), waitMs)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${spot.lat}&lon=${spot.lng}`
    const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return ''
    const { address: a = {}, display_name: full = '' } = await res.json()
    const street = [a.house_number, a.road].filter(Boolean).join(' ')
    const town = a.village || a.town || a.city || a.hamlet || a.suburb || ''
    return (street ? [street, town].filter(Boolean).join(', ') : full.split(',').slice(0, 2).join(',')).slice(0, 200)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

// Places matching a typed address, from OpenStreetMap: up to 5 of
// { lat, lng, label }, or null if the search didn't work. Only searched when
// someone presses Find (OpenStreetMap asks for no searching on every keystroke).
export async function findAddress(text) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&addressdetails=1&q=${encodeURIComponent(text)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return null
    return (await res.json()).map((r) => {
      const a = r.address ?? {}
      const street = [a.house_number, a.road].filter(Boolean).join(' ')
      const town = a.village || a.town || a.city || a.hamlet || a.suburb || ''
      const label = street ? [street, town, a.state, a.postcode].filter(Boolean).join(', ') : r.display_name
      return { lat: Number(r.lat), lng: Number(r.lon), label: label.slice(0, 200) }
    })
  } catch {
    return null
  }
}

// Meters between two places (haversine).
export function metersBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export const mapUrl = (spot) => `https://www.google.com/maps?q=${spot.lat},${spot.lng}`

// How a punch's place reads on the page: "At the shop", "2.3 mi away", or
// "No location". `far` marks anything outside the shop's circle.
export function describeSpot(spot, shop) {
  if (!spot) return { label: 'No location', far: true, missing: true }
  if (!shop) return { label: 'Location saved', far: false }
  const meters = metersBetween(spot, shop)
  // A phone that isn't sure where it is still counts as at the shop if its
  // circle of uncertainty reaches the shop's circle.
  if (meters <= shop.radius + Math.min(spot.accuracy ?? 0, 300)) return { label: 'At the shop', far: false }
  const miles = meters / 1609.344
  return { label: miles < 0.1 ? `${Math.round(meters * 3.281)} ft away` : `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`, far: true }
}
