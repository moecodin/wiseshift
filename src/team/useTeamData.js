// The team page's data.
//   - Live site: Supabase tables and functions from supabase/updates/013-team.sql.
//     The database decides what each login may see (own punches and pay, or
//     everything for a manager). Checks for changes every 30 seconds and
//     whenever the page comes back into view.
//   - Sample mode: a made-up team saved only in this browser, with a "View as"
//     switch to try the page as Maria or as an employee.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { dateKey, fromKey, startOfToday } from '../lib/dates.js'
import { supabase, usingSupabase } from '../lib/supabase.js'
import { minutesBetween, payPeriodOf, scheduleWeekOf } from './paycheck.js'
import { createSampleTeam } from './sampleTeam.js'
import { createRestaurantSample } from './sampleRestaurant.js'
import { tellPush } from './app.js'
import { DEFAULT_SETTINGS, roundPunch, settingsFromRow, settingsToRow, unroundPunch } from './settings.js'

const REFRESH_MS = 30000
const SAMPLE_KEY = 'wiseshift-team-v1'
// Sample data comes in two sizes: the 6-person shop, and a 23-person restaurant (switch in the sample bar).
const SAMPLE_KIND_KEY = 'wiseshift-sample-kind'
const sampleKeyFor = (kind) => (kind === 'restaurant' ? 'wiseshift-team-restaurant-v1' : SAMPLE_KEY)
const createSampleFor = (kind) => (kind === 'restaurant' ? createRestaurantSample(startOfToday()) : createSampleTeam(startOfToday()))
function savedSampleKind() {
  try {
    return localStorage.getItem(SAMPLE_KIND_KEY) === 'restaurant' ? 'restaurant' : 'shop'
  } catch {
    return 'shop'
  }
}
const VIEW_AS_KEY = 'wiseshift-team-view-as'
const RECENT_DAYS = 60 // time-off requests stay listed this long after they end
export const REVIEW_DAYS = 7 // Review's "Past 7 days"

// ---------- Rows from Supabase, in the app's naming ----------

const employeeFromRow = (r) => ({
  id: r.id, name: r.name, email: r.email ?? '', position: r.position ?? '', isManager: r.is_manager, payType: r.pay_type, active: r.active,
  group: r.group_name, // update 030: undefined before it is run, null or a group name after
  startedOn: r.started_on ?? '', staffNo: r.staff_no ?? null, // update 016
})
const payFromRow = (r) => ({
  employeeId: r.employee_id,
  hourlyRate: Number(r.hourly_rate),
  filingStatus: r.filing_status,
  step2: r.step2,
  dependents: Number(r.dependents),
  otherIncome: Number(r.other_income),
  deductions: Number(r.deductions),
  extraWithholding: Number(r.extra_withholding),
  pretax: Number(r.pretax),
  nyStatus: r.ny_status,
  nyAllowances: r.ny_allowances,
  nyExtra: Number(r.ny_extra),
  nycResident: r.nyc_resident,
})
const payToRow = (employeeId, p) => ({
  employee_id: employeeId,
  hourly_rate: p.hourlyRate || 0,
  filing_status: p.filingStatus,
  step2: p.step2,
  dependents: p.dependents || 0,
  other_income: p.otherIncome || 0,
  deductions: p.deductions || 0,
  extra_withholding: p.extraWithholding || 0,
  pretax: p.pretax || 0,
  ny_status: p.nyStatus,
  ny_allowances: p.nyAllowances || 0,
  ny_extra: p.nyExtra || 0,
  nyc_resident: p.nycResident,
  updated_at: new Date().toISOString(),
})
const shiftFromRow = (r) => ({
  id: r.id, employeeId: r.employee_id, date: r.date, start: r.start_min, end: r.end_min, breakMin: r.break_min, title: r.title ?? '', role: r.role ?? '', note: r.note ?? '', published: r.published,
  postedAt: r.posted_at ?? null, // update 019
})
const shiftToRow = (s) => ({
  employee_id: s.employeeId, date: s.date, start_min: s.start, end_min: s.end, break_min: s.breakMin || 0, title: s.title ?? '', role: s.role ?? '', note: s.note ?? '', published: Boolean(s.published),
})
// Update 029: the team's tasks for a day (claimed with "I'll take it", or handed out by a manager).
const taskFromRow = (r) => ({
  id: r.id, date: r.date, time: r.time, title: r.title, note: r.note ?? '', claimedBy: r.claimed_by, assigned: Boolean(r.assigned), assignedBy: r.assigned_by ?? '',
  claimedAt: r.claimed_at, doneAt: r.done_at, doneBy: r.done_by ?? '', createdBy: r.created_by ?? '', createdAt: r.created_at,
})

// Update 024: cover requests, managers' notes and tasks, staff notes about punches.
const coverFromRow = (r) => ({
  id: r.id, kind: r.kind, shiftId: r.shift_id, swapShiftId: r.swap_shift_id, requesterId: r.requester_id, targetId: r.target_id, takerId: r.taker_id,
  note: r.note ?? '', status: r.status, createdAt: r.created_at, takenAt: r.taken_at, passedAt: r.passed_at, decidedBy: r.decided_by, decidedAt: r.decided_at,
})
const noteFromRow = (r) => ({
  id: r.id, kind: r.kind, text: r.text, color: r.color, dueDate: r.due_date ?? '', assignees: r.assignees ?? [], notify: r.notify, sendText: r.send_text,
  done: r.done, doneBy: r.done_by ?? '', doneAt: r.done_at, createdBy: r.created_by ?? '', createdAt: r.created_at,
})
const punchNoteFromRow = (r) => ({ id: r.id, employeeId: r.employee_id, date: r.date, tag: r.tag, text: r.text, createdAt: r.created_at, ackAt: r.ack_at, ackBy: r.ack_by ?? '' })
// A manager's note changes, in the table's column names.
const noteChangesToRow = (c) => {
  const row = {}
  if ('text' in c) row.text = c.text
  if ('kind' in c) row.kind = c.kind
  if ('color' in c) row.color = c.color
  if ('dueDate' in c) row.due_date = c.dueDate || null
  if ('assignees' in c) row.assignees = c.assignees
  if ('notify' in c) row.notify = c.notify
  if ('sendText' in c) row.send_text = c.sendText
  return row
}
// Where a punch happened (update 014), or null.
const spot = (lat, lng, accuracy) => (lat == null || lng == null ? null : { lat, lng, accuracy })
const punchFromRow = (r) => ({
  id: r.id, employeeId: r.employee_id, clockIn: r.clock_in, clockOut: r.clock_out, note: r.note ?? '', editedBy: r.edited_by, editedAt: r.edited_at,
  inSpot: spot(r.in_lat, r.in_lng, r.in_accuracy), outSpot: spot(r.out_lat, r.out_lng, r.out_accuracy),
  // Update 015: approval and street addresses.
  approvedBy: r.approved_by ?? null, approvedAt: r.approved_at ?? null, inAddress: r.in_address ?? '', outAddress: r.out_address ?? '',
})
const eventFromRow = (r) => ({ id: r.id, kind: r.kind, detail: r.detail ?? '', by: r.by_name ?? '', at: r.at })
const shopFromRow = (r) => (r && r.shop_lat != null ? { lat: r.shop_lat, lng: r.shop_lng, radius: r.shop_radius, address: r.shop_address ?? '' } : null)
// Phone, emergency contact, location-notice acknowledgment (update 018).
const privateFromRow = (r) => ({
  employeeId: r.employee_id, phone: r.phone ?? '', emergencyName: r.emergency_name ?? '', emergencyPhone: r.emergency_phone ?? '',
  noticeAckAt: r.notice_ack_at ?? null, noticeVersion: r.notice_version ?? null,
})
// The phone's location as arguments for clock_in / clock_out.
const spotArgs = (where) => (where?.lat == null ? {} : { lat: where.lat, lng: where.lng, accuracy: where.accuracy ?? null, ...(where.address ? { address: where.address } : {}) })
const timeOffFromRow = (r) => ({
  id: r.id, employeeId: r.employee_id, start: r.start_date, end: r.end_date, reason: r.reason ?? '', status: r.status ?? 'approved',
  decidedBy: r.decided_by, decidedAt: r.decided_at, createdAt: r.created_at,
})

