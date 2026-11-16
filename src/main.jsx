import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import TeamApp from './team/TeamApp.jsx'
import { setUpTeamApp } from './team/app.js'

// WiseShift lives at /team (the installable app). Any other address goes there.
if (window.location.pathname.replace(/\/+$/, '') !== '/team') window.location.replace('/team')
else setUpTeamApp()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TeamApp />
  </StrictMode>,
)
