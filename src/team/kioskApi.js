// The kiosk's two calls (update 025), and the manager's setup calls (devices and PINs).
// Without Supabase (sample mode) they work on made-up people so the kiosk can be tried:
//   4821 Maria (clocking in)   7305 Sam (clocking out)   6100 Ava (clocking in too early)
import { supabase, usingSupabase } from '../lib/supabase.js'

const TOKEN_KEY = 'wiseshift-kiosk-token'

export const savedKioskToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}
export const saveKioskToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // The kiosk then asks to be set up again after a reload.
  }
}
export const forgetKioskToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to forget.
  }
}

// The kiosk lives at <site>/kiosk. (An older link, <site>/team?kiosk=TOKEN, still works once.)
const BASE = import.meta.env.BASE_URL
export const kioskAddress = () => `${location.origin}${BASE}kiosk`
export const isKioskAddress = () => {
  const path = location.pathname.replace(/\/+$/, '')
  return path === `${BASE.replace(/\/+$/, '')}/kiosk` || new URLSearchParams(location.search).has('kiosk')
}

// The store computer types the pairing code once and receives its token.
// Returns { status: 'ok' | 'bad_code' | 'locked' | 'error', token }.
export async function kioskPair(code) {
  if (!usingSupabase) return { status: 'ok', token: 'sample' }
  const { data, error } = await supabase.rpc('pair_kiosk', { pair_code: code })
  if (error) return { status: 'error', token: '', message: error.message }
  return { status: data?.[0]?.status ?? 'error', token: data?.[0]?.token ?? '' }
}

// ---------- the kiosk page ----------

// How this kiosk looks ('auto', 'light' or 'dark'). The manager sets it in Settings → Kiosk;
// the page asks before any PIN is typed and again every minute. Sample mode keeps it on this browser.
const SAMPLE_THEME_KEY = 'wiseshift-kiosk-sample-theme'
// The business's name and logo for the kiosk's header (empty strings = WiseShift's own).
export async function kioskBrand(token) {
  if (!usingSupabase) return { name: '', logo: '' }
  const { data, error } = await supabase.rpc('kiosk_brand', { device_token: token })
  if (error) return { name: '', logo: '' }
  const row = data?.[0]
  return { name: row?.business_name ?? '', logo: row?.business_logo ?? '' }
}

export async function kioskInfo(token) {
  if (!usingSupabase) {
    try {
      return { status: 'ok', theme: localStorage.getItem(SAMPLE_THEME_KEY) || 'auto' }
    } catch {
      return { status: 'ok', theme: 'auto' }
    }
  }
  const { data, error } = await supabase.rpc('kiosk_info', { device_token: token })
  if (error) return { status: 'error', theme: 'auto' }
  const row = data?.[0]
  return { status: row?.status ?? 'off', theme: row?.theme ?? 'auto' }
}


const SAMPLE = {
  4821: { person: 'Maria Lopez', action: 'in', shiftStart: 540, shiftEnd: 1020, outside: false },
  7305: { person: 'Sam Lucero', action: 'out', shiftStart: 480, shiftEnd: 1020, outside: false, since: new Date(Date.now() - 6.2 * 3600000).toISOString() },
  6100: { person: 'Ava Brooks', action: 'in', shiftStart: 960, shiftEnd: 1320, outside: true },
}
let sampleFails = 0
let sampleLockedUntil = 0

function sampleCheck(pin) {
  if (Date.now() < sampleLockedUntil) return { status: 'locked', retrySeconds: Math.ceil((sampleLockedUntil - Date.now()) / 1000) }
  if (!SAMPLE[pin]) {
    sampleFails += 1
    if (sampleFails >= 5) {
      sampleFails = 0
      sampleLockedUntil = Date.now() + 5 * 60000
      return { status: 'locked', retrySeconds: 300 }
    }
    return { status: 'bad_pin', triesLeft: 5 - sampleFails }
  }
  sampleFails = 0
  return null
}

const fromRow = (r) =>
  r
    ? {
        status: r.status,
        person: r.person ?? '',
        action: r.action ?? '',
        at: r.at ?? null,
        triesLeft: r.tries_left ?? null,
        retrySeconds: r.retry_seconds ?? null,
        shiftStart: r.shift_start ?? null,
        shiftEnd: r.shift_end ?? null,
        since: r.since ?? null,
        outside: Boolean(r.outside),
        anywayOk: r.anyway_ok !== false,
      }
    : { status: 'off' }

// Who is this PIN, and what would a punch do? Saves nothing.
export async function kioskLookup(token, pin) {
  if (!usingSupabase) {
    const bad = sampleCheck(pin)
    if (bad) return bad
    return { status: 'ok', ...SAMPLE[pin], at: new Date().toISOString(), anywayOk: true }
  }
  const { data, error } = await supabase.rpc('kiosk_lookup', { device_token: token, pin })
  if (error) return { status: 'error', message: error.message }
  return fromRow(data?.[0])
}