const addDays = (key, n) => {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}
// The moment a day starts here, for comparing with punch times.
const dayStartIso = (key) => fromKey(key).toISOString()

// First and last days to load: the days on screen, plus today's week or pay
// period (for the clock tab) when that's a different one, plus `extra` (the
// last 7 days for Review, the next 60 days for the Coming up list).
function ranges(days, current, extra) {
  const list = [[days[0], days.at(-1)]]
  if (current[0] !== days[0]) list.push([current[0], current.at(-1)])
  list.push(extra)
  return list
}

// ---------- Live ----------

async function loadLive(email, week, period, today) {
  const todayKey = dateKey(today)
  const recent = [addDays(todayKey, -REVIEW_DAYS), todayKey]
  const shiftRanges = ranges(week, scheduleWeekOf(today), [recent[0], addDays(todayKey, 60)])
  const punchRanges = ranges(period, payPeriodOf(today), recent)
  // The pay period before this one too, for the Pocket Trainer's level-up message.
  const before = payPeriodOf(fromKey(addDays(payPeriodOf(today)[0], -1)))
  punchRanges.push([before[0], before.at(-1)])
  const offFrom = [week[0], addDays(todayKey, -RECENT_DAYS)].sort()[0]
  const offTo = [week[6], addDays(todayKey, 120)].sort()[1]

  const employees = await supabase.from('employees').select('*').order('name')
  if (employees.error) {
    // The tables aren't there yet: update 013 hasn't been run.
    if (employees.error.code === '42P01' || employees.error.code === 'PGRST205') return { setupMissing: true }
    throw employees.error
  }
  const shiftQueries = shiftRanges.map(([from, to]) => supabase.from('shifts').select('*').gte('date', from).lte('date', to))
  const punchQueries = punchRanges.map(([from, to]) =>
    supabase.from('punches').select('*').gte('clock_in', dayStartIso(from)).lt('clock_in', dayStartIso(addDays(to, 1))),
  )
  // Anyone still clocked in from an earlier week, so a forgotten clock-out shows up.
  const openPunches = supabase.from('punches').select('*').is('clock_out', null)
  // Update 024 (the new team page). Each comes back empty, not a failure, before 024 is run.
  const extrasFrom = dayStartIso(addDays(offFrom, -14))
  const extras = Promise.all([
    supabase.from('cover_requests').select('*').or(`status.in.(open,taken),created_at.gte."${extrasFrom}"`),
    supabase.from('manager_notes').select('*').order('created_at', { ascending: false }),
    supabase.from('punch_notes').select('*').gte('date', addDays(offFrom, -14)),
    // Update 029 (empty, not a failure, before it is run): yesterday through the next two weeks.
    supabase.from('team_tasks').select('*').gte('date', addDays(todayKey, -1)).lte('date', addDays(todayKey, 14)).order('time', { nullsFirst: false }),
  ])
  const [seen, priv, prefs, total, settings, pay, timeOff, teamOff, open, ...rest] = await Promise.all([
    // When people last opened the app (update 019). Your own, or everyone's for a manager.
    supabase.from('employee_seen').select('*'),
    // Empty (not a failure) before update 018. Your own, or everyone's for a manager.
    supabase.from('employee_private').select('*'),
    // Both empty (not a failure) before update 016.
    supabase.from('employee_prefs').select('*').maybeSingle(),
    supabase.rpc('my_total_minutes'),
    // Empty (not a failure) before update 014.
    supabase.from('team_settings').select('*').maybeSingle(),
    supabase.from('employee_pay').select('*'),
    supabase.from('time_off').select('*').gte('end_date', offFrom).order('start_date'),
    supabase.rpc('team_time_off', { from_date: offFrom, to_date: offTo }),
    openPunches,
    ...shiftQueries,
    ...punchQueries,
  ])
  for (const result of [pay, timeOff, teamOff, open, ...rest]) if (result.error) throw result.error
  const [coverRows, noteRows, punchNoteRows, taskRows] = await extras
  const rows = (result, from) => (result.error ? [] : result.data.map(from))

  const unique = (rows) => [...new Map(rows.map((r) => [r.id, r])).values()]
  const shifts = unique(rest.slice(0, shiftRanges.length).flatMap((r) => r.data)).map(shiftFromRow)
  const punches = unique([...open.data, ...rest.slice(shiftRanges.length).flatMap((r) => r.data)]).map(punchFromRow)
  const list = employees.data.map(employeeFromRow)
  return {
    me: list.find((e) => e.email && e.email.toLowerCase() === email.toLowerCase()) ?? null,
    employees: list,
    payById: Object.fromEntries(pay.data.map((r) => [r.employee_id, payFromRow(r)])),
    shifts,
    punches,
    timeOff: timeOff.data.map(timeOffFromRow),
    teamOff: teamOff.data.map(timeOffFromRow),
    cover: rows(coverRows, coverFromRow),
    notes: rows(noteRows, noteFromRow),
    punchNotes: rows(punchNoteRows, punchNoteFromRow),
    tasks: rows(taskRows, taskFromRow),
    shop: settings.error ? null : shopFromRow(settings.data),
    settings: settings.error ? DEFAULT_SETTINGS : settingsFromRow(settings.data),
    privateById: priv.error ? {} : Object.fromEntries(priv.data.map((r) => [r.employee_id, privateFromRow(r)])),
    settingsReady: !priv.error, // update 018 has been run
    seenById: seen.error ? null : Object.fromEntries(seen.data.map((r) => [r.employee_id, r.seen_at])), // null before 019
    theme: prefs.error ? null : prefs.data?.theme ?? 'classic',
    sounds: Boolean(!prefs.error && prefs.data?.sounds),
    pushOff: (!prefs.error && prefs.data?.push_off) || [], // update 017
    lang: (!prefs.error && prefs.data?.lang) || 'en', // update 021
    totalMinutes: total.error ? null : Number(total.data) || 0,
  }
}

