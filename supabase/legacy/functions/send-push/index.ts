// @ts-nocheck
// (Plain JavaScript inside, so it deploys from the dashboard editor without type errors.)
// Supabase Edge Function: push notifications for the Island Schedule app (/team).
//
// Deploy: Supabase → Edge Functions → Deploy a new function → Via editor, name it
// send-push, paste this whole file, Deploy. Then in the function's Details, turn
// OFF "Verify JWT" (this file checks who's calling itself, and the timer has no login).
// Secrets (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   from `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT                         mailto:info@rooseveltpups.com
//   CRON_SECRET                           any long random text; the timer sends it
//
// Who calls it:
//   The team page, turning notifications on: key (the public key, no login needed)
//   The team page, right after something happens (signed-in person's login):
//     test, published, shift_changed, shift_removed, time_off_requested,
//     time_off_decided, clocked_in
//   The daycare sheet (front desk login or a manager), a task added for today:
//     task_added → everyone clocked in right now (update 021)
//   The team chat (a team member, or the front desk with the PIN), a message
//   just sent: chat_message → everyone else on the team (update 023)
//   The timer (Supabase Cron, every 5 minutes, header x-cron-secret): tick
//     → shift reminders, "still clocked in?", late alerts, and anything held
//       during quiet hours
//
// Quiet hours 9 PM – 6 AM (New York) to start: reminders and late alerts are
// skipped; everything else waits until morning. "Still clocked in?" always goes
// out. Managers change the quiet hours and reminder timing in ⚙️ Settings →
// Business (team_settings, update 018); before 018 the defaults below are used.
// Each kind can be turned off per person (employee_prefs.push_off). A reminder
// about the same shift or punch is never sent twice (push_log).

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const TZ = 'America/New_York'
const DEFAULT_TIMING = {
  quietFrom: 21 * 60, // 9 PM
  quietTo: 6 * 60, // 6 AM
  beforeShift: 30, // minutes: "shift at 8:00" reminder
  afterShift: 30, // minutes: "still clocked in?"
  lateAfter: 15, // minutes: "hasn't clocked in"
}
let timing = DEFAULT_TIMING
const DROP_WHEN_QUIET = ['shift', 'late', 'task', 'chat'] // pointless later, so not held (the chat shows what's new)

