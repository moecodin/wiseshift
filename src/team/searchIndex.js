// Every place the site search can take you to. One entry per place:
//   title / path  what the result says (English and Spanish) and where it lives, shown muted under the title
//   words         extra words someone might type ("login", "sign in", "contraseña")
//   tab           the page to open (a tab id; settings, people and the More pages count)
//   settings      for tab 'settings': open Me or Business first
//   find / sel    where to land: the Settings section whose heading starts with `find`, or the element matching `sel`
//   boss          managers only
//   feature       hidden when that feature is switched off in Settings → Business → Features
//   desk          a desk-sized tool: on a phone it opens the "best on a computer" note
// Keep this list current when a screen or a Settings section is added.

const A = (en, es, rest) => ({ en, es, ...rest })

export const PLACES = [
  // ---- Pages ----
  A({ title: 'Today', path: 'Page' }, { title: 'Hoy', path: 'Página' }, { id: 'today', tab: 'clock', words: 'home clock in clock out who is working dashboard inicio reloj' }),
  A({ title: 'Schedule', path: 'Page' }, { title: 'Horario', path: 'Página' }, { id: 'schedule', tab: 'schedule', words: 'shifts calendar week turnos' }),
  A({ title: 'Tasks', path: 'Page' }, { title: 'Tareas', path: 'Página' }, { id: 'tasks', tab: 'tasks', feature: 'teamTasks', words: 'to do list chores' }),
  A({ title: 'Hours', path: 'Page' }, { title: 'Horas', path: 'Página' }, { id: 'hours', tab: 'hours', feature: 'timeClock', words: 'punches timecard clock history paycheck horas' }),
  A({ title: 'Reports', path: 'Page' }, { title: 'Informes', path: 'Página' }, { id: 'reports', tab: 'reports', boss: true, feature: 'timesheets', desk: true, words: 'timesheet payroll hojas de tiempo' }),
  A({ title: 'Time off', path: 'Page' }, { title: 'Ausencias', path: 'Página' }, { id: 'timeoff', tab: 'off', feature: 'timeOff', words: 'vacation request day off pto sick vacaciones permiso' }),
  A({ title: 'Team', path: 'Page' }, { title: 'Equipo', path: 'Página' }, { id: 'team', tab: 'people', boss: true, words: 'people staff employees roster personas empleados' }),
  A({ title: 'More', path: 'Page' }, { title: 'Más', path: 'Página' }, { id: 'more', tab: 'more', words: 'menu' }),
  A({ title: 'My profile', path: 'Page' }, { title: 'Mi perfil', path: 'Página' }, { id: 'profile', tab: 'profile', words: 'me account badge color phone emergency contact perfil' }),
  A({ title: 'Settings', path: 'Page' }, { title: 'Ajustes', path: 'Página' }, { id: 'settings', tab: 'settings', settings: 'me', words: 'preferences options configuración' }),

  // ---- Settings → Me (everyone) ----
  A({ title: 'Change password', path: 'Settings → Me → Password' }, { title: 'Cambiar contraseña', path: 'Ajustes → Yo → Contraseña' }, { id: 'password', tab: 'settings', settings: 'me', find: 'password', words: 'login sign in security reset account contraseña' }),
  A({ title: 'Light or dark mode', path: 'Settings → Me → Appearance' }, { title: 'Modo claro u oscuro', path: 'Ajustes → Yo → Apariencia' }, { id: 'theme', tab: 'settings', settings: 'me', find: 'appearance', words: 'theme night color scheme tema' }),
  A({ title: 'Language', path: 'Settings → Me' }, { title: 'Idioma', path: 'Ajustes → Yo' }, { id: 'language', tab: 'settings', settings: 'me', find: 'language', words: 'english spanish español inglés' }),
  A({ title: 'My badge color', path: 'My profile → Your color' }, { title: 'Mi color', path: 'Mi perfil → Tu color' }, { id: 'color', tab: 'profile', find: 'your color', words: 'avatar initials badge picture' }),
  A({ title: 'Notifications', path: 'Settings → Me' }, { title: 'Notificaciones', path: 'Ajustes → Yo' }, { id: 'notifications', tab: 'settings', settings: 'me', find: 'notifications', words: 'alerts push reminders avisos' }),
  A({ title: 'My phone and emergency contact', path: 'My profile' }, { title: 'Mi teléfono y contacto de emergencia', path: 'Mi perfil' }, { id: 'contact', tab: 'profile', find: 'my phone', words: 'number emergency contact teléfono' }),
  A({ title: 'Location notice', path: 'Settings → Me' }, { title: 'Aviso de ubicación', path: 'Ajustes → Yo' }, { id: 'locnotice', tab: 'settings', settings: 'me', find: 'location notice', feature: 'location', words: 'monitoring privacy gps' }),

  // ---- Settings → Business (managers) ----
  A({ title: 'Business name and logo', path: 'Settings → Business' }, { title: 'Nombre y logo del negocio', path: 'Ajustes → Negocio' }, { id: 'brand', tab: 'settings', settings: 'business', find: 'business name', boss: true, desk: true, words: 'company brand image picture' }),
  A({ title: 'Store hours', path: 'Settings → Business' }, { title: 'Horario de la tienda', path: 'Ajustes → Negocio' }, { id: 'hours-open', tab: 'settings', settings: 'business', find: 'store hours', boss: true, desk: true, words: 'open close opening closing days closed' }),
  A({ title: 'Pay period', path: 'Settings → Business' }, { title: 'Período de pago', path: 'Ajustes → Negocio' }, { id: 'payperiod', tab: 'settings', settings: 'business', find: 'pay period', boss: true, desk: true, feature: 'timeClock', words: 'weekly biweekly payroll overtime paycheck quincena' }),
  A({ title: 'Features on and off', path: 'Settings → Business' }, { title: 'Funciones', path: 'Ajustes → Negocio' }, { id: 'features', tab: 'settings', settings: 'business', find: 'features', boss: true, desk: true, words: 'turn on off modules time clock kiosk tasks' }),
  A({ title: 'Shop location', path: 'Settings → Business' }, { title: 'Ubicación de la tienda', path: 'Ajustes → Negocio' }, { id: 'shoploc', tab: 'settings', settings: 'business', find: 'shop location', boss: true, desk: true, feature: 'location', words: 'address map radius gps' }),
  A({ title: 'Clocking-in rules', path: 'Settings → Business' }, { title: 'Reglas para marcar entrada', path: 'Ajustes → Negocio' }, { id: 'clockrules', tab: 'settings', settings: 'business', find: 'clocking in', boss: true, desk: true, feature: 'timeClock', words: 'early clock in anyway rounding' }),
  A({ title: 'Kiosk: pair a computer', path: 'Settings → Business → Kiosk' }, { title: 'Quiosco: vincular una computadora', path: 'Ajustes → Negocio → Quiosco' }, { id: 'kiosk', tab: 'settings', settings: 'business', find: 'kiosk', boss: true, desk: true, feature: 'kioskClock', words: 'store computer pin pairing code shared tablet' }),
  A({ title: 'Shift quick picks', path: 'Settings → Business → Shift types' }, { title: 'Turnos rápidos', path: 'Ajustes → Negocio' }, { id: 'quickpicks', tab: 'settings', settings: 'business', find: 'shift types', boss: true, desk: true, words: 'open close all day presets' }),
  A({ title: 'Shift roles', path: 'Settings → Business → Roles' }, { title: 'Funciones del turno', path: 'Ajustes → Negocio' }, { id: 'roles', tab: 'settings', settings: 'business', find: 'roles', boss: true, desk: true, feature: 'roles', words: 'front desk floor prep colors' }),
  A({ title: 'Staff groups', path: 'Settings → Business → Groups' }, { title: 'Grupos de personal', path: 'Ajustes → Negocio' }, { id: 'groups', tab: 'settings', settings: 'business', find: 'groups', boss: true, desk: true, words: 'departments kitchen cashiers waiters' }),
  A({ title: 'Positions', path: 'Settings → Business' }, { title: 'Puestos', path: 'Ajustes → Negocio' }, { id: 'positions', tab: 'settings', settings: 'business', find: 'positions', boss: true, desk: true, words: 'job titles manager assistant' }),
  A({ title: 'Notification timing', path: 'Settings → Business' }, { title: 'Horario de avisos', path: 'Ajustes → Negocio' }, { id: 'timing', tab: 'settings', settings: 'business', find: 'notification timing', boss: true, desk: true, words: 'reminder late quiet hours' }),
  A({ title: 'Location notice text', path: 'Settings → Business' }, { title: 'Texto del aviso de ubicación', path: 'Ajustes → Negocio' }, { id: 'noticetext', tab: 'settings', settings: 'business', find: 'location notice', boss: true, desk: true, feature: 'location', words: 'monitoring consent wording' }),
  A({ title: 'Run the setup wizard again', path: 'Settings → Business' }, { title: 'Repetir el asistente de configuración', path: 'Ajustes → Negocio' }, { id: 'wizard', tab: 'settings', settings: 'business', find: 'business name', boss: true, desk: true, words: 'onboarding setup start over' }),

  // ---- Actions ----
  A({ title: 'Add a shift', path: 'Schedule' }, { title: 'Agregar un turno', path: 'Horario' }, { id: 'add-shift', tab: 'schedule', boss: true, sel: '[data-search="batch"]', words: 'new shift create schedule someone' }),
  A({ title: 'Batch Schedule', path: 'Schedule' }, { title: 'Horario por lotes', path: 'Horario' }, { id: 'batch', tab: 'schedule', boss: true, desk: true, sel: '[data-search="batch"]', words: 'many shifts several people days at once' }),
  A({ title: 'Copy last week', path: 'Schedule' }, { title: 'Copiar la semana pasada', path: 'Horario' }, { id: 'copy-week', tab: 'schedule', boss: true, desk: true, sel: '[data-search="copy-week"]', words: 'duplicate previous repeat' }),
  A({ title: 'Publish the schedule', path: 'Schedule' }, { title: 'Publicar el horario', path: 'Horario' }, { id: 'publish', tab: 'schedule', boss: true, sel: '[data-search="publish"]', words: 'send drafts team can see' }),
  A({ title: 'Approve punches', path: 'Hours' }, { title: 'Aprobar registros', path: 'Horas' }, { id: 'approve', tab: 'hours', boss: true, feature: 'timeClock', words: 'review timecards payroll ready' }),
  A({ title: 'Add a punch', path: 'Hours' }, { title: 'Agregar un registro', path: 'Horas' }, { id: 'add-punch', tab: 'hours', boss: true, feature: 'timeClock', sel: '[data-search="add-punch"]', words: 'forgot clock in missing time card fix' }),
  A({ title: 'Export hours for payroll', path: 'Reports' }, { title: 'Exportar horas para nómina', path: 'Informes' }, { id: 'export', tab: 'reports', boss: true, desk: true, feature: 'timesheets', sel: '[data-search="export"]', words: 'download csv payroll' }),
  A({ title: 'Print the timesheet', path: 'Reports' }, { title: 'Imprimir la hoja de tiempo', path: 'Informes' }, { id: 'print', tab: 'reports', boss: true, desk: true, feature: 'timesheets', sel: '[data-search="print"]', words: 'pdf paper' }),
  A({ title: 'Ask for time off', path: 'Time off' }, { title: 'Pedir tiempo libre', path: 'Ausencias' }, { id: 'ask-off', tab: 'off', feature: 'timeOff', words: 'request vacation day off' }),
  A({ title: 'Add a person', path: 'Team' }, { title: 'Agregar una persona', path: 'Equipo' }, { id: 'add-person', tab: 'people', boss: true, sel: '[data-search="add-person"]', words: 'new employee invite hire staff login' }),
  A({ title: 'Set a kiosk PIN', path: 'Team → person' }, { title: 'Definir un PIN del quiosco', path: 'Equipo → persona' }, { id: 'kiosk-pin', tab: 'people', boss: true, feature: 'kioskClock', words: 'pin code clock in kiosk' }),
]

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// The places this person can see, in their language, best match first. With no query: the main pages.
export function searchPlaces(query, { boss, features, lang, phone }) {
  const l = lang === 'es' ? 'es' : 'en'
  const allowed = PLACES.filter((p) => (!p.boss || boss) && (!p.feature || features[p.feature]))
  const shaped = (p) => ({ ...p, title: p[l].title, path: p[l].path + (phone && p.desk ? (l === 'es' ? ' · en computadora' : ' · on a computer') : '') })
  const tokens = fold(query).split(/\s+/).filter(Boolean)
  if (!tokens.length) return allowed.filter((p) => p.path === undefined && p.en.path === 'Page').map(shaped)
  const scored = []
  for (const p of allowed) {
    const titleWords = fold(`${p.en.title} ${p.es.title}`).split(/[^a-z0-9]+/).filter(Boolean)
    const titleText = fold(`${p.en.title} ${p.es.title}`)
    const wordList = fold(`${p.words ?? ''} ${p.en.path} ${p.es.path}`).split(/[^a-z0-9]+/).filter(Boolean)
    const wordText = fold(`${p.words ?? ''} ${p.en.path} ${p.es.path}`)
    let total = 0
    let all = true
    for (const t of tokens) {
      const s = titleWords.some((w) => w === t) ? 5 : titleWords.some((w) => w.startsWith(t)) ? 4 : titleText.includes(t) ? 2 : wordList.some((w) => w.startsWith(t)) ? 2 : wordText.includes(t) ? 1 : 0
      if (!s) all = false
      total += s
    }
    if (all) scored.push([total, p])
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, p]) => shaped(p))
}