// ---------- Sample ----------

function loadSample(kind = savedSampleKind()) {
  try {
    const saved = localStorage.getItem(sampleKeyFor(kind))
    if (saved) {
      const state = JSON.parse(saved)
      // Sample data saved before tasks existed starts with none.
      return state.tasks ? state : { ...state, tasks: [] }
    }
  } catch {
    // Start over with fresh sample data.
  }
  return createSampleFor(kind)
}
function savedViewAs() {
  try {
    return localStorage.getItem(VIEW_AS_KEY) || 'e1'
  } catch {
    return 'e1'
  }
}

// What one person would see in sample mode: the same rules as the database.
function sampleView(state, viewAs) {
  const me = state.employees.find((e) => e.id === viewAs && e.active) ?? null
  const boss = Boolean(me?.isManager)
  const own = (x) => boss || x.employeeId === viewAs
  return {
    me,
    employees: [...state.employees].sort((a, b) => a.name.localeCompare(b.name)),
    payById: Object.fromEntries(Object.entries(state.pay).filter(([id]) => boss || id === viewAs)),
    shifts: state.shifts.filter((x) => boss || x.published),
    punches: state.punches.filter(own),
    timeOff: state.timeOff.filter(own),
    // Cover requests are public inside the team: everyone needs to see which shifts are open.
    cover: state.cover ?? [],
    // Notes staff leave about a day's punches. Managers see all of them; staff see only their own.
    punchNotes: (state.punchNotes ?? []).filter((n) => boss || n.employeeId === viewAs),
    // Tasks are for the whole team: everyone sees who has what.
    tasks: state.tasks ?? [],
    // Sticky notes and tasks are for managers only; staff never get them at all.
    // Staff see only the notes and tasks a manager tagged them on.
    notes: boss ? state.notes ?? [] : (state.notes ?? []).filter((n) => (n.assignees ?? []).includes(viewAs)),
    teamOff: state.timeOff.filter((t) => t.status === 'approved' && own(t)).map(({ id, employeeId, start, end }) => ({ id, employeeId, start, end, status: 'approved' })),
    shop: state.shop ?? null,
    settings: { ...DEFAULT_SETTINGS, ...state.settings },
    privateById: Object.fromEntries(Object.entries(state.private ?? {}).filter(([id]) => boss || id === viewAs)),
    settingsReady: true,
    seenById: boss ? state.seen ?? {} : {},
    theme: state.prefs?.[viewAs]?.theme ?? 'classic',
    sounds: Boolean(state.prefs?.[viewAs]?.sounds),
    pushOff: state.prefs?.[viewAs]?.pushOff ?? [],
    lang: state.prefs?.[viewAs]?.lang ?? 'en',
    totalMinutes: (me?.priorMinutes ?? 0) + state.punches.filter((p) => p.employeeId === viewAs).reduce((sum, p) => sum + minutesBetween(p.clockIn, p.clockOut ?? new Date()), 0),
  }
}

// "9:02 AM" for a punch time, for the sample history notes.
const clockLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'still in')
const changeNote = (old, now) =>
  [
    old.clockIn !== now.clockIn && `In ${clockLabel(old.clockIn)} → ${clockLabel(now.clockIn)}`,
    old.clockOut !== now.clockOut && `Out ${clockLabel(old.clockOut)} → ${clockLabel(now.clockOut)}`,
  ].filter(Boolean).join(', ')

const LOCAL_THEME_KEY = 'wiseshift-team-look'
function loadLocalTheme(email) {
  try {
    return JSON.parse(localStorage.getItem(`${LOCAL_THEME_KEY}:${email}`)) || null
  } catch {
    return null
  }
}
function saveLocalTheme(email, value) {
  try {
    localStorage.setItem(`${LOCAL_THEME_KEY}:${email}`, JSON.stringify(value))
  } catch {
    // Not important if this can't be saved.
  }
}

// Has this shift's day already ended?
const shiftOver = (shift) => new Date(fromKey(shift.date).getTime() + shift.end * 60000) < new Date()
// Would this person taking `shift` overlap their own shifts (not counting the one they'd give up) or approved time off?
const clashes = (state, personId, shift, giving) =>
  state.shifts.some((x) => x.employeeId === personId && x.id !== giving && x.date === shift.date && x.start < shift.end && shift.start < x.end) ||
  state.timeOff.some((t) => t.employeeId === personId && t.status === 'approved' && t.start <= shift.date && t.end >= shift.date)
let sampleIds = Date.now()
const newId = (prefix) => `${prefix}${++sampleIds}`

// ---------- The hook ----------

const EMPTY = { me: null, employees: [], payById: {}, shifts: [], punches: [], timeOff: [], teamOff: [], cover: [], notes: [], punchNotes: [], tasks: [], shop: null, settings: DEFAULT_SETTINGS, privateById: {}, settingsReady: false, seenById: null, theme: 'classic', sounds: false, pushOff: [], lang: 'en', totalMinutes: null }

