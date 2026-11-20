import { createContext, useContext } from 'react'
import { tr } from './i18n.js'

// Which parts of WiseShift a business uses. A feature that is off disappears for everyone:
// its tab, cards, buttons and Settings sections. Nothing is deleted, so turning it back on
// brings everything back. Scheduling and the team list are always on.

const T = (en, es) => ({ en, es })
const L = (pair) => tr(pair.en, pair.es)
const item = (id, label, help, extra = {}) => ({ id, get label() { return L(label) }, get help() { return L(help) }, ...extra })

export const FEATURES = [
  item('timeClock', T('Time clock', 'Reloj de entrada'), T('Clock in and out, approve punches, see who is working now.', 'Marcar entrada y salida, aprobar registros, ver quién trabaja ahora.')),
  item('timesheets', T('Timesheets and payroll export', 'Hojas de horas y exportación de nómina'), T("Everyone's hours by pay period, overtime, and a CSV download.", 'Las horas de todos por período de pago, horas extra y descarga en CSV.'), { needs: 'timeClock' }),
  item('location', T('Location on punches', 'Ubicación en los registros'), T('Saves where the phone was when someone clocks in or out, with the location notice.', 'Guarda dónde estaba el teléfono al marcar entrada o salida, con el aviso de ubicación.'), { needs: 'timeClock' }),
  item('kioskClock', T('Kiosk clock-in', 'Quiosco para marcar'), T('Staff clock in and out with a PIN on a shared store computer, for places that skip the phone app.', 'El personal marca entrada y salida con un PIN en una computadora compartida, para lugares que no usan la app del teléfono.'), { needs: 'timeClock' }),
  item('timeOff', T('Time-off requests', 'Solicitudes de ausencia'), T('Staff ask for days off and managers approve or decline.', 'El personal pide días libres y los gerentes aprueban o rechazan.')),
  item('cover', T('Shift swaps and cover', 'Cambios y coberturas de turno'), T('Staff give a shift away or swap with a coworker, and managers approve.', 'El personal cede un turno o lo cambia con un compañero, y los gerentes aprueban.')),
  item('roles', T('Shift roles', 'Roles de turno'), T('Label a shift with what the person does, like Front desk or Kitchen.', 'Marca un turno con lo que hace la persona, como Recepción o Cocina.')),
  item('coverage', T('Coverage warnings', 'Avisos de cobertura'), T("The manager's day view flags stretches with nobody, or only one person, working.", 'La vista del día del gerente marca los ratos sin nadie, o con una sola persona, trabajando.')),
  item('teamTasks', T('Tasks', 'Tareas'), T("A day's to-do list: managers add tasks and can hand them out, staff take one with \"I'll take it\" and tick it off.", 'La lista de pendientes del día: los gerentes agregan tareas y las reparten, el personal toma una con "Yo la hago" y la marca.')),
  item('notes', T('Manager notes and tasks', 'Notas y tareas de gerentes'), T('Sticky notes and a to-do list for managers, shown on their Today screen. Staff never see them.', 'Notas adhesivas y lista de pendientes para gerentes, en su pantalla Hoy. El personal nunca las ve.')),
  item('payRates', T('Pay rates and paycheck estimates', 'Tarifas y pago estimado'), T('Managers store hourly rates and see a paycheck estimate. Staff never see pay.', 'Los gerentes guardan tarifas por hora y ven un pago estimado. El personal nunca ve el pago.')),
]

// Starting points offered in Settings (and, later, when a business signs up).
export const PRESETS = [
  item('schedule', T('Just scheduling', 'Solo horarios'), T('Build the schedule, let staff ask for time off and swap shifts.', 'Arma el horario y deja que el personal pida días libres y cambie turnos.'), { on: ['timeOff', 'cover'] }),
  item('clock', T('Scheduling + time clock', 'Horarios + reloj'), T('Also clock in and out, with timesheets for payroll.', 'También marcar entrada y salida, con hojas de horas para la nómina.'), { on: ['timeClock', 'timesheets', 'timeOff', 'cover'] }),
  item('all', T('Everything', 'Todo'), T('Every feature, including roles, coverage warnings, location and pay rates.', 'Todas las funciones, incluidos roles, avisos de cobertura, ubicación y tarifas.'), { on: ['timeClock', 'timesheets', 'location', 'kioskClock', 'timeOff', 'cover', 'roles', 'coverage', 'teamTasks', 'notes', 'payRates'] }),
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
