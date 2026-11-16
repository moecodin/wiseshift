import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import TeamApp from './team/TeamApp.jsx'
import { setUpTeamApp } from './team/app.js'

// WiseShift is one page that works wherever it is hosted (a site's main address
// or a sub-folder like GitHub Pages).
setUpTeamApp()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TeamApp />
  </StrictMode>,
)