export function useTeamData({ signedIn, email, week, period }) {
  const today = useMemo(() => startOfToday(), [])
  const [live, setLive] = useState(EMPTY)
  const [loading, setLoading] = useState(usingSupabase)
  const [error, setError] = useState('')
  const [setupMissing, setSetupMissing] = useState(false)

  const [sampleKind, setSampleKindState] = useState(savedSampleKind)
  const [sample, setSample] = useState(() => (usingSupabase ? null : loadSample()))
  // Before update 016 the theme is kept on this phone only.
  const [localTheme, setLocalTheme] = useState(() => loadLocalTheme(email))
  const [viewAs, setViewAsState] = useState(savedViewAs)
  useEffect(() => {
    if (!sample) return
    try {
      localStorage.setItem(sampleKeyFor(sampleKind), JSON.stringify(sample))
    } catch {
      // Not important if this can't be saved.
    }
  }, [sample, sampleKind])
  const setViewAs = (id) => {
    setViewAsState(id)
    try {
      localStorage.setItem(VIEW_AS_KEY, id)
    } catch {
      // Not important if this can't be saved.
    }
  }

  const load = useCallback(async () => {
    if (!usingSupabase) return
    try {
      const result = await loadLive(email, week, period, today)
      if (result.setupMissing) setSetupMissing(true)
      else setLive(result)
      setError('')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
    // The arrays change identity on every render of the caller; their first days are enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, week[0], period[0], today])

  useEffect(() => {
    if (!usingSupabase || !signedIn) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const timer = setInterval(load, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [signedIn, load])

  const view = useMemo(() => {
    // Punch times rounded to the hour (⚙️ → Business); the real times stay saved.
    const rounded = (v) => ({ ...v, punches: v.punches.map((p) => roundPunch(p, v.settings.roundWithin)) })
    if (!usingSupabase) return rounded(sampleView(sample, viewAs))
    return rounded(live.theme === null && localTheme ? { ...live, ...localTheme } : { ...live, theme: live.theme ?? 'classic' })
  }, [live, sample, viewAs, localTheme])
  const myName = view.me?.name ?? ''

  // Run a Supabase call, then reload. Returns '' when it worked, otherwise the problem.
  const run = async (promise) => {
    const { error: problem } = await promise
    if (problem) return problem.message || 'Something went wrong'
    await load()
    return ''
  }
  // Clock in or out with the location. Older databases take fewer arguments, so
  // try again with less rather than not clocking in.
  const punchCall = async (fn, where) => {
    let { error: problem } = await supabase.rpc(fn, spotArgs(where))
    // Before update 015 there's no address argument; before 014, no location.
    if (problem?.code === 'PGRST202' && where?.address) ({ error: problem } = await supabase.rpc(fn, spotArgs({ ...where, address: '' })))
    if (problem?.code === 'PGRST202' && where?.lat != null) return run(supabase.rpc(fn))
    if (problem) return problem.message || 'Something went wrong'
    await load()
    return ''
  }
  // Change the sample data. Returns '' like run().
  const change = (fn) => {
    setSample((s) => fn(structuredClone(s)))
    return ''
  }

  // After a change worked, tell the send-push function (update 017) so it can
  // notify whoever needs to know. Passes the result ('' or a problem) through.
  const andTell = (event, details) => (problem) => {
    if (!problem) tellPush(event, details)
    return problem
  }

  const actions = {
    // `where` is the phone's location ({ lat, lng, accuracy }), or nothing.
    clockIn: async (where) =>
      usingSupabase
        ? punchCall('clock_in', where).then(andTell('clocked_in'))
        : change((s) => {
            if (!s.punches.some((p) => p.employeeId === viewAs && !p.clockOut)) {
              s.punches.push({ id: newId('p'), employeeId: viewAs, clockIn: new Date().toISOString(), clockOut: null, note: '', inSpot: where?.lat == null ? null : where, outSpot: null })
            }
            return s
          }),
    clockOut: async (where) =>
      usingSupabase
        ? punchCall('clock_out', where)
        : change((s) => {
            const open = s.punches.find((p) => p.employeeId === viewAs && !p.clockOut)
            if (open) Object.assign(open, { clockOut: new Date().toISOString(), outSpot: where?.lat == null ? null : where })
            return s
          }),
    // Your own theme and sound effects (update 016). Before 016, kept on this phone only.
    setTheme: async (theme, sounds) => {
      if (!usingSupabase) {
        return change((s) => ({ ...s, prefs: { ...s.prefs, [viewAs]: { ...s.prefs?.[viewAs], theme, sounds } } }))
      }
      const { error: problem } = await supabase.rpc('set_my_theme', { new_theme: theme, new_sounds: sounds })
      if (problem) {
        saveLocalTheme(email, { theme, sounds })
        setLocalTheme({ theme, sounds })
        return ''
      }
      await load()
      return ''
    },
    // Which kinds of notifications you don't want (update 017).
    // English or Spanish for the team page (update 021).
    setLang: async (lang) => {
      if (!usingSupabase) return change((s) => ({ ...s, prefs: { ...s.prefs, [viewAs]: { ...s.prefs?.[viewAs], lang } } }))
      const problem = await run(supabase.rpc('set_my_lang', { new_lang: lang }))
      return problem && /set_my_lang|schema cache/.test(problem) ? "The language setting isn't in the database yet." : problem
    },
    setPushOff: async (kinds) => {
      if (!usingSupabase) return change((s) => ({ ...s, prefs: { ...s.prefs, [viewAs]: { ...s.prefs?.[viewAs], pushOff: kinds } } }))
      return run(supabase.rpc('set_push_off', { kinds }))
    },
    // Managers: business settings (update 018). `changes` is part of the settings.
    saveSettings: async (changes) => {
      const next = { ...view.settings, ...changes }
      if (!usingSupabase) return change((s) => ({ ...s, settings: next }))
      return run(supabase.from('team_settings').update({ ...settingsToRow(next), updated_at: new Date().toISOString() }).eq('id', 1))
    },
    // Settings → Business → Groups (update 030): save the list, move people when a group is renamed,
    // and take people out of a group that was removed.
    saveGroups: async ({ groups, renames = [], removed = [] }) => {
      if (!usingSupabase) {
        return change((s) => {
          for (const { from, to } of renames) for (const e of s.employees) if (e.group === from) e.group = to
          for (const name of removed) for (const e of s.employees) if (e.group === name) e.group = null
          s.settings = { ...view.settings, groups }
          return s
        })
      }
      for (const { from, to } of renames) {
        const { error: problem } = await supabase.from('employees').update({ group_name: to }).eq('group_name', from)
        if (problem) return problem.message || 'Something went wrong'
      }
      for (const name of removed) {
        const { error: problem } = await supabase.from('employees').update({ group_name: null }).eq('group_name', name)
        if (problem) return problem.message || 'Something went wrong'
      }
      return run(supabase.from('team_settings').update({ ...settingsToRow({ ...view.settings, groups, groupsReady: true }), updated_at: new Date().toISOString() }).eq('id', 1))
    },
    // Your own phone and emergency contact.
    setMyContact: async ({ phone, emergencyName, emergencyPhone }) => {
      if (!usingSupabase) {
        return change((s) => ({ ...s, private: { ...s.private, [viewAs]: { ...s.private?.[viewAs], employeeId: viewAs, phone, emergencyName, emergencyPhone } } }))
      }
      return run(supabase.rpc('set_my_contact', { new_phone: phone, new_emergency_name: emergencyName, new_emergency_phone: emergencyPhone }))
    },
    // I opened the app: for the managers' ✓✓ on the Schedule (update 019).
    // Quietly does nothing before 019.
    markSeen: async () => {
      if (!usingSupabase) {
        change((s) => ({ ...s, seen: { ...s.seen, [viewAs]: new Date().toISOString() } }))
        return
      }
      await supabase.rpc('mark_seen')
    },
    // "I've read this" on the location notice.
    ackNotice: async () => {
      if (!usingSupabase) {
        return change((s) => ({ ...s, private: { ...s.private, [viewAs]: { ...s.private?.[viewAs], employeeId: viewAs, noticeAckAt: new Date().toISOString(), noticeVersion: view.settings.noticeVersion } } }))
      }
      return run(supabase.rpc('ack_location_notice'))
    },
    // Managers: where the shop is, for "At the shop" on punches.
    saveShop: async (shop) =>
      usingSupabase
        ? run(supabase.from('team_settings').update({
            shop_lat: shop.lat, shop_lng: shop.lng, shop_radius: shop.radius, updated_at: new Date().toISOString(),
            // The typed or looked-up address (update 018); left out before that.
            ...(view.settingsReady ? { shop_address: shop.address ?? '' } : {}),
          }).eq('id', 1))
        : change((s) => ({ ...s, shop })),

    // Managers: shifts.
    saveShift: async (shift) => {
      if (!usingSupabase) {
        return change((s) => {
          const i = s.shifts.findIndex((x) => x.id === shift.id)
          // Like the database (update 019): a published shift that changes is posted again.
          const postedAt = shift.published ? new Date().toISOString() : null
          if (i >= 0) s.shifts[i] = { ...shift, postedAt }
          else s.shifts.push({ ...shift, postedAt, id: newId('s') })
          return s
        })
      }
      if (!shift.id) return run(supabase.from('shifts').insert(shiftToRow(shift)))
      const done = run(supabase.from('shifts').update(shiftToRow(shift)).eq('id', shift.id))
      // A published shift changed: let that person know.
      return shift.published ? done.then(andTell('shift_changed', { shift_id: shift.id })) : done
    },
    deleteShift: async (id) => {
      if (!usingSupabase) return change((s) => ({ ...s, shifts: s.shifts.filter((x) => x.id !== id) }))
      const gone = view.shifts.find((x) => x.id === id)
      const done = run(supabase.from('shifts').delete().eq('id', id))
      return gone?.published ? done.then(andTell('shift_removed', { employee_id: gone.employeeId, date: gone.date, start: gone.start, end: gone.end })) : done
    },
    // Clear the week's unpublished (draft) shifts. Published shifts stay. Returns { error, removed }, where
    // removed is what was cleared, so Undo can put it back with restoreShifts.
    clearDrafts: async (days) => {
      const inWeek = (x) => days.includes(x.date) && !x.published
      if (!usingSupabase) {
        const removed = (sample.shifts ?? []).filter(inWeek)
        if (removed.length) change((s) => ({ ...s, shifts: s.shifts.filter((x) => !inWeek(x)) }))
        return { error: '', removed }
      }
      const removed = view.shifts.filter(inWeek)
      if (!removed.length) return { error: '', removed }
      const problem = await run(supabase.from('shifts').delete().gte('date', days[0]).lte('date', days.at(-1)).eq('published', false))
      return { error: problem, removed: problem ? [] : removed }
    },
    // Put back shifts that clearDrafts removed (Undo).
    restoreShifts: async (list) => {
      if (!list.length) return ''
      if (!usingSupabase) return change((s) => ({ ...s, shifts: [...s.shifts, ...list.filter((x) => !s.shifts.some((y) => y.id === x.id))] }))
      return run(supabase.from('shifts').insert(list.map(shiftToRow)))
    },
    // Copy one week's shifts into another, skipping any that are already there.
    // Returns { error, copied }.
    copyWeek: async (fromDays, toDays) => {
      let source
      let existing
      if (usingSupabase) {
        const [a, b] = await Promise.all([
          supabase.from('shifts').select('*').gte('date', fromDays[0]).lte('date', fromDays.at(-1)),
          supabase.from('shifts').select('*').gte('date', toDays[0]).lte('date', toDays.at(-1)),
        ])
        if (a.error || b.error) return { error: (a.error || b.error).message, copied: 0 }
        source = a.data.map(shiftFromRow)
        existing = b.data.map(shiftFromRow)
      } else {
        source = sample.shifts.filter((x) => x.date >= fromDays[0] && x.date <= fromDays.at(-1))
        existing = sample.shifts.filter((x) => x.date >= toDays[0] && x.date <= toDays.at(-1))
      }
      const same = (a, b) => a.employeeId === b.employeeId && a.date === b.date && a.start === b.start
      const copies = source
        .map((x) => ({ ...x, id: undefined, published: false, date: toDays[fromDays.indexOf(x.date)] }))
        .filter((x) => !existing.some((e) => same(e, x)))
      if (!copies.length) return { error: '', copied: 0 }
      if (!usingSupabase) {
        change((s) => ({ ...s, shifts: [...s.shifts, ...copies.map((x) => ({ ...x, id: newId('s') }))] }))
        return { error: '', copied: copies.length }
      }
      return { error: await run(supabase.from('shifts').insert(copies.map(shiftToRow))), copied: copies.length }
    },

    // Show a week's draft shifts to the team.
    publishWeek: async (days) => {
      if (!usingSupabase) {
        const at = new Date().toISOString()
        return change((s) => {
          for (const x of s.shifts) {
            if (days.includes(x.date) && !x.published) Object.assign(x, { published: true, postedAt: at })
          }
          return s
        })
      }
      return run(supabase.from('shifts').update({ published: true }).gte('date', days[0]).lte('date', days.at(-1)).eq('published', false)).then(
        andTell('published', { from: days[0], to: days.at(-1) }),
      )
    },

    // Managers: add or fix a punch. Changing the times takes away its approval
    // (the database does the same, update 015).
    savePunch: async (shown) => {
      const punch = unroundPunch(shown, view.settings.roundWithin)
      const edit = { editedBy: myName, editedAt: new Date().toISOString() }
      if (!usingSupabase) {
        return change((s) => {
          const i = s.punches.findIndex((x) => x.id === punch.id)
          const at = edit.editedAt
          s.punchEvents ??= []
          if (i >= 0) {
            const old = s.punches[i]
            const moved = old.clockIn !== punch.clockIn || old.clockOut !== punch.clockOut
            s.punches[i] = { ...old, ...punch, ...edit, ...(moved && old.clockOut ? { approvedAt: null, approvedBy: null } : {}) }
            if (moved) s.punchEvents.push({ id: newId('v'), punchId: old.id, kind: 'changed', detail: changeNote(old, punch), by: myName, at })
            if (moved && old.clockOut && old.approvedAt) s.punchEvents.push({ id: newId('v'), punchId: old.id, kind: 'unapproved', detail: '', by: myName, at })
          } else {
            const id = newId('p')
            s.punches.push({ ...punch, ...edit, id })
            s.punchEvents.push({ id: newId('v'), punchId: id, kind: 'added', detail: `${clockLabel(punch.clockIn)} – ${clockLabel(punch.clockOut)}`, by: myName, at })
          }
          return s
        })
      }
      const row = { employee_id: punch.employeeId, clock_in: punch.clockIn, clock_out: punch.clockOut, note: punch.note ?? '', edited_by: edit.editedBy, edited_at: edit.editedAt }
      return run(punch.id ? supabase.from('punches').update(row).eq('id', punch.id) : supabase.from('punches').insert(row))
    },
    // Managers: clock someone out right now (they forgot). The punch is marked as fixed by
    // the manager, and its history shows "Out still in → 5:02 PM" (update 015's trigger).
    clockOutFor: async (punch) => {
      const at = new Date().toISOString()
      const edit = { editedBy: myName, editedAt: at }
      if (!usingSupabase) {
        return change((s) => {
          const p = s.punches.find((x) => x.id === punch.id)
          if (!p || p.clockOut) return s
          Object.assign(p, { clockOut: at, ...edit })
          s.punchEvents ??= []
          s.punchEvents.push({ id: newId('v'), punchId: p.id, kind: 'changed', detail: `Out ${clockLabel(null)} → ${clockLabel(at)}`, by: myName, at })
          return s
        })
      }
      return run(supabase.from('punches').update({ clock_out: at, edited_by: edit.editedBy, edited_at: at }).eq('id', punch.id).is('clock_out', null))
    },
    // Managers: approve (or unapprove) finished punches.
    approvePunches: async (ids, approve = true) => {
      const fields = approve ? { approvedAt: new Date().toISOString(), approvedBy: myName } : { approvedAt: null, approvedBy: null }
      if (!usingSupabase) {
        return change((s) => {
          s.punchEvents ??= []
          for (const p of s.punches) {
            if (!ids.includes(p.id) || !p.clockOut || Boolean(p.approvedAt) === approve) continue
            Object.assign(p, fields)
            s.punchEvents.push({ id: newId('v'), punchId: p.id, kind: approve ? 'approved' : 'unapproved', detail: '', by: myName, at: new Date().toISOString() })
          }
          return s
        })
      }
      let query = supabase.from('punches').update({ approved_at: fields.approvedAt, approved_by: fields.approvedBy }).in('id', ids).not('clock_out', 'is', null)
      query = approve ? query.is('approved_at', null) : query.not('approved_at', 'is', null)
      return run(query)
    },
    // One punch's history (update 015). Returns a list, or null if it couldn't load.
    punchEvents: async (punch) => {
      if (!usingSupabase) {
        const saved = (sample.punchEvents ?? []).filter((e) => e.punchId === punch.id)
        // Sample punches made before this existed: clocked in and out from the phone.
        const base = [
          !saved.some((e) => e.kind === 'added') && { id: 'in', kind: 'in', by: '', at: punch.clockIn },
          punch.clockOut && !saved.some((e) => e.kind === 'added') && { id: 'out', kind: 'out', by: '', at: punch.clockOut },
          punch.approvedAt && !saved.some((e) => e.kind === 'approved') && { id: 'ok', kind: 'approved', by: punch.approvedBy, at: punch.approvedAt },
        ].filter(Boolean)
        return [...base, ...saved].sort((a, b) => new Date(a.at) - new Date(b.at))
      }
      const { data: rows, error: problem } = await supabase.from('punch_events').select('*').eq('punch_id', punch.id).order('at')
      return problem ? null : rows.map(eventFromRow)
    },
    deletePunch: async (id) => (usingSupabase ? run(supabase.from('punches').delete().eq('id', id)) : change((s) => ({ ...s, punches: s.punches.filter((x) => x.id !== id) }))),

    // Time off.
    requestTimeOff: async (start, end, reason) =>
      usingSupabase
        ? run(supabase.rpc('request_time_off', { first_day: start, last_day: end, reason })).then(andTell('time_off_requested'))
        : change((s) => {
            s.timeOff.push({ id: newId('t'), employeeId: viewAs, start, end, reason, status: 'pending', createdAt: new Date().toISOString() })
            return s
          }),
    withdrawTimeOff: async (id) =>
      usingSupabase ? run(supabase.rpc('withdraw_time_off', { request_id: id })) : change((s) => ({ ...s, timeOff: s.timeOff.filter((t) => t.id !== id) })),
    decideTimeOff: async (id, status) => {
      const decidedAt = new Date().toISOString()
      if (!usingSupabase) {
        return change((s) => {
          const t = s.timeOff.find((x) => x.id === id)
          Object.assign(t, { status, decidedBy: myName, decidedAt })
          return s
        })
      }
      return run(supabase.from('time_off').update({ status, decided_by: myName, decided_at: decidedAt }).eq('id', id)).then(andTell('time_off_decided', { id }))
    },
    // Cover: someone gives a shift away (to the whole team or one person) or swaps it
    // for one of a coworker's. A coworker says yes, then a manager approves.
    // status: open (waiting for a coworker), taken (a coworker said yes, waiting for a
    // manager), approved, declined (by a manager), passed (the asked person said no), cancelled.
    // kind: 'giveaway' or 'swap'. targetId: who was asked (null = the whole team).
    requestCover: async (shiftId, note, { targetId = null, swapShiftId = null } = {}) => {
      if (usingSupabase) return run(supabase.rpc('request_cover', { shift: shiftId, note: (note || '').trim(), target: targetId, swap_shift: swapShiftId }))
      const shift = sample.shifts.find((x) => x.id === shiftId)
      if (!shift || shift.employeeId !== viewAs) return "That isn't your shift."
      if (!shift.published) return "That shift isn't published yet."
      if (shiftOver(shift)) return 'That shift is already over.'
      const busy = (id) => (sample.cover ?? []).some((c) => (c.status === 'open' || c.status === 'taken') && (c.shiftId === id || c.swapShiftId === id))
      if (busy(shiftId)) return 'There is already a cover request for that shift.'
      if (targetId) {
        const target = sample.employees.find((e) => e.id === targetId && e.active)
        if (!target || target.payType === 'none' || targetId === viewAs) return 'Pick a coworker who uses the app.'
      }
      if (swapShiftId) {
        const other = sample.shifts.find((x) => x.id === swapShiftId)
        if (!targetId || !other || other.employeeId !== targetId || !other.published) return "That isn't their shift."
        if (shiftOver(other)) return 'That shift is already over.'
        if (busy(swapShiftId)) return 'That shift already has a cover request.'
        if (clashes(sample, viewAs, other, shiftId)) return 'That shift overlaps one of your shifts, or you have time off that day.'
      }
      return change((s) => {
        s.cover = [...(s.cover ?? []), { id: newId('c'), kind: swapShiftId ? 'swap' : 'giveaway', shiftId, swapShiftId, targetId, requesterId: viewAs, note: (note || '').trim(), status: 'open', takerId: null, createdAt: new Date().toISOString() }]
        return s
      })
    },
    // Staff: a note about today (or yesterday), like a forgotten clock-in or work outside the shop.
    // tag: forgotIn, forgotOut, outside or other. Managers see it on their Today screen.
    addPunchNote: async ({ text, tag = 'other', date }) => {
      if (usingSupabase) return run(supabase.rpc('add_punch_note', { day: date || dateKey(new Date()), note_tag: tag, note: text }))
      if (!text.trim()) return 'Type a note first.'
      return change((s) => {
        s.punchNotes = [...(s.punchNotes ?? []), { id: newId('pn'), employeeId: viewAs, date: date || dateKey(new Date()), tag, text: text.trim(), createdAt: new Date().toISOString(), ackAt: null, ackBy: '' }]
        return s
      })
    },
    deletePunchNote: async (id) => {
      if (usingSupabase) return run(supabase.rpc('remove_punch_note', { note: id }))
      return change((s) => ({ ...s, punchNotes: (s.punchNotes ?? []).filter((n) => !(n.id === id && n.employeeId === viewAs && !n.ackAt)) }))
    },
    // Managers: mark a note as seen.
    ackPunchNote: async (id) => {
      if (usingSupabase) return run(supabase.rpc('ack_punch_note', { note: id }))
      if (!view.me?.isManager) return 'Only managers can do that.'
      return change((s) => {
        const n = (s.punchNotes ?? []).find((x) => x.id === id)
        if (n) Object.assign(n, { ackAt: new Date().toISOString(), ackBy: myName })
        return s
      })
    },
    // Managers' sticky notes and tasks. kind: 'note' or 'task'. color: 0 to 3. Tasks can have a dueDate and be done.
    // assignees: the staff tagged on it (they can see it, and check off a task). notify: tell them
    // (a push notification once the app is online). sendText: also text them, when texting exists.
    addNote: async ({ text, kind = 'note', color = 0, dueDate = '', assignees = [], notify = true, sendText = false }) => {
      if (usingSupabase) {
        if (!text.trim()) return 'Type something first.'
        return run(supabase.from('manager_notes').insert({
          kind, text: text.trim(), color, due_date: kind === 'task' && dueDate ? dueDate : null, assignees,
          notify: assignees.length > 0 && notify, send_text: assignees.length > 0 && sendText, created_by: myName,
        }))
      }
      if (!view.me?.isManager) return 'Only managers can add notes.'
      if (!text.trim()) return 'Type something first.'
      return change((s) => {
        s.notes = [{ id: newId('n'), text: text.trim(), kind, color, dueDate: kind === 'task' ? dueDate : '', assignees, notify: assignees.length > 0 && notify, sendText: assignees.length > 0 && sendText, done: false, createdBy: myName, createdAt: new Date().toISOString() }, ...(s.notes ?? [])]
        return s
      })
    },
    updateNote: async (id, changes) => {
      if (usingSupabase) {
        // Ticking a task off goes through finish_manager_task, so tagged staff can do it too.
        const onlyDone = Object.keys(changes).every((k) => k === 'done')
        if (onlyDone) return run(supabase.rpc('finish_manager_task', { note: id, is_done: changes.done }))
        return run(supabase.from('manager_notes').update(noteChangesToRow(changes)).eq('id', id))
      }
      const note = (sample.notes ?? []).find((x) => x.id === id)
      const manager = Boolean(view.me?.isManager)
      // Staff can only tick off a task they were tagged on.
      const mine = (note?.assignees ?? []).includes(viewAs) && Object.keys(changes).every((k) => k === 'done')
      if (!manager && !mine) return 'Only managers can change notes.'
      return change((s) => {
        const n = (s.notes ?? []).find((x) => x.id === id)
        if (n) {
          Object.assign(n, changes)
          if (changes.done === true) Object.assign(n, { doneAt: new Date().toISOString(), doneBy: myName })
          if (changes.done === false) Object.assign(n, { doneAt: null, doneBy: '' })
        }
        return s
      })
    },
    deleteNote: async (id) => {
      if (usingSupabase) return run(supabase.from('manager_notes').delete().eq('id', id))
      if (!view.me?.isManager) return 'Only managers can delete notes.'
      return change((s) => ({ ...s, notes: (s.notes ?? []).filter((x) => x.id !== id) }))
    },
    // Team tasks (update 029). Managers add and delete; staff take, give back and finish their own.
    addTask: async ({ title, note = '', date, time = null, assigneeId = '' }) => {
      if (!title.trim()) return 'Type the task first.'
      if (usingSupabase) {
        const { data: added, error: problem } = await supabase.from('team_tasks').insert({ date, time, title: title.trim(), note: note.trim(), created_by: myName }).select('id').single()
        if (problem) return problem.message || 'Something went wrong'
        if (assigneeId && added?.id) {
          const { error: handOut } = await supabase.rpc('set_team_task', { task: added.id, who: assigneeId })
          if (handOut) return handOut.message || 'Something went wrong'
        }
        return run(Promise.resolve({ error: null }))
      }
      if (!view.me?.isManager) return 'Only managers can add tasks.'
      return change((s) => {
        const handed = assigneeId ? { claimedBy: assigneeId, assigned: assigneeId !== viewAs, assignedBy: assigneeId !== viewAs ? myName : '', claimedAt: new Date().toISOString() } : {}
        s.tasks = [...(s.tasks ?? []), { id: newId('t'), date, time, title: title.trim(), note: note.trim(), claimedBy: null, assigned: false, assignedBy: '', claimedAt: null, doneAt: null, doneBy: '', createdBy: myName, createdAt: new Date().toISOString(), ...handed }]
        return s
      })
    },
    // who: your own id to take it, null to give it back, someone else's id (managers) to hand it over.
    setTaskHolder: async (id, who) => {
      if (usingSupabase) return run(supabase.rpc('set_team_task', { task: id, who }))
      const task = (sample.tasks ?? []).find((t) => t.id === id)
      if (!task) return 'That task is gone.'
      const boss = Boolean(view.me?.isManager)
      if (who === null) {
        if (!boss && (task.claimedBy !== viewAs || task.assigned)) return 'Only the person who took it can give it back.'
      } else if (!boss && (who !== viewAs || (task.claimedBy && task.claimedBy !== viewAs))) {
        return task.claimedBy ? 'Someone already took this one.' : 'Only a manager can hand a task to someone else.'
      }
      return change((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (who === null) Object.assign(t, { claimedBy: null, assigned: false, assignedBy: '', claimedAt: null, doneAt: null, doneBy: '' })
        else Object.assign(t, { claimedBy: who, assigned: who !== viewAs, assignedBy: who !== viewAs ? myName : '', claimedAt: new Date().toISOString(), doneAt: null, doneBy: '' })
        return s
      })
    },
    finishTask: async (id, done = true) => {
      if (usingSupabase) return run(supabase.rpc('finish_team_task', { task: id, is_done: done }))
      const task = (sample.tasks ?? []).find((t) => t.id === id)
      if (!task) return 'That task is gone.'
      if (!view.me?.isManager && task.claimedBy !== viewAs) return 'Take the task first.'
      return change((s) => {
        Object.assign(s.tasks.find((x) => x.id === id), done ? { doneAt: new Date().toISOString(), doneBy: myName } : { doneAt: null, doneBy: '' })
        return s
      })
    },
    deleteTask: async (id) => {
      if (usingSupabase) return run(supabase.from('team_tasks').delete().eq('id', id))
      if (!view.me?.isManager) return 'Only managers can delete tasks.'
      return change((s) => ({ ...s, tasks: (s.tasks ?? []).filter((x) => x.id !== id) }))
    },
    cancelCover: async (id) => {
      if (usingSupabase) return run(supabase.rpc('cancel_cover', { request: id }))
      return change((s) => {
        const c = (s.cover ?? []).find((x) => x.id === id)
        if (c && c.requesterId === viewAs && (c.status === 'open' || c.status === 'taken')) c.status = 'cancelled'
        return s
      })
    },
    // Say yes: take the shift (or, for a swap, agree to trade).
    takeCover: async (id) => {
      if (usingSupabase) return run(supabase.rpc('take_cover', { request: id }))
      const c = (sample.cover ?? []).find((x) => x.id === id)
      if (!c || c.status !== 'open') return 'That request is no longer open.'
      const shift = sample.shifts.find((x) => x.id === c.shiftId)
      if (!shift) return 'That shift is gone.'
      if (c.requesterId === viewAs) return "That's your own shift."
      if (c.targetId && c.targetId !== viewAs) return 'That request is for someone else.'
      if (clashes(sample, viewAs, shift, c.swapShiftId)) return 'This overlaps one of your shifts, or you have time off that day.'
      return change((s) => {
        Object.assign(s.cover.find((x) => x.id === id), { status: 'taken', takerId: viewAs, takenAt: new Date().toISOString() })
        return s
      })
    },
    // Say no to a request made to me.
    passCover: async (id) => {
      if (usingSupabase) return run(supabase.rpc('pass_cover', { request: id }))
      return change((s) => {
        const c = (s.cover ?? []).find((x) => x.id === id)
        if (c && c.status === 'open' && c.targetId === viewAs) Object.assign(c, { status: 'passed', passedAt: new Date().toISOString() })
        return s
      })
    },
    decideCover: async (id, approve) => {
      if (usingSupabase) return run(supabase.rpc('decide_cover', { request: id, approve }))
      return change((s) => {
        const c = (s.cover ?? []).find((x) => x.id === id)
        if (!c || c.status !== 'taken') return s
        const shift = s.shifts.find((x) => x.id === c.shiftId)
        const other = c.swapShiftId ? s.shifts.find((x) => x.id === c.swapShiftId) : null
        // If either shift changed hands since the request, it can't go ahead.
        const stale = !shift || shift.employeeId !== c.requesterId || (c.swapShiftId && (!other || other.employeeId !== c.takerId))
        if (stale) return Object.assign(c, { status: 'cancelled' }) && s
        Object.assign(c, { status: approve ? 'approved' : 'declined', decidedBy: myName, decidedAt: new Date().toISOString() })
        if (approve) {
          // The shifts change hands and are posted to the new people as if new.
          const postedAt = new Date().toISOString()
          Object.assign(shift, { employeeId: c.takerId, postedAt })
          if (other) Object.assign(other, { employeeId: c.requesterId, postedAt })
        }
        return s
      })
    },
    deleteTimeOff: async (id) => (usingSupabase ? run(supabase.from('time_off').delete().eq('id', id)) : change((s) => ({ ...s, timeOff: s.timeOff.filter((t) => t.id !== id) }))),

    // Managers: add or change someone on the team, with their pay settings.
    // Managers: take someone off the team for good, with their shifts, punches,
    // time off and pay settings. (Unticking Active keeps all of that.)
    deleteEmployee: async (id) =>
      usingSupabase
        ? run(supabase.from('employees').delete().eq('id', id))
        : change((s) => {
            const keep = (x) => x.employeeId !== id
            const { [id]: _gone, ...pay } = s.pay
            return { ...s, employees: s.employees.filter((e) => e.id !== id), pay, shifts: s.shifts.filter(keep), punches: s.punches.filter(keep), timeOff: s.timeOff.filter(keep) }
          }),

    saveEmployee: async (employee, pay) => {
      if (!usingSupabase) {
        return change((s) => {
          const id = employee.id ?? newId('e')
          const i = s.employees.findIndex((x) => x.id === id)
          const none = employee.payType === 'none'
          if (i >= 0) s.employees[i] = { ...employee, ...(none ? { email: '', isManager: false } : {}) }
          else s.employees.push({ ...employee, ...(none ? { email: '', isManager: false } : {}), id })
          if (none) delete s.pay[id]
          else s.pay[id] = { ...pay, employeeId: id }
          return s
        })
      }
      // Schedule-only people (update 020) have no email, manager access or pay.
      const none = employee.payType === 'none'
      const row = { name: employee.name.trim(), email: none ? null : employee.email.trim().toLowerCase(), position: employee.position.trim(), is_manager: none ? false : employee.isManager, ...(employee.startedOn !== undefined ? { started_on: employee.startedOn || null } : {}), ...(employee.group !== undefined ? { group_name: employee.group || null } : {}), pay_type: employee.payType, active: employee.active }
      const saved = employee.id
        ? await supabase.from('employees').update(row).eq('id', employee.id).select().single()
        : await supabase.from('employees').insert(row).select().single()
      if (saved.error) {
        if (saved.error.code === '23505') return 'Someone on the team already has that email.'
        if (none && /pay_type|null value|email/.test(saved.error.message)) return 'Run supabase/updates/020-schedule-only.sql in Supabase first.'
        return saved.error.message
      }
      if (none) return run(supabase.from('employee_pay').delete().eq('employee_id', saved.data.id))
      return run(supabase.from('employee_pay').upsert(payToRow(saved.data.id, pay)))
    },
  }

  return {
    ...view,
    loading,
    error,
    setupMissing,
    reload: load,
    actions,
    today,
    sample: usingSupabase
      ? null
      : {
          viewAs,
          setViewAs,
          kind: sampleKind,
          // Switch between the 6-person shop and the 23-person restaurant; each keeps its own saved changes.
          setKind: (kind) => {
            try {
              localStorage.setItem(SAMPLE_KIND_KEY, kind)
            } catch {
              // Not important if this can't be saved.
            }
            setSample(loadSample(kind))
            setSampleKindState(kind)
            setViewAs('e1')
          },
          reset: () => setSample(createSampleFor(sampleKind)),
        },
  }
}
