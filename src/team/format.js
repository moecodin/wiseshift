// Small display helpers for the team page.
import { useEffect, useState } from 'react'
import { DAY_NAMES, dateKey, formatShort, fromKey } from '../lib/dates.js'

// Minutes after midnight → "8:00 AM".
export function clockTime(minutes) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// "8:00 AM – 2:00 PM"
export const shiftTimes = (s) => `${clockTime(s.start)} – ${clockTime(s.end)}`

// For <input type="time">: 480 ↔ "08:00".
export const toTimeInput = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
export function fromTimeInput(value) {
  const [h, m] = (value || '').split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

// A saved timestamp → "08:00" for <input type="time">, and back onto a date.
export function isoToTimeInput(iso) {
  const d = new Date(iso)
  return toTimeInput(d.getHours() * 60 + d.getMinutes())
}
export function timeInputToIso(dateKeyValue, value) {
  const minutes = fromTimeInput(value)
  if (minutes === null) return null
  const d = fromKey(dateKeyValue)
  d.setMinutes(minutes)
  return d.toISOString()
}

// "Sun, Oct 25"
export const dayLabel = (key) => `${DAY_NAMES[fromKey(key).getDay()].slice(0, 3)}, ${formatShort(fromKey(key))}`
// "Oct 25 – Oct 31"
export const rangeLabel = (days) => `${formatShort(fromKey(days[0]))} – ${formatShort(fromKey(days.at(-1)))}`
// "Oct 25" or "Oct 25 – Oct 27"
export const datesLabel = (start, end) => (start === end ? dayLabel(start) : `${dayLabel(start)} – ${dayLabel(end)}`)

export const todayKey = () => dateKey(new Date())

export const money = (n) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// "6 Hours", "1 Hour 15 Min", "40 Min": the time an Approve button is about to approve.
export const hoursLabel = (minutes) => {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return [h > 0 && `${h} ${h === 1 ? 'Hour' : 'Hours'}`, m > 0 && `${m} Min`].filter(Boolean).join(' ') || '0 Min'
}

export const firstName = (name) => (name || '').split(' ')[0]

// The time now, updated every so often (for running clocks).
export function useNow(everyMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}

// Is this date inside someone's approved time off?
export const offOn = (teamOff, employeeId, date) => teamOff.find((t) => t.employeeId === employeeId && t.start <= date && t.end >= date)

// On the schedule only (update 020): no login, no pay, no clock. Like Nema.
export const scheduleOnly = (e) => e?.payType === 'none'
