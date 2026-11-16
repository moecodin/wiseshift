import { useEffect, useRef, useState } from 'react'
import { usingSupabase } from '../lib/supabase.js'
import { useAuth } from '../state/useAuth.js'
import SignIn from '../components/SignIn.jsx'
import { ChoosePassword, SetUpLogin } from './SetUpLogin.jsx'
import { payPeriodOf, scheduleWeekOf } from './paycheck.js'
import { useTeamData } from './useTeamData.js'
import ClockTab from './ClockTab.jsx'
import ScheduleTab from './ScheduleTab.jsx'
import HoursTab from './HoursTab.jsx'
import TimeOffTab from './TimeOffTab.jsx'
import PeopleTab from './PeopleTab.jsx'
import AppBanners from './AppBanners.jsx'
import NotifySettings from './NotifySettings.jsx'
import SettingsPanel, { LocationNotice } from './SettingsPanel.jsx'
import { noticeAcked } from './settings.js'
import { TABS_ES, themeById } from './themes/index.js'
import { say } from './words.js'
import MoreTab from './MoreTab.jsx'
import { MORE } from './more.js'
import './team.css'
import './themes/themes.css'

const THEME_KEY = 'wiseshift-theme'
const THEME_FONTS = 'https://fonts.googleapis.com/css2?family=Silkscreen&family=Pixelify+Sans:wght@400;600;700&family=Press+Start+2P&family=VT323&family=Fredoka:wght@400;600;700&family=Gochi+Hand&family=Comfortaa:wght@500;700&display=swap'
function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) // 'light', 'dark', or null (follow the device)
  } catch {
    return null
  }
}

// The tabs, in order. Their names come from the person's theme. Hours & pay,
// Time off and Team open from More.
const TABS = ['clock', 'schedule', 'more']
const PAGES = [...TABS, ...MORE.map((m) => m.id)]

// The team page (/team): time clock, schedules, hours and
// paycheck estimates, and time off. Each person signs in with their own email.
export default function TeamApp() {
  const auth = useAuth()
  const [settingUp, setSettingUp] = useState(false) // "Set up your login" instead of the sign-in form
  const [choosing, setChoosing] = useState(false) // signed in with an emailed code: choose a password

  // Light or dark: their own choice (remembered on this device), otherwise the
  // device's setting. Only for Classic; the other themes have their own colors.
  const [theme, setTheme] = useState(savedTheme)
  const [skin, setSkin] = useState('classic') // the person's theme (themes/index.js)
  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const root = document.documentElement
      root.dataset.skin = skin
      root.dataset.bsTheme = skin === 'classic' ? theme ?? (dark.matches ? 'dark' : 'light') : themeById(skin).dark ? 'dark' : 'light'
    }
    apply()
    dark.addEventListener('change', apply)
    return () => dark.removeEventListener('change', apply)
  }, [theme, skin])
  // The themes' fonts, fetched only once someone uses a theme other than Classic.
  useEffect(() => {
    if (skin === 'classic' || document.getElementById('team-theme-fonts')) return
    const link = document.createElement('link')
    link.id = 'team-theme-fonts'
    link.rel = 'stylesheet'
    link.href = THEME_FONTS
    document.head.append(link)
  }, [skin])
  const toggleTheme = () => {
    const next = document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Not important if this can't be saved.
    }
  }
  useEffect(() => {
    document.title = 'WiseShift'
  }, [])

  if (auth.checking) return <p className="loading-note">Loading…</p>
  if (!auth.signedIn) {
    if (settingUp) return <SetUpLogin onChoosing={setChoosing} onBack={() => setSettingUp(false)} />
    return (
      <SignIn
        onSignIn={auth.signIn}
        presetEmail=""
        allowOtherAccount={false}
        labels={{ title: 'WiseShift' }}
        footer={
          <button type="button" className="btn btn-link btn-sm w-100 mt-2 text-secondary" onClick={() => setSettingUp(true)}>
            First time here, or forgot your password?
          </button>
        }
      />
    )
  }
  if (choosing) {
    return (
      <ChoosePassword
        email={auth.email}
        onDone={() => {
          setChoosing(false)
          setSettingUp(false)
        }}
      />
    )
  }
  return <Team email={auth.email} signedIn={auth.signedIn} onSignOut={auth.signOut} onToggleTheme={toggleTheme} onSkin={setSkin} />
}