// Clock in or out. `anyway` clocks in outside the early window (the manager sees it in review).
export async function kioskPunch(token, pin, anyway = false) {
  if (!usingSupabase) {
    const p = SAMPLE[pin]
    if (!p) return { status: 'bad_pin' }
    if (p.action === 'in' && p.outside && !anyway) return { status: 'too_early', person: p.person, action: 'in' }
    return { status: 'ok', person: p.person, action: p.action, at: new Date().toISOString() }
  }
  const { data, error } = await supabase.rpc('kiosk_punch', { device_token: token, pin, anyway })
  if (error) return { status: 'error', message: error.message }
  return fromRow(data?.[0])
}

// ---------- managers: devices and PINs ----------

// Sample mode keeps these in memory for the session.
const sampleDevices = []
const samplePins = new Set()

export async function listKioskDevices() {
  if (!usingSupabase) return { devices: sampleDevices.filter((d) => !d.revokedAt), error: '' }
  const { data, error } = await supabase.from('kiosk_devices').select('id, name, last_used_at, revoked_at, created_at, theme, paired_at, pair_expires_at').is('revoked_at', null).order('created_at')
  if (error) return { devices: [], error: error.message }
  return {
    devices: data.map((d) => ({
      id: d.id, name: d.name, lastUsedAt: d.last_used_at, createdAt: d.created_at, theme: d.theme ?? 'auto',
      paired: Boolean(d.paired_at), pairExpiresAt: d.pair_expires_at ?? null,
    })),
    error: '',
  }
}

// A manager asks for a pairing code for a new computer: { code, expiresAt } (the code is shown once).
export async function newKioskPairing(name) {
  if (!usingSupabase) {
    sampleDevices.push({ id: `kd${sampleDevices.length + 1}`, name, createdAt: new Date().toISOString(), lastUsedAt: null, theme: 'auto', paired: false })
    return { code: 'DEMO-2345', expiresAt: new Date(Date.now() + 600000).toISOString(), error: '' }
  }
  const { data, error } = await supabase.rpc('new_kiosk_pairing', { device_name: name })
  return error ? { code: '', expiresAt: null, error: error.message } : { code: data[0].code, expiresAt: data[0].expires_at, error: '' }
}

// A new code for a kiosk that is already set up; the old computer stops working at once.
export async function repairKioskDevice(id) {
  if (!usingSupabase) {
    return { code: 'DEMO-2345', expiresAt: new Date(Date.now() + 600000).toISOString(), error: '' }
  }
  const { data, error } = await supabase.rpc('repair_kiosk_device', { device_id: id })
  return error ? { code: '', expiresAt: null, error: error.message } : { code: data[0].code, expiresAt: data[0].expires_at, error: '' }
}

// Returns { token } once; it is not kept anywhere. (Older way: a link with the token inside.)
export async function addKioskDevice(name) {
  if (!usingSupabase) {
    const token = Array.from({ length: 48 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    sampleDevices.push({ id: `kd${sampleDevices.length + 1}`, name, createdAt: new Date().toISOString(), lastUsedAt: null, theme: 'auto', paired: true })
    return { token, error: '' }
  }
  const { data, error } = await supabase.rpc('new_kiosk_device', { device_name: name })
  return error ? { token: '', error: error.message } : { token: data, error: '' }
}

// 'auto', 'light' or 'dark'. Returns '' when it worked, otherwise the problem.
export async function setKioskTheme(id, theme) {
  if (!usingSupabase) {
    const d = sampleDevices.find((x) => x.id === id)
    if (d) d.theme = theme
    try {
      localStorage.setItem(SAMPLE_THEME_KEY, theme)
    } catch {
      // The sample kiosk then stays on Auto.
    }
    return ''
  }
  const { error } = await supabase.rpc('set_kiosk_theme', { device_id: id, new_theme: theme })
  return error ? error.message : ''
}

export async function revokeKioskDevice(id) {
  if (!usingSupabase) {
    const d = sampleDevices.find((x) => x.id === id)
    if (d) d.revokedAt = new Date().toISOString()
    return ''
  }
  const { error } = await supabase.rpc('revoke_kiosk_device', { device_id: id })
  return error ? error.message : ''
}

// Who has a PIN (a Set of employee ids). Never the PINs themselves.
export async function kioskPinOwners() {
  if (!usingSupabase) return { owners: new Set(samplePins), error: '' }
  const { data, error } = await supabase.rpc('kiosk_pin_status')
  if (error) return { owners: new Set(), error: error.message }
  return { owners: new Set(data.map((r) => r.employee_id)), error: '' }
}

export async function setKioskPin(employeeId, pin) {
  if (!usingSupabase) {
    if (!/^\d{4,6}$/.test(pin)) return 'A PIN is 4 to 6 digits'
    samplePins.add(employeeId)
    return ''
  }
  const { error } = await supabase.rpc('set_kiosk_pin', { emp: employeeId, pin })
  return error ? error.message : ''
}

export async function clearKioskPin(employeeId) {
  if (!usingSupabase) {
    samplePins.delete(employeeId)
    return ''
  }
  const { error } = await supabase.rpc('clear_kiosk_pin', { emp: employeeId })
  return error ? error.message : ''
}
