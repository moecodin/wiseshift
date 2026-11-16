// Hours and paycheck estimates for the team page.
//
//   Schedule   weeks run Sunday to Saturday, like Humanity.
//   Pay period every two weeks, Friday to Thursday (Oct 9–22, 2026 was one),
//              the same periods as the Humanity timesheets.
//   Hours      every punch that starts in the period (clocked in → clocked out).
//              Someone still clocked in counts up to now.
//   Overtime   time and a half after 40 hours in a workweek (Friday to Thursday,
//              so each pay period is two workweeks), for federal and New York law.
//   Estimate   federal income tax (Pub 15-T percentage method), Social Security,
//              Medicare, New York State (and NYC) income tax, NY disability and
//              paid family leave. Yearly caps (Social Security, family leave) only
//              matter above about $95,000 a year, so they're left out.
//
// This is an estimate for the employee to see on their phone. The real paycheck
// and stub come from the payroll service.
import { dateKey, fromKey } from '../lib/dates.js'
import {
  FEDERAL, MEDICARE, NEW_YORK, NY_DISABILITY, NY_PAID_FAMILY_LEAVE, NYC, OVERTIME_AFTER_HOURS, OVERTIME_RATE, SOCIAL_SECURITY,
} from './taxRates.js'

const PAYCHECKS_A_YEAR = 26
const PERIOD_ANCHOR = '2026-10-09' // the first day of a known pay period (a Friday)
const round2 = (n) => Math.round(n * 100) / 100

// ---------- Weeks and pay periods ----------

const daysFrom = (start, count) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return dateKey(d)
  })

// The schedule week a date falls in: seven date keys, Sunday first.
export function scheduleWeekOf(date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  return daysFrom(start, 7)
}

// The pay period a date falls in: fourteen date keys, Friday first.
export function payPeriodOf(date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  const anchor = fromKey(PERIOD_ANCHOR)
  const daysSince = Math.round((day - anchor) / 86400000)
  const start = new Date(anchor)
  start.setDate(start.getDate() + Math.floor(daysSince / 14) * 14)
  return daysFrom(start, 14)
}

// The week or period before (-1) or after (+1) these days.
export function moveDays(days, steps) {
  const d = fromKey(days[0])
  d.setDate(d.getDate() + steps * days.length)
  return days.length === 14 ? payPeriodOf(d) : scheduleWeekOf(d)
}

// ---------- Hours ----------

export const minutesBetween = (from, to) => Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000))

// One punch's minutes (an open punch counts up to now).
export const punchMinutes = (p, now = new Date()) => minutesBetween(p.clockIn, p.clockOut ?? now)

// A scheduled shift's paid minutes (any unpaid break taken off).
export const shiftMinutes = (s) => Math.max(0, s.end - s.start - (s.breakMin || 0))

// Hours as a number with two decimals, like the timesheets (8h 50m → 8.84 is
// 530.4 minutes; 7h 45m → 7.75).
export const decimalHours = (minutes) => round2(minutes / 60)
export const formatHours = (minutes) => decimalHours(minutes).toFixed(2)

// One person's hours for some days: punches by day, total, regular and overtime
// minutes. Overtime is counted in each seven-day workweek.
export function periodHours(punches, employeeId, days, now = new Date()) {
  const mine = punches
    .filter((p) => p.employeeId === employeeId && days.includes(dateKey(new Date(p.clockIn))))
    .sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))
  const byDay = days.map((date) => {
    const list = mine.filter((p) => dateKey(new Date(p.clockIn)) === date)
    return { date, punches: list, minutes: list.reduce((sum, p) => sum + punchMinutes(p, now), 0) }
  })
  let regular = 0
  let overtime = 0
  for (let i = 0; i < byDay.length; i += 7) {
    const week = byDay.slice(i, i + 7).reduce((sum, d) => sum + d.minutes, 0)
    regular += Math.min(week, OVERTIME_AFTER_HOURS * 60)
    overtime += Math.max(0, week - OVERTIME_AFTER_HOURS * 60)
  }
  return { byDay, total: regular + overtime, regular, overtime, open: mine.some((p) => !p.clockOut) }
}