function Team({ email, signedIn, onSignOut, onToggleTheme, onSkin }) {
  const [today] = useState(() => new Date())
  const [week, setWeek] = useState(() => scheduleWeekOf(today))
  const [period, setPeriod] = useState(() => payPeriodOf(today))
  const data = useTeamData({ signedIn, email, week, period })
  // A notification can open a tab directly (/team?tab=schedule).
  const [tab, setTab] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab')
    return PAGES.includes(wanted) ? wanted : 'clock'
  })
  const inMore = MORE.some((m) => m.id === tab)
  const me = data.me
  const boss = Boolean(me?.isManager)
  const lang = data.lang ?? 'en'
  const pending = boss ? data.timeOff.filter((t) => t.status === 'pending').length : 0
  // Note that I opened the app (on open and whenever it comes back on screen,
  // at most every 2 minutes), for the managers' ✓✓ on the Schedule.
  const markSeen = useRef(data.actions.markSeen)
  useEffect(() => {
    markSeen.current = data.actions.markSeen
  })
  useEffect(() => {
    if (!me?.id) return
    let last = 0
    const ping = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 120000) return
      last = Date.now()
      markSeen.current()
    }
    ping()
    document.addEventListener('visibilitychange', ping)
    return () => document.removeEventListener('visibilitychange', ping)
  }, [me?.id])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notifying, setNotifying] = useState(false)
  // Signed out or not on the team: Classic.
  const skin = me ? data.theme ?? 'classic' : 'classic'
  const look = themeById(skin)
  useEffect(() => {
    onSkin(skin)
    return () => onSkin('classic')
  }, [skin, onSkin])

  const signOut = usingSupabase && (
    <button type="button" className="tm-link" onClick={onSignOut}>Sign out</button>
  )

  let body
  if (data.setupMissing) {
    body = (
      <Notice title="Not set up yet">
        The team tables aren't in the database yet. Run <code>supabase/updates/013-team.sql</code> in Supabase, then reload.
      </Notice>
    )
  } else if (data.loading) {
    body = <p className="tm-empty">Loading…</p>
  } else if (data.error && !me) {
    body = (
      <Notice title="Couldn't load the team page">
        <p>{data.error}</p>
        <button type="button" className="btn btn-brand" onClick={data.reload}>Try again</button>
      </Notice>
    )
  } else if (!me) {
    body = (
      <Notice title="Not on the team list">
        <b>{email || 'This login'}</b> isn't on your team's list yet. Ask your manager to add you with this email.
      </Notice>
    )
  } else {
    const shared = { data, me, boss, look, lang }
    // New York says to have everyone acknowledge that clocking in records their location.
    const needsNotice = data.settingsReady && !noticeAcked(data.privateById[me.id], data.settings)
    const tabNames = lang === 'es' ? TABS_ES : look.tabs
    body = (
      <>
        {inMore && (
          <button type="button" className="tm-back" onClick={() => setTab('more')}>‹ {tabNames.more}</button>
        )}
        {needsNotice && tab === 'clock' && (
          <section className="tm-card st-notice-card">
            <h2>{say(lang).readNotice}</h2>
            <LocationNotice data={data} me={me} />
          </section>
        )}
        {tab === 'clock' && <ClockTab {...shared} onGoTo={setTab} />}
        {tab === 'schedule' && <ScheduleTab {...shared} week={week} onWeek={setWeek} />}
        {tab === 'hours' && <HoursTab {...shared} period={period} onPeriod={setPeriod} />}
        {tab === 'off' && <TimeOffTab {...shared} />}
        {tab === 'people' && boss && <PeopleTab {...shared} />}
        {tab === 'more' && <MoreTab {...shared} pending={pending} onOpen={setTab} />}
      </>
    )
  }

  return (
    <div className={`tm skin-${skin}`}>
      <header className="tm-head">
        <a className="tm-logo" href="/team" aria-label="WiseShift">WS</a>
        <div className="tm-hello">
          {me ? `${lang === 'es' ? 'Hola' : 'Hi'} ${me.name.split(' ')[0]}` : 'WiseShift'}
          <small>{me ? (me.position || 'Team') : 'Team'}</small>
        </div>
        <span className="tm-head-btns">
          {me && (
            <button type="button" className="tm-icon" onClick={() => setNotifying(true)} aria-label="Notifications" title="Notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" /></svg>
            </button>
          )}
          {me && (
            <button type="button" className="tm-icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
            </button>
          )}
          {!me && (
            <button type="button" className="tm-icon" onClick={onToggleTheme} aria-label="Light or dark" title="Light or dark">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            </button>
          )}
        </span>
      </header>

      {data.sample && (
        <div className="tm-sample">
          <span>Sample data, not saved online. View as</span>
          <select className="form-select form-select-sm" value={data.sample.viewAs} onChange={(e) => data.sample.setViewAs(e.target.value)} aria-label="View as">
            {data.employees.filter((e) => e.payType !== 'none').map((e) => (
              <option key={e.id} value={e.id}>{e.name}{e.isManager ? ' (manager)' : ''}</option>
            ))}
          </select>
          <button type="button" className="tm-link" onClick={data.sample.reset}>Reset</button>
        </div>
      )}

      {me && (
        <nav className="tm-tabs" role="tablist" aria-label="Team page">
          {TABS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id || (id === 'more' && inMore)} onClick={() => setTab(id)}>
              {(lang === 'es' ? TABS_ES : look.tabs)[id]}
              {id === 'more' && pending > 0 && <span className="tm-badge" aria-label={`${pending} waiting`}>{pending}</span>}
            </button>
          ))}
        </nav>
      )}

      <AppBanners />

      <main className={`tm-main ${tab === 'schedule' || tab === 'people' || tab === 'hours' ? 'wide' : ''}`}>
        {data.error && me && <p className="tm-error" role="alert">Couldn't refresh: {data.error}</p>}
        {body}
        <p className="tm-foot">{signOut}</p>
      </main>
      {settingsOpen && (
        <SettingsPanel data={data} me={me} boss={boss} skin={skin} onToggleTheme={onToggleTheme} onSignOut={onSignOut} onClose={() => setSettingsOpen(false)} />
      )}
      {notifying && <NotifySettings data={data} boss={boss} onClose={() => setNotifying(false)} />}
    </div>
  )
}

function Notice({ title, children }) {
  return (
    <div className="tm-card tm-notice">
      <h1>{title}</h1>
      <div>{children}</div>
    </div>
  )
}
