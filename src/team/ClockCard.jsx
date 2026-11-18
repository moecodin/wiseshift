import { useState } from 'react'
import { dateKey } from '../lib/dates.js'
import { punchMinutes } from './paycheck.js'
import { useNow } from './format.js'
import { currentSpot, streetAddress } from './location.js'
import { useFeatures } from './features.js'
import { MyPunchNotes } from './PunchNotes.jsx'
import { Countdown } from './TodayExtras.jsx'
import ClockHero from './themes/ClockHero.jsx'
import { dayName, say } from './words.js'

// The clock card: the time, the status, and the round press-and-hold button to clock in or out.
// Used on the staff Today screen, on "My clock" for managers, and on the manager Today screen (phone).
export default function ClockCard({ data, me, boss, lang, onGoTo }) {
  const now = useNow(1000) // every second, for the running timers
  const w = say(lang)
  const f = useFeatures()
  const today = dateKey(now)
  const [busy, setBusy] = useState('') // '', 'locating' or 'saving'
  const [error, setError] = useState('')
  const [noSpot, setNoSpot] = useState('')

  const open = data.punches.find((p) => p.employeeId === me.id && !p.clockOut)
  const staleOpen = open && dateKey(new Date(open.clockIn)) !== today
  const todayMinutes = data.punches
    .filter((p) => p.employeeId === me.id && dateKey(new Date(p.clockIn)) === today)
    .reduce((sum, p) => sum + punchMinutes(p, now), 0)

  // Find where the phone is, then clock in or out (without the location if the
  // phone can't or won't say).
  const punch = async () => {
    setBusy('locating')
    setError('')
    setNoSpot('')
    // Without the location feature the punch is saved with no place.
    const where = f.location ? await currentSpot() : {}
    // The street too, for the punch's details (skipped if it takes too long).
    if (f.location && !where.error) where.address = await streetAddress(where)
    setBusy('saving')
    const problem = open ? await data.actions.clockOut(where) : await data.actions.clockIn(where)
    setBusy('')
    if (problem) return setError(problem)
    if (where.error) setNoSpot(where.error)
  }

  if (!f.timeClock) return null
  return (
    <section className="tm-card tm-clock">
      <ClockHero lang={lang} open={open} busy={busy} onPunch={punch} now={now} data={data} me={me} staleOpen={staleOpen} todayMinutes={todayMinutes} onGoTo={onGoTo} />
      {staleOpen && <p className="tm-warn">{w.stale(dayName(dateKey(new Date(open.clockIn)), lang))}</p>}
      {noSpot && <p className="tm-warn">{noSpot === 'denied' ? w.noSpotDenied : w.noSpot}</p>}
      {error && <p className="tm-error" role="alert">{error}</p>}
      {!boss && <MyPunchNotes data={data} me={me} lang={lang} />}
      {!boss && <Countdown data={data} me={me} now={now} open={open} lang={lang} />}
    </section>
  )
}
