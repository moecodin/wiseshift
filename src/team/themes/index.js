// The team page's themes. Each person picks their own (supabase/updates/016);
// Classic is everyone's default. A theme changes the look and some words, never
// what the page does. Styles are in themes.css, clock screens in ClockHero.jsx.

const TABS = { clock: 'Clock', tasks: 'Tasks', schedule: 'Schedule', hours: 'Hours & pay', off: 'Time off', people: 'Team', chat: 'Chat', more: 'More' }

// Spanish (⚙️ Settings → Language): plain names in every theme.
export const TABS_ES = { clock: 'Reloj', tasks: 'Tareas', schedule: 'Horario', hours: 'Horas', off: 'Ausencias', people: 'Equipo', chat: 'Chat', more: 'Más' }

// The Tasks tab's buttons in each theme (English). Spanish uses words.js.
const TASKS = { claim: "I'll get it", yours: "✓ You've got it", giveBack: 'Give it back', theirs: (name) => `${name}'s got it` }

export const THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Clean and simple (everyone starts here)',
    tabs: TABS,
    offDay: 'Off',
    tasks: TASKS,
  },
  {
    id: 'pixel',
    name: 'Pixel',
    blurb: 'Retro game: hearts, coins, chunky buttons',
    tabs: { ...TABS, tasks: 'Quests', schedule: 'Sched', hours: 'Pay', off: 'Rest' },
    tasks: { claim: 'ACCEPT QUEST', yours: '✓ YOUR QUEST', giveBack: 'Drop it', theirs: (name) => `${name.toUpperCase()} TOOK THIS QUEST` },
    offDay: '– rest day –',
    sounds: true,
    timeOff: { title: 'Rest potions', ask: 'Ask for a rest potion' },
  },
  {
    id: 'trainer',
    name: 'Pocket Trainer',
    blurb: 'Handheld RPG: HP, EXP, Trainer Card',
    tabs: { ...TABS, tasks: 'Missions', schedule: 'Party', hours: 'Pay', off: 'Bag' },
    tasks: { claim: 'ON IT!', yours: '✓ YOUR MISSION', giveBack: 'Give it back', theirs: (name) => `${name.toUpperCase()} is on this mission!` },
    offDay: 'rest',
    sounds: true,
    timeOff: { title: 'Bag · Key Items', ask: 'New Rest Ticket' },
  },
  {
    id: 'cats',
    name: 'Cat Café',
    blurb: 'Two cats, toe beans and yarn',
    tabs: { ...TABS, tasks: 'Chores', schedule: 'Naps', hours: 'Treats', off: 'Off' },
    tasks: { claim: "I'll take it 🐾", yours: '✓ Yours, purr', giveBack: 'Give it back', theirs: (name) => `${name} pounced on it` },
    offDay: '😴 cat nap',
  },
  {
    id: 'catnip',
    name: 'Cat Café: Catnip',
    blurb: 'Very relaxed cats, growing catnip',
    tabs: { ...TABS, tasks: 'To-dos', schedule: 'Naps', hours: 'Treats', off: 'Off' },
    tasks: { claim: 'I got this', yours: "✓ You're on it", giveBack: 'Give it back', theirs: (name) => `${name}'s on it` },
    offDay: '😌 high nap',
  },
  {
    id: 'leaf',
    name: 'Chill Leaf',
    blurb: 'Dark green, lo-fi, leaf glow',
    tabs: { ...TABS, tasks: 'To-dos', schedule: 'Week', hours: 'Pay', off: 'Off' },
    tasks: { claim: 'I got this', yours: "✓ You're on it", giveBack: 'Give it back', theirs: (name) => `${name}'s on it` },
    offDay: 'day off · unwind',
    dark: true,
  },
]

export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0]
