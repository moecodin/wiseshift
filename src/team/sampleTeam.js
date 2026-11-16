// Made-up team, shifts and punches for trying the team page without Supabase.
// Shaped like the Humanity schedule (Open 8–2, Close 2–8, All Day 8–8), with dates
// placed around today so this week and pay period always have something in them.
// Pay rates and tax settings are made up.
import { dateKey, fromKey } from '../lib/dates.js'
import { scheduleWeekOf } from './paycheck.js'

const people = [
  // priorMinutes: time clocked before the sample punches, for the Pocket Trainer card.
  { id: 'e1', name: 'Maria Lopez', email: 'maria@example.com', position: 'Manager', isManager: true, payType: 'hourly', active: true, staffNo: 1, startedOn: '2022-05-01', priorMinutes: 180000 },
  { id: 'e2', name: 'Sam Lucero', email: 'johnatan@example.com', position: 'Assistant Manager', isManager: false, payType: 'hourly', active: true, staffNo: 42, startedOn: '2024-09-01', priorMinutes: 24000 },
  { id: 'e3', name: 'Maria Bertha', email: 'maria@example.com', position: 'Team Member', isManager: false, payType: 'hourly', active: true, staffNo: 7, startedOn: '2023-11-15', priorMinutes: 60000 },
  { id: 'e4', name: 'Melissa Hosein', email: 'melissa@example.com', position: 'Team Member', isManager: false, payType: 'hourly', active: true, staffNo: 12, startedOn: '2024-02-01', priorMinutes: 40000 },
  // On the schedule only: no email, login, clock or pay (update 020).
  { id: 'e6', name: 'Nema', email: '', position: '', isManager: false, payType: 'none', active: true, staffNo: null, startedOn: '', priorMinutes: 0 },
  { id: 'e5', name: 'Sueann Sookdar', email: 'sueann@example.com', position: 'Assistant Manager', isManager: false, payType: 'hourly', active: true, staffNo: 9, startedOn: '2023-06-01', priorMinutes: 70000 },
]

const W4 = { filingStatus: 'single', step2: false, dependents: 0, otherIncome: 0, deductions: 0, extraWithholding: 0, pretax: 0, nyStatus: 'single', nyAllowances: 0, nyExtra: 0, nycResident: false }

const pay = {
  e1: { ...W4, employeeId: 'e1', hourlyRate: 26, filingStatus: 'married', nyStatus: 'married', dependents: 2200, nyAllowances: 1 },
  e2: { ...W4, employeeId: 'e2', hourlyRate: 20 },
  e3: { ...W4, employeeId: 'e3', hourlyRate: 17.5, filingStatus: 'head', dependents: 2200 },
  e4: { ...W4, employeeId: 'e4', hourlyRate: 17.5 },
  e5: { ...W4, employeeId: 'e5', hourlyRate: 20, nycResident: true },
}

const OPEN = { title: 'Open', start: 480, end: 840 }
const CLOSE = { title: 'Close', start: 840, end: 1200 }
const ALL_DAY = { title: 'All Day', start: 480, end: 1200 }
const SATURDAY = { title: 'All Day Saturday', start: 480, end: 1140 }
const SUNDAY = { title: '', start: 540, end: 1080 }

// Each person's usual week, by weekday (0 = Sunday).
const pattern = {
  e1: { 0: SUNDAY, 2: OPEN, 3: OPEN, 4: OPEN, 6: SATURDAY },
  e2: { 0: SUNDAY, 1: OPEN, 4: CLOSE },
  e3: { 1: CLOSE, 2: ALL_DAY, 5: OPEN },
  e4: { 3: ALL_DAY, 6: SATURDAY },
  e5: { 1: ALL_DAY, 2: CLOSE, 3: CLOSE, 5: CLOSE },
  e6: { 2: OPEN, 5: ALL_DAY },
}

// Made-up spot standing in for the shop (the real one is set on the Team tab).
const SHOP = { lat: 40.6787, lng: -73.589, radius: 152.4 }
// Somewhere near the shop: a few meters off, or `miles` away for a job site.
const near = (n, miles = 0) => ({
  lat: SHOP.lat + (((n * 37) % 21) - 10) / 111000 + miles / 69,
  lng: SHOP.lng + (((n * 53) % 21) - 10) / 84000,
  accuracy: 8 + ((n * 13) % 25),
})