const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
// The key pair. Stray spaces or line breaks from pasting are ignored. A bad key
// doesn't crash the function: every call answers with what's wrong instead.
const secret = (name) => (Deno.env.get(name) || '').trim().replace(/^["']|["']$/g, '')
let keyProblem = ''
try {
  if (!secret('VAPID_PUBLIC_KEY') || !secret('VAPID_PRIVATE_KEY')) throw new Error('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing from the secrets')
  let subject = secret('VAPID_SUBJECT') || 'mailto:info@rooseveltpups.com'
  if (!/^(mailto:|https:)/.test(subject)) subject = `mailto:${subject}`
  webpush.setVapidDetails(subject, secret('VAPID_PUBLIC_KEY'), secret('VAPID_PRIVATE_KEY'))
} catch (err) {
  keyProblem = `VAPID keys: ${err.message}. Check the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets (a matching pair, just the key, no spaces or labels).`
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Time in New York ----------

// { date: '2026-10-25', minutes: 545 } for a moment (now by default).
function ny(at = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(at))
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}
// Quiet hours can cross midnight (9 PM – 6 AM) or not (1 AM – 5 AM).
const isQuiet = (minutes) => {
  const { quietFrom: from, quietTo: to } = timing
  return from > to ? minutes >= from || minutes < to : minutes >= from && minutes < to
}
// The managers' timing from ⚙️ Settings, read fresh on every call.
async function loadTiming() {
  const { data } = await admin.from('team_settings').select('*').maybeSingle()
  const pick = (value, fallback) => (Number.isFinite(value) ? value : fallback)
  const d = DEFAULT_TIMING
  timing = {
    quietFrom: pick(data?.quiet_from, d.quietFrom),
    quietTo: pick(data?.quiet_to, d.quietTo),
    beforeShift: pick(data?.remind_before, d.beforeShift),
    afterShift: pick(data?.remind_after, d.afterShift),
    lateAfter: pick(data?.late_after, d.lateAfter),
  }
}
const clock = (m) => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`
const dayName = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const first = (name) => (name || '').split(' ')[0]

// ---------- Words, in each person's theme ----------

const THEMED = {
  trainer: { published: 'A new SCHEDULE has arrived!', shift: 'A shift is about to start!', stillin: 'Did you forget to SAVE? (clock out)', timeoff: 'You received a REST TICKET!', changed: 'Your PARTY changed!', task: 'A new MISSION appeared!' },
  pixel: { published: '★ NEW LEVEL UNLOCKED ★', shift: '♥ GET READY, PLAYER 1', stillin: '⚠ GAME STILL RUNNING', timeoff: '🧪 REST POTION', task: '★ NEW QUEST ★' },
  cats: { published: 'Mrrp! New schedule 🐾', shift: 'Mrrp! Shift soon 🐾', stillin: "Don't forget to boop out! 🐾", timeoff: 'Nap time news 😴', task: 'Mrrp! New task 🐾' },
  catnip: { published: 'Mrrow~ new schedule 🌿', shift: 'Time to get your nip 🌿', stillin: 'Time to chill? (clock out) 🌿', timeoff: 'High nap news 😌', task: 'New task, no rush 🌿' },
  leaf: { published: '🌿 New schedule', shift: '🌿 Shift soon, stay chill', stillin: '🌿 Still clocked in?', timeoff: '🌿 Time off news', task: '🌿 New task' },
}

// ---------- Sending ----------

async function people(ids) {
  const { data } = await admin.from('employees').select('id, name, is_manager, active, pay_type').in('id', ids)
  const { data: prefs } = await admin.from('employee_prefs').select('employee_id, theme, push_off, lang').in('employee_id', ids)
  return (data ?? []).filter((e) => e.active).map((e) => ({ ...e, prefs: prefs?.find((p) => p.employee_id === e.id) ?? { theme: 'classic', push_off: [] } }))
}

async function managers() {
  const { data } = await admin.from('employees').select('id').eq('is_manager', true).eq('active', true)
  return people((data ?? []).map((e) => e.id))
}

// Send to every phone this person turned notifications on for.
async function deliver(employeeId, msg) {
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('employee_id', employeeId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 6 * 3600 })
      sent++
    } catch (err) {
      // The phone turned notifications off or the app was removed: forget it.
      if (err.statusCode === 404 || err.statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
    }
  }
  return sent
}

// One notification to one person, following their settings, quiet hours, and
// "never twice" (ref). Returns how many phones got it.
async function notify(person, kind, { title, body, url = '/team', ref = null, force = false }) {
  if (!force && (person.prefs.push_off ?? []).includes(kind)) return 0
  if (ref) {
    const { data } = await admin.from('push_log').upsert({ employee_id: person.id, kind, ref }, { onConflict: 'employee_id,kind,ref', ignoreDuplicates: true }).select('id')
    if (!data?.length) return 0 // already sent
  }
  // Their theme's words for the title, when it has some; the details stay the same.
  // Spanish readers get the plain title (the theme titles are English).
  const themed = person.prefs.lang === 'es' ? null : THEMED[person.prefs.theme]?.[kind]
  const msg = { title: themed ?? title, body, url, tag: `${kind}-${ref ?? Date.now()}` }
  if (!force && isQuiet(ny().minutes) && kind !== 'stillin') {
    if (!DROP_WHEN_QUIET.includes(kind)) await admin.from('push_queue').insert({ employee_id: person.id, kind, title: msg.title, body: msg.body, url })
    return 0
  }
  return deliver(person.id, msg)
}

// ---------- Who's calling ----------

async function caller(req) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  const user = data?.user
  if (!user?.email || !user.email_confirmed_at) return null
  const { data: rows } = await admin.from('employees').select('id').ilike('email', user.email).eq('active', true)
  if (rows?.length) return (await people([rows[0].id]))[0] ?? null
  // The front desk login (not on the team list) can only announce tasks and its chat messages.
  if (user.app_metadata?.role === 'staff') return { id: null, name: 'Front desk', desk: true, prefs: {} }
  return null
}

// ---------- Tasks (update 021) ----------

const TASK_WORDS = {
  walk: ['walk', 'Paseo'], pickup: ['pick-up', 'Recoger'], dropoff: ['drop-off', 'Llevar a casa'], visit: ['senior visit', 'Visita senior'], cat: ['cat sitting', 'Cuidar gato'],
}

// A task just added on the daycare sheet for today (one-time, or a new
// regular due today): tell everyone clocked in right now. Nobody off the clock.
async function taskAdded(me, body) {
  const now = ny()
  let task = null
  if (body.task_id) {
    const { data } = await admin.from('daycare_tasks').select('*').eq('id', body.task_id).maybeSingle()
    if (data && !data.regular_id) task = { ref: data.id, date: data.date, kind: data.kind, time: data.time_min, dog: data.dog_name }
  } else if (body.regular_id) {
    const { data: r } = await admin.from('daycare_regulars').select('*').eq('id', body.regular_id).maybeSingle()
    const weekday = new Date(`${now.date}T12:00:00Z`).getUTCDay()
    const time = r?.times?.[String(weekday)]
    if (r && time !== undefined && time !== null && time !== '' && !(r.paused_until && r.paused_until >= now.date)) {
      task = { ref: `${r.id}:${now.date}`, date: now.date, kind: r.kind, time: Number(time), dog: r.dog_name }
    }
  }
  // Only today's, and not one that's already long past.
  if (!task || task.date !== now.date || task.time < now.minutes - 15) return { sent: 0 }
  const { data: open } = await admin.from('punches').select('employee_id').is('clock_out', null)
  const ids = [...new Set((open ?? []).map((p) => p.employee_id))].filter((id) => id !== me.id)
  if (!ids.length) return { sent: 0 }
  let sent = 0
  for (const p of await people(ids)) {
    if (p.pay_type === 'none') continue
    const [en, es] = TASK_WORDS[task.kind] ?? [task.kind, task.kind]
    const spanish = p.prefs.lang === 'es'
    sent += await notify(p, 'task', {
      title: spanish ? '📋 Nueva tarea' : '📋 New task added',
      body: spanish ? `${es} de ${task.dog} a las ${clock(task.time)}` : `${task.dog} ${en} ${clock(task.time)}`,
      url: '/team?tab=tasks',
      ref: task.ref,
    })
  }
  return { sent }
}

// ---------- Team chat (update 023) ----------

// A chat message just sent: tell everyone else on the team. Only the person
// (or the office computer) who wrote it can announce it, and only right away.
async function chatMessage(me, body) {
  const { data: m } = await admin.from('chat_messages').select('*').eq('id', body.message_id).maybeSingle()
  if (!m) return { error: 'No such message' }
  if ((m.author_id ?? null) !== (me.id ?? null)) return { error: 'Not your message' }
  if (Date.now() - new Date(m.created_at).getTime() > 5 * 60000) return { sent: 0 }
  const { data: team } = await admin.from('employees').select('id').eq('active', true).neq('pay_type', 'none')
  const ids = (team ?? []).map((e) => e.id).filter((id) => id !== m.author_id)
  const name = m.author_id ? first(m.author_name) : m.author_name
  const text = m.body.length > 140 ? `${m.body.slice(0, 139)}…` : m.body
  let sent = 0
  for (const p of await people(ids)) {
    sent += await notify(p, 'chat', { title: `💬 ${p.prefs.lang === 'es' && !m.author_id ? 'Recepción' : name}`, body: text, url: '/team?tab=chat', ref: `${m.id}` })
  }
  return { sent }
}

// ---------- Things that just happened (from the team page) ----------

async function onEvent(me, body) {
  const today = ny().date
  if (body.event === 'task_added') return me.desk || me.is_manager ? taskAdded(me, body) : { error: 'Front desk or managers only' }
  if (body.event === 'chat_message') return chatMessage(me, body)
  if (me.desk) return { error: 'Not on the team list' }
  switch (body.event) {
    case 'test':
      return { sent: await notify(me, 'test', { title: 'Island Schedule', body: 'Notifications are working! 🎉', force: true }) }

    case 'published': {
      if (!me.is_manager) return { error: 'Managers only' }
      const { data: shifts } = await admin.from('shifts').select('employee_id, start_min, end_min, break_min').eq('published', true).gte('date', body.from).lte('date', body.to)
      const byPerson = {}
      for (const s of shifts ?? []) (byPerson[s.employee_id] ??= []).push(s)
      const team = await people(Object.keys(byPerson))
      let sent = 0
      for (const p of team) {
        const list = byPerson[p.id]
        const hours = list.reduce((sum, s) => sum + (s.end_min - s.start_min - (s.break_min || 0)), 0) / 60
        sent += await notify(p, 'published', {
          title: '📅 Your schedule is up',
          body: `${dayName(body.from)} – ${dayName(body.to)}: ${list.length} shift${list.length === 1 ? '' : 's'}, ${Math.round(hours * 10) / 10} hrs`,
          url: '/team?tab=schedule',
        })
      }
      return { sent }
    }

    case 'shift_changed': {
      if (!me.is_manager) return { error: 'Managers only' }
      const { data: s } = await admin.from('shifts').select('*').eq('id', body.shift_id).maybeSingle()
      if (!s || !s.published || s.date < today) return { sent: 0 }
      const [p] = await people([s.employee_id])
      if (!p) return { sent: 0 }
      return { sent: await notify(p, 'changed', { title: '✏️ Your shift changed', body: `${dayName(s.date)}: now ${clock(s.start_min)} – ${clock(s.end_min)}${s.title ? ` (${s.title})` : ''}`, url: '/team?tab=schedule' }) }
    }

    case 'shift_removed': {
      if (!me.is_manager) return { error: 'Managers only' }
      if (!body.date || body.date < today) return { sent: 0 }
      const [p] = await people([body.employee_id])
      if (!p) return { sent: 0 }
      return { sent: await notify(p, 'changed', { title: '✏️ A shift was removed', body: `${dayName(body.date)}, ${clock(body.start)} – ${clock(body.end)} is off your schedule`, url: '/team?tab=schedule' }) }
    }

    case 'time_off_requested': {
      // Their newest waiting request (the one they just sent).
      const { data: t } = await admin.from('time_off').select('*').eq('employee_id', me.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!t) return { sent: 0 }
      const span = t.start_date === t.end_date ? dayName(t.start_date) : `${dayName(t.start_date)} – ${dayName(t.end_date)}`
      let sent = 0
      for (const m of await managers()) {
        if (m.id !== me.id) sent += await notify(m, 'request', { title: '🌴 Time-off request', body: `${first(me.name)} asked for ${span} off${t.reason ? `: "${t.reason}"` : ''}`, url: '/team?tab=off' })
      }
      return { sent }
    }

    case 'time_off_decided': {
      if (!me.is_manager) return { error: 'Managers only' }
      const { data: t } = await admin.from('time_off').select('*').eq('id', body.id).maybeSingle()
      if (!t || t.status === 'pending') return { sent: 0 }
      const [p] = await people([t.employee_id])
      if (!p) return { sent: 0 }
      const span = t.start_date === t.end_date ? dayName(t.start_date) : `${dayName(t.start_date)} – ${dayName(t.end_date)}`
      return { sent: await notify(p, 'timeoff', { title: t.status === 'approved' ? '✅ Time off approved' : '❌ Time off declined', body: span, url: '/team?tab=off' }) }
    }

    case 'clocked_in': {
      // Their punch that's open now (the one they just made).
      const { data: punch } = await admin.from('punches').select('*').eq('employee_id', me.id).is('clock_out', null).maybeSingle()
      if (!punch || punch.employee_id !== me.id || punch.in_lat == null) return { sent: 0 }
      const { data: shop } = await admin.from('team_settings').select('*').maybeSingle()
      if (!shop?.shop_lat) return { sent: 0 }
      const meters = distance(punch.in_lat, punch.in_lng, shop.shop_lat, shop.shop_lng)
      if (meters <= (shop.shop_radius || 152) + Math.min(punch.in_accuracy || 0, 300)) return { sent: 0 }
      const miles = meters / 1609.344
      let sent = 0
      for (const m of await managers()) {
        if (m.id !== me.id) sent += await notify(m, 'away', { title: '📍 Clocked in away from the shop', body: `${first(me.name)} clocked in ${miles < 0.1 ? `${Math.round(meters * 3.281)} ft` : `${miles.toFixed(1)} mi`} away${punch.in_address ? ` (${punch.in_address})` : ''}`, url: '/team', ref: punch.id })
      }
      return { sent }
    }
  }
  return { error: 'Unknown event' }
}

function distance(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

// ---------- Every 5 minutes (Supabase Cron) ----------

async function tick() {
  const now = ny()
  const done = { queued: 0, shift: 0, stillin: 0, late: 0 }

  // Held during quiet hours: send now that it's morning.
  if (!isQuiet(now.minutes)) {
    const { data: held } = await admin.from('push_queue').select('*').order('id')
    for (const q of held ?? []) {
      done.queued += await deliver(q.employee_id, { title: q.title, body: q.body, url: q.url, tag: `${q.kind}-${q.id}` })
      await admin.from('push_queue').delete().eq('id', q.id)
    }
  }

  const { data: shifts } = await admin.from('shifts').select('*').eq('date', now.date).eq('published', true)
  const { data: open } = await admin.from('punches').select('*').is('clock_out', null)
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString()
  const { data: recent } = await admin.from('punches').select('employee_id, clock_in').gte('clock_in', since)
  const ids = [...new Set([...(shifts ?? []).map((s) => s.employee_id), ...(open ?? []).map((p) => p.employee_id)])]
  const team = await people(ids)
  const person = (id) => team.find((p) => p.id === id)
  const isOpen = (id) => (open ?? []).some((p) => p.employee_id === id)

  // Shift starts soon (30 minutes to start) and they aren't clocked in yet.
  for (const s of shifts ?? []) {
    const p = person(s.employee_id)
    if (p && s.start_min - now.minutes > 0 && s.start_min - now.minutes <= timing.beforeShift && !isOpen(p.id)) {
      done.shift += await notify(p, 'shift', { title: `⏰ Shift at ${clock(s.start_min)}`, body: `${s.title ? `${s.title}, ` : ''}${clock(s.start_min)} – ${clock(s.end_min)}. Don't forget to clock in!`, url: '/team', ref: s.id })
    }
  }

  // Still clocked in a while after the shift ended (or 12 hours with no shift).
  for (const punch of open ?? []) {
    const p = person(punch.employee_id)
    if (!p) continue
    const start = ny(punch.clock_in)
    const shift = (shifts ?? []).filter((s) => s.employee_id === p.id && start.date === now.date).sort((a, b) => b.end_min - a.end_min)[0]
    const hours = (Date.now() - new Date(punch.clock_in)) / 3600000
    const overdue = start.date < now.date ? hours > 4 : shift ? now.minutes >= shift.end_min + timing.afterShift : hours >= 12
    if (overdue) {
      done.stillin += await notify(p, 'stillin', { title: '⚠️ Still clocked in?', body: shift ? `Your shift ended at ${clock(shift.end_min)}. Clock out if you're done.` : `You've been clocked in since ${clock(start.minutes)}. Clock out if you're done.`, url: '/team', ref: punch.id })
    }
  }

  // A while into a shift (15 minutes to start) and no clock-in: tell the managers.
  const late = (shifts ?? []).filter((s) => {
    const into = now.minutes - s.start_min
    if (into < timing.lateAfter || into > 120) return false
    return !(recent ?? []).some((r) => r.employee_id === s.employee_id && ny(r.clock_in).date === now.date && ny(r.clock_in).minutes >= s.start_min - 90)
  })
  if (late.length) {
    const lateTeam = await people(late.map((s) => s.employee_id))
    for (const m of await managers()) {
      for (const s of late) {
        const who = lateTeam.find((p) => p.id === s.employee_id)
        // Schedule-only people (update 020) don't clock in.
        if (who && who.id !== m.id && who.pay_type !== 'none') done.late += await notify(m, 'late', { title: '🕐 Not clocked in yet', body: `${first(who.name)} hasn't clocked in for the ${clock(s.start_min)} shift`, url: '/team', ref: `${s.id}` })
      }
    }
  }
  return done
}

// ---------- The door ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  let body = {}
  try {
    body = await req.json()
  } catch {
    // An empty body is a tick from the timer.
  }
  if (keyProblem) return reply({ error: keyProblem }, 500)
  // The public half of the key pair, for phones turning notifications on.
  // (Public by design; the private half never leaves these secrets.)
  if (body.event === 'key') return reply({ publicKey: secret('VAPID_PUBLIC_KEY') })
  try {
    await loadTiming()
    if (!body.event || body.event === 'tick') {
      if (!secret('CRON_SECRET') || req.headers.get('x-cron-secret') !== secret('CRON_SECRET')) return reply({ error: 'Not allowed' }, 401)
      return reply(await tick())
    }
    const me = await caller(req)
    if (!me) return reply({ error: 'Not on the team list' }, 401)
    return reply(await onEvent(me, body))
  } catch (err) {
    return reply({ error: String(err?.message ?? err) }, 500)
  }
})
