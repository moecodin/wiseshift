import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

const THEME_KEY = 'wiseshift-theme'
function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) // 'light', 'dark', or null (follow the device)
  } catch {
    return null
  }
}

// The tabs, in order. Their names come from the person's theme. Time off and Team open
// from More.
const TABS = ['clock', 'schedule', 'hours', 'more']
const PAGES = [...TABS, ...MORE.map((m) => m.id)]

// The team page (/team): time clock, schedules, hours and
// paycheck estimates, and time off. Each person signs in with their own email.
export default function TeamApp() {
  const auth = useAuth()
  const [settingUp, setSettingUp] = useState(false) // "Set up your login" instead of the sign-in form
  const [choosing, setChoosing] = useState(false) // signed in with an emailed code: choose a password

  // Light or dark: their own choice (remembered on this device), otherwise the
  // device's setting.
  const [theme, setTheme] = useState(savedTheme)
  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.bsTheme = theme ?? (dark.matches ? 'dark' : 'light')
    }
    apply()
    dark.addEventListener('change', apply)
    return () => dark.removeEventListener('change', apply)
  }, [theme])
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
  return <Team email={auth.email} signedIn={auth.signedIn} onSignOut={auth.signOut} onToggleTheme={toggleTheme} />
}

function Team({ email, signedIn, onSignOut, onToggleTheme }) {
  const [today] = useState(() => new Date())
  const [week, setWeek] = useState(() => scheduleWeekOf(today))
  const [period, setPeriod] = useState(() => payPeriodOf(today))
  const data = useTeamData({ signedIn, email, week, period })
  // A notification can open a tab directly (/team?tab=schedule).
  const [tab, setTab] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab')
    return PAGES.includes(wanted) ? wanted : 'clock'
  })
  const me = data.me
  const boss = Boolean(me?.isManager)
  // The Team page is for managers only; if the person changes to an employee while
  // on it (sample "View as"), fall back to More instead of showing a blank page.
  const page = tab === 'people' && !boss ? 'more' : tab
  const inMore = MORE.some((m) => m.id === page)
  // Screens slide in from the side the tab is on: toward the right for tabs further
  // along the bar (and pages opened from More), toward the left going back.
  const [dir, setDir] = useState('r')
  const rank = (id) => (TABS.includes(id) ? TABS.indexOf(id) : TABS.indexOf('more') + 0.5)
  const go = (id) => {
    if (id !== page) setDir(rank(id) >= rank(page) ? 'r' : 'l')
    setTab(id)
  }
  // A pill that glides to the chosen tab.
  const navRef = useRef(null)
  const [pill, setPill] = useState(null)
  useLayoutEffect(() => {
    const place = () => {
      const on = navRef.current?.querySelector('[aria-selected="true"]')
      if (on) setPill({ left: on.offsetLeft, width: on.offsetWidth, top: on.offsetTop, height: on.offsetHeight })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [page, inMore, me?.id, data.lang, boss])
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
  const look = themeById()

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
          <button type="button" className="tm-back" onClick={() => go('more')}>‹ {tabNames.more}</button>
        )}
        {needsNotice && page === 'clock' && (
          <section className="tm-card st-notice-card">
            <h2>{say(lang).readNotice}</h2>
            <LocationNotice data={data} me={me} />
          </section>
        )}
        {page === 'clock' && <ClockTab {...shared} onGoTo={go} />}
        {page === 'schedule' && <ScheduleTab {...shared} week={week} onWeek={setWeek} />}
        {page === 'hours' && <HoursTab {...shared} period={period} onPeriod={setPeriod} />}
        {page === 'off' && <TimeOffTab {...shared} />}
        {page === 'people' && boss && <PeopleTab {...shared} />}
        {page === 'more' && <MoreTab {...shared} email={email} pending={pending} onOpen={go} onNotify={() => setNotifying(true)} onSettings={() => setSettingsOpen(true)} onSignOut={usingSupabase ? onSignOut : null} />}
      </>
    )
  }

  return (
    <div className="tm">
      <header className="tm-head">
        <a className="tm-logo" href={import.meta.env.BASE_URL} aria-label="WiseShift"><Logo /></a>
        <div className="tm-hello">
          {me ? `${lang === 'es' ? 'Hola' : 'Hi'} ${me.name.split(' ')[0]}` : 'WiseShift'}
          <small>{me ? (me.position || 'Team') : 'Team'}</small>
        </div>
        <span className="tm-head-btns">
          <button type="button" className="tm-icon" onClick={onToggleTheme} aria-label="Light or dark" title="Light or dark">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
          </button>
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
        <nav className="tm-tabs" role="tablist" aria-label="Team page" ref={navRef}>
          {pill && <span className="tm-pill" aria-hidden="true" style={{ transform: `translate(${pill.left}px, ${pill.top}px)`, width: pill.width, height: pill.height }} />}
          {TABS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={page === id || (id === 'more' && inMore)} onClick={() => go(id)}>
              <TabIcon id={id === 'clock' && boss ? 'today' : id} />
              <span>{id === 'clock' && boss ? (lang === 'es' ? 'Hoy' : 'Today') : (lang === 'es' ? TABS_ES : look.tabs)[id]}</span>
              {id === 'more' && pending > 0 && <span className="tm-badge" aria-label={`${pending} waiting`}>{pending}</span>}
            </button>
          ))}
        </nav>
      )}

      <AppBanners />

      <main className={`tm-main ${tab === 'schedule' || tab === 'people' || tab === 'hours' ? 'wide' : ''}`}>
        {data.error && me && <p className="tm-error" role="alert">Couldn't refresh: {data.error}</p>}
        <div key={page} className={`tm-page slide-${dir}`}>{body}</div>
        <p className="tm-foot">{signOut}</p>
      </main>
      {settingsOpen && (
        <SettingsPanel data={data} me={me} boss={boss} onToggleTheme={onToggleTheme} onSignOut={onSignOut} onClose={() => setSettingsOpen(false)} />
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

// The WiseShift mark: three shift blocks.
function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="10" width="34" height="13" rx="6.5" fill="var(--navy)" />
      <rect x="20" y="26" width="38" height="13" rx="6.5" fill="#2F6B5A" />
      <rect x="10" y="42" width="30" height="13" rx="6.5" fill="#F6D580" />
    </svg>
  )
}

const ICONS = {
  today: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  schedule: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  hours: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  more: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
}
function TabIcon({ id }) {
  return <svg className="tm-tabicon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[id]}</svg>
}