export function createSampleTeam(today) {
  const todayKey = dateKey(today)
  const week = (offset) => scheduleWeekOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset * 7))
  const stamp = (key, minutes) => {
    const d = fromKey(key)
    d.setMinutes(minutes)
    return d.toISOString()
  }
  const shifts = []
  const punches = []
  let n = 0
  // Each week was posted the Wednesday before it, at 6 PM.
  const postedFor = (days) => stamp(dateKey(new Date(fromKey(days[0]).getTime() - 4 * 86400000)), 18 * 60)
  for (const offset of [-3, -2, -1, 0, 1]) {
    const postedAt = offset < 1 ? postedFor(week(offset)) : null
    for (const date of week(offset)) {
      const weekday = fromKey(date).getDay()
      for (const [employeeId, days] of Object.entries(pattern)) {
        const s = days[weekday]
        if (!s) continue
        // Next week is still a draft, to try Publish.
        shifts.push({ id: `s${++n}`, employeeId, date, start: s.start, end: s.end, breakMin: 0, title: s.title, note: '', published: offset < 1, postedAt })
        if (date > todayKey || employeeId === 'e6') continue
        // A few minutes early or late, like real punches.
        const early = ((n * 7) % 13) - 6
        const late = ((n * 5) % 15) - 4
        if (date === todayKey) {
          // Today: whoever has a shift that started is clocked in.
          const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
          // Sam clocked in from a job site 2 miles away.
          if (s.start + early <= nowMinutes) {
            punches.push({ id: `p${++n}`, employeeId, clockIn: stamp(date, s.start + early), clockOut: null, note: '', inSpot: near(n, employeeId === 'e2' ? 2 : 0), outSpot: null, inAddress: employeeId === 'e2' ? '210 Babylon Tpke' : '542 Main St' })
          }
          continue
        }
        // Now and then someone doesn't allow location, or clocks out away from the shop.
        // Punches more than 2 days old are already approved; newer ones wait for Review.
        const old = date < dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2))
        const inSpot = n % 17 === 0 ? null : near(n)
        const outSpot = n % 11 === 0 ? near(n, 0.8) : near(n + 1)
        punches.push({
          id: `p${++n}`, employeeId, clockIn: stamp(date, s.start + early), clockOut: stamp(date, s.end + late), note: '',
          inSpot, outSpot, inAddress: inSpot ? '542 Main St' : '', outAddress: outSpot ? (outSpot.lat - SHOP.lat > 0.005 ? '18 Oak Rd' : '543 Main St') : '',
          approvedAt: old ? stamp(date, s.end + 120) : null, approvedBy: old ? 'Maria Lopez' : null,
        })
      }
    }
  }
  const later = (days) => dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))
  const now = new Date().toISOString()
  // Sueann worked yesterday with no shift on the schedule, for Review's warnings.
  const yesterday = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
  punches.push({
    id: `p${++n}`, employeeId: 'e5', clockIn: stamp(yesterday, 472), clockOut: stamp(yesterday, 1120), note: '',
    inSpot: near(n), outSpot: near(n + 1), inAddress: '542 Main St', outAddress: '543 Main St', approvedAt: null, approvedBy: null,
  })
  const timeOff = [
    { id: 't1', employeeId: 'e2', start: later(9), end: later(11), reason: "Cousin's wedding", status: 'pending', createdAt: now },
    { id: 't2', employeeId: 'e4', start: later(4), end: later(4), reason: 'Doctor', status: 'approved', decidedBy: 'Maria Lopez', decidedAt: now, createdAt: now },
  ]
  // Sam and Melissa have picked their themes, and Maria reads it in Spanish, to try them.
  const prefs = { e2: { theme: 'trainer', sounds: false }, e3: { lang: 'es' }, e4: { theme: 'cats', sounds: false } }
  // Sample phones; Maria has read the location notice, the others haven't yet.
  const priv = {
    e1: { employeeId: 'e1', phone: '(516) 555-0101', emergencyName: '', emergencyPhone: '', noticeAckAt: null, noticeVersion: null },
    e3: { employeeId: 'e3', phone: '(516) 555-0133', emergencyName: 'Rosa Bertha (mom)', emergencyPhone: '(516) 555-0190', noticeAckAt: now, noticeVersion: 1 },
  }
  // Last opened the app, for the ✓✓ on the Schedule: Maria not since this week
  // was posted, Sueann never.
  const seen = { e1: now, e2: now, e3: stamp(dateKey(new Date(fromKey(week(0)[0]).getTime() - 6 * 86400000)), 9 * 60), e4: now }
  return { employees: people, pay, shifts, punches, timeOff, shop: SHOP, prefs, private: priv, seen }
}
