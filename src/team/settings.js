// Business settings (⚙️ → Business, managers only; team_settings in update 018).
// These are the defaults: what the page uses before 018, and in sample mode.

export const DEFAULT_NOTICE = `Notice of electronic monitoring (New York Civil Rights Law § 52-c)

Your employer records the location of your phone at the moment you clock in and the moment you clock out in the WiseShift app. It is used to confirm where work started and ended (for example at the shop or a job site), and is kept with your time records.

Your location is not tracked at any other time. You can see your own clock-in and clock-out places in the app, and managers can see them for everyone.

By tapping "I've read this", you acknowledge that you received this notice.`

export const DEFAULT_SETTINGS = {
  clockInEarly: 30, // minutes before a shift that Clock in appears
  allowAnyway: true, // "Working a shift that isn't on the schedule? Clock in anyway"
  roundWithin: 10, // punches less than this many minutes from the hour count as on the hour (0 = off)
  shiftPresets: [
    { title: 'Open', start: 480, end: 840 },
    { title: 'Close', start: 840, end: 1200 },
    { title: 'All Day', start: 480, end: 1200 },
  ],
  roles: [
    { name: 'Front desk', color: 0 },
    { name: 'Floor', color: 3 },
    { name: 'Prep', color: 2 },
    { name: 'Delivery', color: 6 },
  ], // what a person does on a shift; the manager picks one per shift
  positions: ['Manager', 'Assistant Manager', 'Team Member'],
  remindBefore: 30, // shift reminder
  remindAfter: 30, // "still clocked in?"
  lateAfter: 15, // late alert to managers
  quietFrom: 21 * 60, // 9 PM
  quietTo: 6 * 60, // 6 AM
  noticeText: DEFAULT_NOTICE,
  noticeVersion: 1,
}

// team_settings row (or nothing) → settings, falling back to the defaults.
export function settingsFromRow(r) {
  if (!r) return DEFAULT_SETTINGS
  const pick = (value, fallback) => (value === undefined || value === null ? fallback : value)
  const d = DEFAULT_SETTINGS
  return {
    clockInEarly: pick(r.clock_in_early, d.clockInEarly),
    allowAnyway: pick(r.allow_anyway, d.allowAnyway),
    roundWithin: pick(r.round_within, d.roundWithin),
    shiftPresets: Array.isArray(r.shift_presets) && r.shift_presets.length ? r.shift_presets : d.shiftPresets,
    roles: Array.isArray(r.roles) ? r.roles : d.roles,
    positions: Array.isArray(r.positions) && r.positions.length ? r.positions : d.positions,
    remindBefore: pick(r.remind_before, d.remindBefore),
    remindAfter: pick(r.remind_after, d.remindAfter),
    lateAfter: pick(r.late_after, d.lateAfter),
    quietFrom: pick(r.quiet_from, d.quietFrom),
    quietTo: pick(r.quiet_to, d.quietTo),
    noticeText: r.notice_text || d.noticeText,
    noticeVersion: pick(r.notice_version, d.noticeVersion),
  }
}

export const settingsToRow = (s) => ({
  clock_in_early: s.clockInEarly,
  allow_anyway: s.allowAnyway,
  round_within: s.roundWithin,
  shift_presets: s.shiftPresets,
  roles: s.roles,
  positions: s.positions,
  remind_before: s.remindBefore,
  remind_after: s.remindAfter,
  late_after: s.lateAfter,
  quiet_from: s.quietFrom,
  quiet_to: s.quietTo,
  notice_text: s.noticeText,
  notice_version: s.noticeVersion,
})

// Has this person acknowledged the current location notice?
export const noticeAcked = (priv, settings) => Boolean(priv?.noticeAckAt && (priv.noticeVersion ?? 0) >= settings.noticeVersion)

// Rounding to the hour: a punch less than `within` minutes before or after the
// hour counts as on the hour (6:07 PM → 6:00 PM, 7:52 AM → 8:00 AM). The real
// time stays saved; hours, pay and timesheets use the rounded one.
export function roundTime(iso, within) {
  if (!iso || !within) return iso
  const d = new Date(iso)
  const past = d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000
  if (past < within) d.setMinutes(0, 0, 0)
  else if (60 - past < within) d.setMinutes(60, 0, 0)
  else return iso
  return d.toISOString()
}

// A punch with rounded times, keeping the real ones as actualIn / actualOut.
export function roundPunch(p, within) {
  const clockIn = roundTime(p.clockIn, within)
  const clockOut = roundTime(p.clockOut, within)
  if (clockIn === p.clockIn && clockOut === p.clockOut) return p
  return { ...p, clockIn, clockOut, actualIn: p.clockIn, actualOut: p.clockOut }
}

// Back to what to save: a time left at its rounded value keeps the real one.
export function unroundPunch({ actualIn, actualOut, ...p }, within) {
  return {
    ...p,
    clockIn: actualIn && p.clockIn === roundTime(actualIn, within) ? actualIn : p.clockIn,
    clockOut: actualOut && p.clockOut === roundTime(actualOut, within) ? actualOut : p.clockOut,
  }
}
