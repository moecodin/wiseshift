// A bigger made-up team for trying the team page with a restaurant: managers, cashiers, waiters,
// kitchen and hosts (23 people in five groups), three weeks of shifts and two weeks of punches.
// Switch to it from the sample bar. Shaped like sampleTeam.js (same ids for Maria and Sam).
import { dateKey, fromKey } from '../lib/dates.js'
import { scheduleWeekOf } from './paycheck.js'
import { SHOP, W4, near } from './sampleTeam.js'

const GROUPS = [
  { name: 'Management', color: 0 },
  { name: 'Cashiers', color: 1 },
  { name: 'Waiters', color: 2 },
  { name: 'Kitchen', color: 3 },
  { name: 'Hosts', color: 4 },
]
const ROLES = [
  { name: 'Cashier', color: 1 },
  { name: 'Waiter', color: 2 },
  { name: 'Kitchen', color: 3 },
  { name: 'Host', color: 4 },
]
const PRESETS = [
  { title: 'Lunch', start: 630, end: 960 },
  { title: 'Dinner', start: 960, end: 1320 },
  { title: 'Day', start: 540, end: 1020 },
  { title: 'Double', start: 630, end: 1320 },
]
// [name, position, group, hourly rate, shift types they work]
const STAFF = [
  ['Maria Lopez', 'General Manager', 'Management', 28, ['Day']],
  ['Sam Lucero', 'Assistant Manager', 'Management', 22, ['Dinner']],
  ['Tomas Rivera', 'Shift Lead', 'Management', 20, ['Lunch', 'Dinner']],
  ['Ana Ramos', 'Cashier', 'Cashiers', 16, ['Lunch']],
  ['Ben Kim', 'Cashier', 'Cashiers', 16, ['Lunch']],
  ['Chloe Davis', 'Cashier', 'Cashiers', 16, ['Dinner']],
  ['Dario Pena', 'Cashier', 'Cashiers', 16, ['Dinner']],
  ['Cara Mendes', 'Waiter', 'Waiters', 15, ['Dinner']],
  ['Dev Patel', 'Waiter', 'Waiters', 15, ['Dinner']],
  ['Eli Stone', 'Waiter', 'Waiters', 15, ['Lunch']],
  ['Fiona Walsh', 'Waiter', 'Waiters', 15, ['Lunch']],
  ['Gabe Ortiz', 'Waiter', 'Waiters', 15, ['Dinner']],
  ['Hana Lee', 'Waiter', 'Waiters', 15, ['Lunch', 'Dinner']],
  ['Ivy Chen', 'Waiter', 'Waiters', 15, ['Dinner']],
  ['Jon Park', 'Waiter', 'Waiters', 15, ['Lunch']],
  ['Gus Thompson', 'Line Cook', 'Kitchen', 21, ['Day']],
  ['Hector Diaz', 'Line Cook', 'Kitchen', 21, ['Dinner']],
  ['Ines Costa', 'Prep Cook', 'Kitchen', 18, ['Day']],
  ['Jamal Brooks', 'Dishwasher', 'Kitchen', 16, ['Dinner']],
  ['Kai Nakamura', 'Prep Cook', 'Kitchen', 18, ['Lunch']],
  ['Lena Fischer', 'Line Cook', 'Kitchen', 21, ['Dinner']],
  ['Mia Alvarez', 'Host', 'Hosts', 15, ['Dinner']],
  ['Noah Bell', 'Host', 'Hosts', 15, ['Lunch', 'Dinner']],
]
const ROLE_OF = { Management: '', Cashiers: 'Cashier', Waiters: 'Waiter', Kitchen: 'Kitchen', Hosts: 'Host' }
// A repeatable pseudo-random number from a seed, 0 to 999, so the sample is the same every time.
const rnd = (seed) => Math.floor(((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 * 1000)

export function createRestaurantSample(today) {
  const todayKey = dateKey(today)
  const people = STAFF.map(([name, position, group, , ], i) => ({
    id: `e${i + 1}`, name, email: `${name.split(' ')[0].toLowerCase()}${i + 1}@example.com`, position, group, isManager: i === 0, payType: 'hourly', active: true,
    staffNo: i + 1, startedOn: `202${2 + (i % 3)}-0${1 + (i % 9)}-15`, priorMinutes: 20000 + i * 3000,
  }))
  const pay = Object.fromEntries(STAFF.map(([, , , rate], i) => [`e${i + 1}`, { ...W4, employeeId: `e${i + 1}`, hourlyRate: rate }]))
  const week = (offset) => scheduleWeekOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset * 7))
  const stamp = (key, minutes) => {
    const d = fromKey(key)
    d.setMinutes(minutes)
    return d.toISOString()
  }
  const shifts = []
  const punches = []
  let n = 0
  const postedFor = (days) => stamp(dateKey(new Date(fromKey(days[0]).getTime() - 4 * 86400000)), 18 * 60)
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const oldCutoff = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4))
  for (const offset of [-3, -2, -1, 0, 1]) {
    const postedAt = offset < 1 ? postedFor(week(offset)) : null
    for (const date of week(offset)) {
      const weekday = fromKey(date).getDay()
      STAFF.forEach(([, , group, , types], i) => {
        // Everyone has two days off a week, spread around so the days stay evenly staffed.
        if (weekday === (i * 2) % 7 || weekday === (i * 2 + 3) % 7) return
        const type = PRESETS.find((p) => p.title === types[(weekday + i) % types.length])
        const employeeId = `e${i + 1}`
        shifts.push({ id: `s${++n}`, employeeId, date, start: type.start, end: type.end, breakMin: 0, title: type.title, role: ROLE_OF[group], note: '', published: offset < 1, postedAt })
        if (date > todayKey) return
        const r = rnd(n)
        // Mostly a few minutes either side; about 1 in 12 is properly late, and 1 in 15 leaves early.
        const early = r % 12 === 0 ? 18 + (r % 14) : ((r * 7) % 13) - 8
        const late = r % 15 === 1 ? -(35 + (r % 40)) : ((r * 5) % 17) - 5
        if (date === todayKey) {
          if (type.start + early <= nowMinutes) {
            punches.push({ id: `p${++n}`, employeeId, clockIn: stamp(date, type.start + early), clockOut: null, note: '', inSpot: near(n), outSpot: null, inAddress: '542 Main St' })
          }
          return
        }
        const inSpot = rnd(n + 3) % 19 === 0 ? null : near(n)
        const outSpot = rnd(n + 5) % 13 === 0 ? near(n, 0.8) : near(n + 1)
        const old = date < oldCutoff
        const forgot = date === dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)) && i === 12
        punches.push({
          id: `p${++n}`, employeeId, clockIn: stamp(date, type.start + early), clockOut: forgot ? null : stamp(date, type.end + late), note: '',
          inSpot, outSpot: forgot ? null : outSpot, inAddress: inSpot ? '542 Main St' : '', outAddress: outSpot && !forgot ? '543 Main St' : '',
          approvedAt: old ? stamp(date, type.end + 120) : null, approvedBy: old ? 'Maria Lopez' : null,
        })
      })
    }
  }
  const later = (days) => dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))
  const now = new Date().toISOString()
  const timeOff = [
    { id: 't1', employeeId: 'e9', start: later(3), end: later(5), reason: 'Family trip', status: 'pending', createdAt: now },
    { id: 't2', employeeId: 'e14', start: later(6), end: later(6), reason: 'Doctor', status: 'approved', decidedBy: 'Maria Lopez', decidedAt: now, createdAt: now },
    { id: 't3', employeeId: 'e20', start: later(1), end: later(2), reason: '', status: 'pending', createdAt: now },
  ]
  const priv = {
    e1: { employeeId: 'e1', phone: '(516) 555-0101', emergencyName: '', emergencyPhone: '', noticeAckAt: now, noticeVersion: 1 },
  }
  const seen = Object.fromEntries(STAFF.slice(0, 12).map((_, i) => [`e${i + 1}`, now]))
  return {
    employees: people, pay, shifts, punches, timeOff, shop: SHOP, prefs: {}, private: priv, seen, tasks: [],
    settings: { groups: GROUPS, groupsReady: true, roles: ROLES, shiftPresets: PRESETS, positions: [...new Set(STAFF.map((s) => s[1]))] },
  }
}