// People (managers only): matched on name and position. Each result's main action opens their profile page;
// the others open their punches (Hours review, this pay period), their schedule row, or their hours in Reports.
export function searchPeople(query, { boss, features, lang, phone }, employees) {
  if (!boss) return []
  const tokens = fold(query).split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const es = lang === 'es'
  const scored = []
  for (const e of employees) {
    const nameWords = fold(e.name).split(/[^a-z0-9]+/).filter(Boolean)
    const text = fold(`${e.name} ${e.position ?? ''}`)
    let total = 0
    let all = true
    for (const t of tokens) {
      const sc = nameWords.some((w) => w === t) ? 5 : nameWords.some((w) => w.startsWith(t)) ? 4 : text.includes(t) ? 1 : 0
      if (!sc) all = false
      total += sc
    }
    if (all) scored.push([total + (e.active ? 0.5 : 0), e])
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 5).map(([, e]) => {
    const clocks = e.payType !== 'none' // schedule-only people have no punches or hours
    const actions = [
      { key: 'profile', label: es ? 'Perfil' : 'Profile', tab: 'people', focus: { id: e.id } },
      features.timeClock && clocks && { key: 'punches', label: es ? 'Registros' : 'Punches', tab: 'hours', focus: { id: e.id } },
      { key: 'schedule', label: es ? 'Horario' : 'Schedule', tab: 'schedule', sel: `[data-person="${e.id}"]` },
      features.timeClock && clocks && features.timesheets && !phone && { key: 'hours', label: es ? 'Horas' : 'Hours', tab: 'reports', focus: { id: e.id } },
    ].filter(Boolean)
    return { id: `p:${e.id}`, kind: 'person', title: e.name, path: `${e.position || (es ? 'Equipo' : 'Team')}${e.active ? '' : es ? ' · No activo' : ' · Not active'}`, actions, ...actions[0] }
  })
}
