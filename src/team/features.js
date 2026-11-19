import { createContext, useContext } from 'react'

// Which parts of WiseShift a business uses. A feature that is off disappears for everyone:
// its tab, cards, buttons and Settings sections. Nothing is deleted, so turning it back on
// brings everything back. Scheduling and the team list are always on.

export const FEATURES = [
  { id: 'timeClock', label: 'Time clock', help: 'Clock in and out, approve punches, see who is working now.' },
  { id: 'timesheets', label: 'Timesheets and payroll export', help: "Everyone's hours by pay period, overtime, and a CSV download.", needs: 'timeClock' },
  { id: 'location', label: 'Location on punches', help: 'Saves where the phone was when someone clocks in or out, with the location notice.', needs: 'timeClock' },
  { id: 'kioskClock', label: 'Kiosk clock-in', help: 'Staff clock in and out with a PIN on a shared store computer, for places that skip the phone app.', needs: 'timeClock' },
  { id: 'timeOff', label: 'Time-off requests', help: 'Staff ask for days off and managers approve or decline.' },
  { id: 'cover', label: 'Shift swaps and cover', help: 'Staff give a shift away or swap with a coworker, and managers approve.' },
  { id: 'roles', label: 'Shift roles', help: 'Label a shift with what the person does, like Front desk or Kitchen.' },
  { id: 'coverage', label: 'Coverage warnings', help: "The manager's day view flags stretches with nobody, or only one person, working." },
  { id: 'teamTasks', label: 'Tasks', help: "A day's to-do list: managers add tasks and can hand them out, staff take one with \"I'll take it\" and tick it off." },
  { id: 'notes', label: 'Manager notes and tasks', help: "Sticky notes and a to-do list for managers, shown on their Today screen. Staff never see them." },
  { id: 'payRates', label: 'Pay rates and paycheck estimates', help: 'Managers store hourly rates and see a paycheck estimate. Staff never see pay.' },
]

// Starting points offered in Settings (and, later, when a business signs up).
export const PRESETS = [
  {
    id: 'schedule',
    label: 'Just scheduling',
    help: 'Build the schedule, let staff ask for time off and swap shifts.',
    on: ['timeOff', 'cover'],
  },
  {
    id: 'clock',
    label: 'Scheduling + time clock',
    help: 'Also clock in and out, with timesheets for payroll.',
    on: ['timeClock', 'timesheets', 'timeOff', 'cover'],
  },
  {
    id: 'all',
    label: 'Everything',
    help: 'Every feature, including roles, coverage warnings, location and pay rates.',
    on: FEATURES.map((f) => f.id),
  },
]
export const presetFeatures = (preset) => Object.fromEntries(FEATURES.map((f) => [f.id, preset.on.includes(f.id)]))

// What a business has before it chooses: everything on except pay rates, so nothing that
// already works disappears. Pay rates start off because staff and small teams rarely need them,
// and the kiosk starts off because it needs a device registered and PINs handed out first.
export const DEFAULT_FEATURES = { ...presetFeatures(PRESETS[2]), payRates: false, kioskClock: false }

// The switches as the screens should see them: filled in with defaults, and a feature
// that needs another one is off when that one is off.
export function featuresOf(settings) {
  const f = { ...DEFAULT_FEATURES, ...(settings?.features ?? {}) }
  for (const { id, needs } of FEATURES) if (needs && !f[needs]) f[id] = false
  return f
}

export const FeaturesContext = createContext(featuresOf(null))
export const useFeatures = () => useContext(FeaturesContext)
export const useFeature = (id) => useContext(FeaturesContext)[id]

// Texting staff (SMS) isn't built yet. The notes editor already has the option; it shows as
// unavailable until this is switched on and a texting service is connected.
export const TEXTING_AVAILABLE = false
