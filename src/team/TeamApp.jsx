import { useEffect, useLayoutEffect, useRef, useState, Fragment } from 'react'
import { usingSupabase } from '../lib/supabase.js'
import { useAuth } from '../state/useAuth.js'
import SignIn from '../components/SignIn.jsx'
import { ChoosePassword, SetUpLogin } from './SetUpLogin.jsx'
import { payPeriodOf, scheduleWeekOf } from './paycheck.js'
import { useTeamData } from './useTeamData.js'
import ClockTab from './ClockTab.jsx'
import ScheduleTab from './ScheduleTab.jsx'
import ReportsTab from './ReportsTab.jsx'
import DesktopOnly from './DesktopOnly.jsx'
import SearchPalette from './SearchPalette.jsx'
import { useIsPhone } from './useIsPhone.js'
import HoursTab from './HoursTab.jsx'
import TimeOffTab from './TimeOffTab.jsx'
import PeopleTab from './PeopleTab.jsx'
import AppBanners from './AppBanners.jsx'
import NotifySettings from './NotifySettings.jsx'
import SettingsPanel, { LocationNotice } from './SettingsPanel.jsx'
import { noticeAcked } from './settings.js'
import { TABS_ES, themeById } from './themes/index.js'
import { FeaturesContext, featuresOf } from './features.js'
import Avatar from './Avatar.jsx'
import ClockedOutNotice from './ClockedOutNotice.jsx'
import TasksTab from './TasksTab.jsx'
import { say } from './words.js'
import MoreTab from './MoreTab.jsx'
import { MORE } from './more.js'
import './team.css'
import './statement.css'
import './darkStyle.js'
import Icon from './Icon.jsx'
import Logo from './Logo.jsx'
import { OwnerOnboarding, StaffOnboarding } from './Onboarding.jsx'
import { welcomeSeen } from './onboardingHelpers.js'

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
const TABS = ['clock', 'schedule', 'tasks', 'hours', 'reports', 'more']
const PAGES = [...TABS, ...MORE.map((m) => m.id), 'settings']

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
      // The phone's browser bar takes the page's color, in light and in dark.
      requestAnimationFrame(() => {
        const bar = document.querySelector('meta[name="theme-color"]')
        if (bar) bar.content = getComputedStyle(document.body).backgroundColor
      })
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
  const [personId, setPersonId] = useState(() => new URLSearchParams(window.location.search).get('person')) // the person page open under Team
  // Keep the address in step with the tab, so a refresh or a shared link comes back to the same tab.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (tab === 'clock') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    if (tab === 'people' && personId) url.searchParams.set('person', personId)
    else url.searchParams.delete('person')
    window.history.replaceState(window.history.state, '', url)
  }, [tab, personId])
  // The pay period is a setting: when it loads or changes, go back to the current period under the new rule.
  const payKey = `${data.settings.payPeriod?.days}-${data.settings.payPeriod?.anchor}`
  useEffect(() => {
    setPeriod(payPeriodOf(new Date()))
  }, [payKey])
  const me = data.me
  const boss = Boolean(me?.isManager)
  // The Team page is for managers only; if the person changes to an employee while
  // on it (sample "View as"), fall back to More instead of showing a blank page.
  // Which parts of the app this business uses (Settings → Features). A tab or page for a
  // feature that is off is skipped, even if someone opens an old link to it.
  const features = featuresOf(data.settings)
  const tabs = TABS.filter((t) => (t !== 'hours' || features.timeClock) && (t !== 'tasks' || features.teamTasks) && (t !== 'reports' || (boss && features.timeClock && features.timesheets)))
  const page = tab === 'people' && !boss ? 'more' : tab === 'hours' && !features.timeClock ? 'clock' : tab === 'reports' && !(boss && features.timeClock && features.timesheets) ? 'clock' : tab === 'tasks' && !features.teamTasks ? 'clock' : tab === 'off' && !features.timeOff ? 'more' : tab
  const phone = useIsPhone()
  // Site search: Ctrl/⌘+K or "/" opens it; a result opens its page (and Settings on the right side), then the spot flashes.
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsStart, setSettingsStart] = useState('me')
  const [hit, setHit] = useState(null)
  // From a person's page: their punches (Hours review) or their row on the schedule.
  const jumpToPerson = (tab, id) => {
    go(tab)
    if (tab === 'hours') setPersonFocus({ id, tab, n: Date.now() })
    else setHit({ sel: `[data-person="${id}"]`, n: Date.now() })
  }
  useEffect(() => {
    const keys = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setSearchOpen(true) }
      else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setSearchOpen(true) }
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [])
  useEffect(() => {
    if (!hit) return undefined
    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      const find = hit.find?.toLowerCase()
      const el = hit.sel
        ? document.querySelector(hit.sel)
        : find ? [...document.querySelectorAll('.st-page .st-section')].find((x) => (x.querySelector('.tm-h3')?.innerText ?? x.innerText).toLowerCase().trim().startsWith(find)) ?? [...document.querySelectorAll('.st-page .st-section')].find((x) => x.innerText.toLowerCase().includes(find)) : null
      if (el && el.offsetParent !== null) {
        clearInterval(timer)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el.classList.add('search-hit')
        setTimeout(() => el.classList.remove('search-hit'), 2300)
      } else if (tries > 25) clearInterval(timer)
    }, 120)
    return () => clearInterval(timer)
  }, [hit])
  // On a phone Reports lives under More (the bottom bar keeps five tabs), so it counts as a page opened from More.
  const inMore = MORE.some((m) => m.id === page) || (phone && page === 'reports')
  // Screens slide in from the side the tab is on: toward the right for tabs further
  // along the bar (and pages opened from More), toward the left going back.
  const [dir, setDir] = useState('r')
  const [personFocus, setPersonFocus] = useState(null) // a person picked in the search: { id, tab, n }; the page they open reads it once
  // Tapping Today in the menu always returns a manager to the Today screen, even from My clock or Review inside it.
  const [homeTick, setHomeTick] = useState(0)
  const rank = (id) => (TABS.includes(id) ? TABS.indexOf(id) : TABS.indexOf('more') + 0.5)
  const go = (id) => {
    setPersonFocus(null)
    setPersonId(null)
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
    // Measure again when the tabs change size (fonts loading, labels in another language, the
    // dock's layout settling), so the pill always sits exactly behind the chosen tab.
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    if (watch && navRef.current) {
      watch.observe(navRef.current)
      navRef.current.querySelectorAll('button').forEach((b) => watch.observe(b))
    }
    document.fonts?.ready.then(place)
    return () => {
      window.removeEventListener('resize', place)
      watch?.disconnect()
    }
  }, [page, inMore, me?.id, data.lang, boss, tabs.length])
  const lang = data.lang ?? 'en'
  const pending = boss && features.timeOff ? data.timeOff.filter((t) => t.status === 'pending').length : 0
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
  // Computer menu: hide the labels to leave a slim icon bar (remembered on this computer).
  const [navOff, setNavOff] = useState(() => {
    try {
      return localStorage.getItem('wiseshift-nav-off') === '1'
    } catch {
      return false
    }
  })
  const toggleNav = () =>
    setNavOff((v) => {
      try {
        localStorage.setItem('wiseshift-nav-off', v ? '0' : '1')
      } catch {
        // Not important if this can't be saved.
      }
      return !v
    })
  const [notifying, setNotifying] = useState(false)
  const look = themeById()
  const business = data.settings.businessName || 'WiseShift'
  const logoSrc = data.settings.businessLogo
  // First-run wizards: the owner of a new business once; everyone else once per device. Hidden until sample/real data is in.
  const [staffTourDone, setStaffTourDone] = useState(false)
  const showOwnerTour = Boolean(me && boss && data.settingsReady && data.settings.setupReady && !data.settings.setupDone)
  const showStaffTour = Boolean(me && !showOwnerTour && !staffTourDone && data.settingsReady && data.settings.setupDone && !welcomeSeen(me.id))

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
    const shared = { data, me, boss, look, lang, onProfile: boss ? (id) => { go('people'); setPersonId(id) } : undefined }
    // New York says to have everyone acknowledge that clocking in records their location.
    const needsNotice = features.location && data.settingsReady && !noticeAcked(data.privateById[me.id], data.settings)
    const tabNames = lang === 'es' ? TABS_ES : look.tabs
    body = (
      <>
        {inMore && !(page === 'people' && personId) && (
          <button type="button" className="tm-back" onClick={() => go('more')}><Icon name="left" /> {tabNames.more}</button>
        )}
        {needsNotice && page === 'clock' && (
          <section className="tm-card st-notice-card">
            <h2>{say(lang).readNotice}</h2>
            <LocationNotice data={data} me={me} />
          </section>
        )}
        {page === 'clock' && <ClockTab key={homeTick} {...shared} onGoTo={go} />}
        {page === 'schedule' && <ScheduleTab {...shared} week={week} onWeek={setWeek} />}
        {page === 'tasks' && <TasksTab {...shared} />}
        {page === 'hours' && <HoursTab {...shared} period={period} onPeriod={setPeriod} focus={personFocus} />}
        {page === 'reports' && (phone ? <DesktopOnly name={tabNames.reports} lang={lang} /> : <ReportsTab data={data} period={period} onPeriod={setPeriod} focus={personFocus} />)}
        {page === 'off' && <TimeOffTab {...shared} />}
        {page === 'people' && boss && <PeopleTab {...shared} focus={personFocus} personId={personId} onPerson={setPersonId} onJump={jumpToPerson} />}
        {page === 'settings' && <SettingsPanel key={settingsStart} start={settingsStart} asPage data={data} me={me} boss={boss} onToggleTheme={onToggleTheme} onSignOut={onSignOut} onClose={() => go('clock')} />}
        {page === 'more' && <MoreTab {...shared} email={email} pending={pending} onOpen={go} onNotify={() => setNotifying(true)} onSearch={() => setSearchOpen(true)} onTheme={onToggleTheme} onSignOut={usingSupabase ? onSignOut : null} />}
      </>
    )
  }

  // Theme, notifications and settings: in the header on a phone, in the side menu on a computer.
  const goToPlace = (place) => {
    setSearchOpen(false)
    if (place.settings) setSettingsStart(place.settings)
    go(place.tab)
    if (place.focus) setPersonFocus({ ...place.focus, tab: place.tab, n: Date.now() })
    setHit(place.find || place.sel ? { find: place.find, sel: place.sel, n: Date.now() } : null)
  }
  const iconButtons = (
    <>
          <button type="button" className="tm-icon" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          </button>
          <button type="button" className="tm-icon" onClick={onToggleTheme} aria-label="Light or dark" title="Light or dark">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
          </button>
          {me && (
            <button type="button" className="tm-icon" onClick={() => setNotifying(true)} aria-label="Notifications" title="Notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" /></svg>
            </button>
          )}
          {me && (
            <button type="button" className="tm-icon" onClick={() => go('settings')} aria-label="Settings" title="Settings">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
            </button>
          )}
    </>
  )

  return (
    <FeaturesContext.Provider value={features}>
    <div className={`tm ${navOff ? 'nav-off' : ''}`}>
      <header className="tm-head">
        <a className="tm-logo" href={import.meta.env.BASE_URL} aria-label={business}><Logo src={logoSrc} /></a>
        <div className="tm-hello">
          {me ? `${lang === 'es' ? 'Hola' : 'Hi'} ${me.name.split(' ')[0]}` : business}
          <small>{me ? (me.position || 'Team') : 'Team'}</small>
        </div>
        <div id="tm-head-slot" className="tm-head-slot" />
        <span className={`tm-head-btns ${me ? 'in-side' : ''}`}>{iconButtons}</span>
      </header>

      {data.sample && (
        <div className="tm-sample">
          <span>Sample data, not saved online.</span>
          <select className="form-select form-select-sm" value={data.sample.kind} onChange={(e) => data.sample.setKind(e.target.value)} aria-label="Sample team">
            <option value="shop">Shop (6)</option>
            <option value="restaurant">Restaurant (23)</option>
          </select>
          <span>View as</span>
          <select className="form-select form-select-sm" value={data.sample.viewAs} onChange={(e) => data.sample.setViewAs(e.target.value)} aria-label="View as">
            {data.employees.filter((e) => e.payType !== 'none').map((e) => (
              <option key={e.id} value={e.id}>{e.name}{e.isManager ? ' (manager)' : ''}</option>
            ))}
          </select>
          <button type="button" className="tm-link" onClick={data.sample.reset}>Reset</button>
        </div>
      )}

      {me && (
        <div className="tm-side">
          <a className="tm-brand" href={import.meta.env.BASE_URL} aria-label={business}><Logo src={logoSrc} /><b>{business}</b></a>
          <button type="button" className="tm-nav-toggle" onClick={toggleNav} aria-label={navOff ? 'Show the menu labels' : 'Hide the menu labels'} title={navOff ? 'Show the menu labels' : 'Hide the menu labels'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={navOff ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} /></svg>
          </button>
          <button type="button" className="tm-search-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            <span>{lang === 'es' ? 'Buscar' : 'Search'}</span><kbd>/</kbd>
          </button>
          <nav className="tm-tabs" role="tablist" aria-label="Team page" ref={navRef}>
            {pill && <span className="tm-pill" aria-hidden="true" style={{ transform: `translate(${pill.left}px, ${pill.top}px)`, width: pill.width, height: pill.height }} />}
            {tabs.map((id) => (
              <Fragment key={id}>
              {/* Computer only: Settings sits in the menu just before More (on a phone it stays a button in the header). */}
              {id === 'more' && (
              <button type="button" className="tm-tab-settings" aria-pressed={page === 'settings'} onClick={() => go('settings')}>
                <svg className="tm-tabicon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
                <span>{lang === 'es' ? 'Ajustes' : 'Settings'}</span>
              </button>
              )}
              <button type="button" role="tab" data-tab={id} aria-selected={(page === id && !(phone && id === 'reports')) || (id === 'more' && inMore)} onClick={() => { go(id); if (id === 'clock') setHomeTick((n) => n + 1) }}>
                <TabIcon id={id === 'clock' ? 'today' : id} />
                <span>{id === 'clock' ? (lang === 'es' ? 'Hoy' : 'Today') : (lang === 'es' ? TABS_ES : look.tabs)[id]}</span>
                {id === 'more' && pending > 0 && <span className="tm-badge" aria-label={`${pending} waiting`}>{pending}</span>}
              </button>
              </Fragment>
            ))}
          </nav>
          <div className="tm-side-btns">{iconButtons}</div>
          <div className="tm-me">
            <Avatar employee={me} size={36} />
            <span><b>{me.name}</b><small>{me.position || (boss ? 'Manager' : 'Team')}</small></span>
          </div>
        </div>
      )}

      <AppBanners />

      <main className={`tm-main ${tab === 'schedule' || tab === 'people' || tab === 'hours' ? 'wide' : ''}`}>
        {data.error && me && <p className="tm-error" role="alert">Couldn't refresh: {data.error}</p>}
        <div key={page} className={`tm-page slide-${dir}`}>{body}</div>
      </main>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} onPick={goToPlace} ctx={{ boss, features, lang, phone, employees: data.employees }} />
      {notifying && <NotifySettings data={data} boss={boss} onClose={() => setNotifying(false)} />}
      {me && features.timeClock && <ClockedOutNotice data={data} me={me} lang={lang} />}
      {showOwnerTour && <OwnerOnboarding data={data} me={me} lang={lang} onTeam={() => go('people')} />}
      {showStaffTour && <StaffOnboarding data={data} me={me} lang={lang} businessName={business} onNotify={() => setNotifying(true)} onClose={() => setStaffTourDone(true)} />}
    </div>
    </FeaturesContext.Provider>
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
const ICONS = {
  today: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  schedule: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  tasks: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  hours: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  reports: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  more: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
}
function TabIcon({ id }) {
  return <svg className="tm-tabicon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[id]}</svg>
}
