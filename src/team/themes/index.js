// WiseShift has one look. This file keeps the tab names (English here, Spanish
// below) so every screen reads them from one place.

const TABS = { clock: 'Clock', schedule: 'Schedule', tasks: 'Tasks', hours: 'Hours', off: 'Time off', people: 'Team', more: 'More' }

// Spanish (⚙️ Settings → Language).
export const TABS_ES = { clock: 'Reloj', schedule: 'Horario', tasks: 'Tareas', hours: 'Horas', off: 'Ausencias', people: 'Equipo', more: 'Más' }

const LOOK = { id: 'classic', name: 'WiseShift', tabs: TABS, offDay: 'Off' }

export const themeById = () => LOOK