// Gross pay for hourly work.
export function grossPay(hours, rate) {
  const regularPay = round2((hours.regular / 60) * rate)
  const overtimePay = round2((hours.overtime / 60) * rate * OVERTIME_RATE)
  return { regularPay, overtimePay, gross: round2(regularPay + overtimePay) }
}

// ---------- Taxes ----------

// Tax on a yearly amount from a list of [top of bracket, rate].
function bracketTax(amount, brackets) {
  let tax = 0
  let bottom = 0
  for (const [top, rate] of brackets) {
    if (amount <= bottom) break
    tax += (Math.min(amount, top) - bottom) * rate
    bottom = top
  }
  return tax
}

// Federal income tax for one paycheck, from the W-4 (Pub 15-T percentage
// method). With the Step 2 box checked, the standard deduction and brackets are halved.
export function federalWithholding(taxableWages, pay) {
  const status = pay.filingStatus in FEDERAL.brackets ? pay.filingStatus : 'single'
  const half = pay.step2 ? 0.5 : 1
  const brackets = FEDERAL.brackets[status].map(([top, rate]) => [top * half, rate])
  const yearly = taxableWages * PAYCHECKS_A_YEAR + (pay.otherIncome || 0) - (pay.deductions || 0)
  const taxable = Math.max(0, yearly - FEDERAL.standardDeduction[status] * half)
  const tax = Math.max(0, bracketTax(taxable, brackets) - (pay.dependents || 0))
  return round2(tax / PAYCHECKS_A_YEAR + (pay.extraWithholding || 0))
}

// New York State (and NYC) income tax for one paycheck, from the IT-2104.
export function newYorkWithholding(taxableWages, pay) {
  const status = pay.nyStatus === 'married' ? 'married' : 'single'
  const yearly = taxableWages * PAYCHECKS_A_YEAR - NEW_YORK.deductionAllowance[status] - NEW_YORK.perAllowance * (pay.nyAllowances || 0)
  const taxable = Math.max(0, yearly)
  const state = round2(bracketTax(taxable, NEW_YORK.brackets[status]) / PAYCHECKS_A_YEAR + (pay.nyExtra || 0))
  const city = pay.nycResident ? round2(bracketTax(taxable, NYC.brackets[status]) / PAYCHECKS_A_YEAR) : 0
  return { state, city }
}

// Every line of one paycheck estimate, and what's left.
export function estimatePaycheck(gross, pay) {
  const pretax = Math.min(gross, pay.pretax || 0)
  const taxable = gross - pretax
  const ny = newYorkWithholding(taxable, pay)
  const lines = [
    { key: 'federal', label: 'Federal income tax', amount: federalWithholding(taxable, pay) },
    { key: 'ss', label: 'Social Security (6.2%)', amount: round2(gross * SOCIAL_SECURITY.rate) },
    { key: 'medicare', label: 'Medicare (1.45%)', amount: round2(gross * MEDICARE.rate) },
    { key: 'nys', label: 'New York State income tax', amount: ny.state },
    pay.nycResident && { key: 'nyc', label: 'New York City income tax', amount: ny.city },
    { key: 'sdi', label: 'NY disability', amount: round2(Math.min(gross * NY_DISABILITY.rate, NY_DISABILITY.maxPerWeek * 2)) },
    { key: 'pfl', label: 'NY paid family leave', amount: round2(gross * NY_PAID_FAMILY_LEAVE.rate) },
    pretax > 0 && { key: 'pretax', label: 'Pre-tax deductions (401(k) etc.)', amount: round2(pretax) },
  ].filter(Boolean)
  const taken = round2(lines.reduce((sum, l) => sum + l.amount, 0))
  return { gross: round2(gross), lines, taken, net: round2(gross - taken) }
}
