import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import TeamApp from './team/TeamApp.jsx'
import { setUpTeamApp } from './team/app.js'
import KioskPage from './team/KioskPage.jsx'

// WiseShift is one page that works wherever it is hosted (a site's main address
// or a sub-folder like GitHub Pages).
setUpTeamApp()

// A kiosk computer opens the kiosk link (?kiosk=...): no sign-in, just the PIN screen.
const kiosk = new URLSearchParams(location.search).has('kiosk')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {kiosk ? <KioskPage /> : <TeamApp />}
  </StrictMode>,
)
