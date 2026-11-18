import { useEffect, useState } from 'react'
import { useInstall, useNewVersion, useOnline } from './app.js'

const HIDE_KEY = 'wiseshift-install-hidden'

// Under the tabs: "You're offline", "New version: tap to refresh", and
// "Install WiseShift" (until it's installed or they tap Not now).
export default function AppBanners() {
  const online = useOnline()
  const fresh = useNewVersion()
  const install = useInstall()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [showHow, setShowHow] = useState(false)
  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDE_KEY, '1')
    } catch {
      // Not important if this can't be saved.
    }
  }

  return (
    <>
      {!online && <div className="app-banner off" role="status"><span aria-hidden="true">📡</span> You’re offline. Clock in and out once you have signal.</div>}
      {fresh && (
        <button type="button" className="app-banner new" onClick={() => window.location.reload()}>
          ✨ New version of WiseShift. <u>Tap to refresh</u>
        </button>
      )}
      {install.how && !hidden && (
        <div className="app-banner install">
          <img src={`${import.meta.env.BASE_URL}app/icon-192.png`} alt="" width="36" height="36" />
          <div>
            <b>Get the WiseShift app</b>
            <small>Opens full screen from your home screen.</small>
          </div>
          {install.how === 'prompt' ? (
            <button type="button" className="btn btn-brand btn-sm" onClick={install.install}>Install</button>
          ) : (
            <button type="button" className="btn btn-brand btn-sm" onClick={() => setShowHow(!showHow)}>How?</button>
          )}
          <button type="button" className="app-banner-x" aria-label="Not now" onClick={hide}>×</button>
          {showHow && (
            <ol className="app-how">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap <b>Share</b> <span aria-hidden="true">⬆︎</span> at the bottom.</li>
              <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
            </ol>
          )}
        </div>
      )}
    </>
  )
}
