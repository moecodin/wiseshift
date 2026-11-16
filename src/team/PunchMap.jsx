import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// A small map with where someone clocked in (green) and out (red), and the shop's
// circle. OpenStreetMap tiles. Loaded only when a punch's details are opened.
export default function PunchMap({ inSpot, outSpot, shop }) {
  const box = useRef(null)

  useEffect(() => {
    const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    const points = []
    if (shop) {
      L.circle([shop.lat, shop.lng], { radius: shop.radius, color: '#0d2e43', weight: 1, fillOpacity: 0.08 }).addTo(map).bindTooltip('The shop')
      points.push([shop.lat, shop.lng])
    }
    const pin = (spot, color, label) => {
      if (!spot) return
      L.circleMarker([spot.lat, spot.lng], { radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 }).addTo(map).bindTooltip(label)
      points.push([spot.lat, spot.lng])
    }
    pin(inSpot, '#2e9e4f', 'Clocked in')
    pin(outSpot, '#e2262c', 'Clocked out')
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 18 })
    else if (points.length) map.setView(points[0], 17)
    return () => map.remove()
  }, [inSpot, outSpot, shop])

  return <div ref={box} className="tm-map" role="img" aria-label="Map of where they clocked in and out" />
}
