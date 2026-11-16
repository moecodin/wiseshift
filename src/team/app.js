// The team page as an installable app: "WiseShift" ("WiseShift" under
// the icon). Only /team becomes the app; everything else is a normal web page.
//   public/app/wiseshift.webmanifest   name, icons, colors, opens full-screen at /team
//   public/wiseshift-sw.js             keeps the page's files on the phone
import { useEffect, useState } from 'react'
import { supabase, usingSupabase } from '../lib/supabase.js'

// Push notifications: the public half of the key pair comes from the send-push
// function (its VAPID_PUBLIC_KEY secret), so changing the keys in Supabase never
// needs a new version of the site. The private half stays in Supabase.

// Add the app's tags to the page (the shared index.html is generic).
export function setUpTeamApp() {
  const head = document.head
  const add = (tag, attrs) => {
    const el = document.createElement(tag)
    Object.assign(el, attrs)
    head.append(el)
    return el
  }
  add('link', { rel: 'manifest', href: '/app/wiseshift.webmanifest' })
  add('link', { rel: 'apple-touch-icon', href: '/app/apple-touch-icon.png' })
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'apple-mobile-web-app-title', content: 'WiseShift' })
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' })
  add('meta', { name: 'theme-color', content: '#0d2e43' })
  document.querySelector('link[rel="icon"]')?.setAttribute('href', '/app/icon-192.png')

  // Only the built site has a service worker (it would get in the way while developing).
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/wiseshift-sw.js', { scope: '/team' }).catch(() => {
      // Still works as a normal web page.
    })
  }
}

// Opened from the home-screen icon (not in a browser tab)?
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// Can this phone install the app, and how: 'prompt' (Android/Chrome: one tap),
// 'iphone' (Share → Add to Home Screen), or null (already installed, or can't).
export function useInstall() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(isInstalled)
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  if (installed) return { how: null }
  if (prompt) {
    return {
      how: 'prompt',
      install: async () => {
        prompt.prompt()
        const { outcome } = await prompt.userChoice
        if (outcome === 'accepted') setInstalled(true)
        setPrompt(null)
      },
    }
  }
  return { how: isIphone() ? 'iphone' : null }
}

// Is there a newer version of the site than the one open? Checks when the app
// comes back on screen and every 10 minutes, by comparing the built script's name.
const scriptName = (html) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null

export function useNewVersion() {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    const mine = scriptName(document.documentElement.innerHTML)
    if (!mine) return // developing locally: nothing to compare
    const check = async () => {
      try {
        const res = await fetch('/team', { cache: 'no-store' })
        const latest = scriptName(await res.text())
        if (latest && latest !== mine) setFresh(true)
      } catch {
        // Offline; try again later.
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [])
  return fresh
}

// Online or not, kept up to date.
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

// ---------- Push notifications ----------

// Can this phone get notifications here? 'ok', 'install-first' (iPhone: only
// from the installed app), 'blocked' (turned off in the phone's settings),
// 'not-ready' (no key yet, or developing locally), or 'unsupported'.
export function pushSupport() {
  if (!usingSupabase || !import.meta.env.PROD) return 'not-ready'
  if (isIphone() && !isInstalled()) return 'install-first'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return 'ok'
}

const keyBytes = (base64) => {
  const raw = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/team')) ?? navigator.serviceWorker.register('/wiseshift-sw.js', { scope: '/team' })
}

// Is this phone signed up for notifications right now?
export async function pushIsOn() {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return false
  const reg = await registration()
  return Boolean(await reg.pushManager.getSubscription())
}

// The current public key, from Supabase.
async function publicKey() {
  const { data, error } = await supabase.functions.invoke('send-push', { body: { event: 'key' } })
  if (error) throw new Error(`Couldn't get the notification key: ${await reason(error)}`)
  if (!data?.publicKey) throw new Error('The VAPID_PUBLIC_KEY secret is missing in Supabase')
  return keyBytes(data.publicKey)
}

const sameBytes = (a, b) => a && b && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === new Uint8Array(b)[i])

// Ask, sign this phone up, and save it for the signed-in person. Returns '' or a problem.
export async function turnOnPush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'Not allowed'
  try {
    const key = await publicKey()
    const reg = await registration()
    await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    // Signed up with an older key: start over with the current one.
    if (sub && !sameBytes(sub.options?.applicationServerKey, key.buffer)) {
      await sub.unsubscribe()
      sub = null
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    const json = sub.toJSON()
    const { error } = await supabase.rpc('save_push_subscription', {
      sub_endpoint: json.endpoint, sub_p256dh: json.keys.p256dh, sub_auth: json.keys.auth, sub_device: navigator.userAgent.slice(0, 120),
    })
    return error ? error.message : ''
  } catch (err) {
    return err.message || String(err)
  }
}

export async function turnOffPush() {
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return ''
  await supabase.rpc('remove_push_subscription', { sub_endpoint: sub.endpoint })
  await sub.unsubscribe()
  return ''
}

// Tell the send-push function something happened (it decides who to notify).
// Never waits and never fails loudly: notifications are a bonus.
export function tellPush(event, details = {}) {
  if (!usingSupabase) return Promise.resolve(null)
  return supabase.functions.invoke('send-push', { body: { event, ...details } }).then(
    async ({ data, error }) => (error ? { error: await reason(error) } : data),
    (err) => ({ error: err.message }),
  )
}

// The function's own explanation ("Not on the team list", "Invalid JWT"…) with
// its status code, instead of supabase-js's "returned a non-2xx status code".
async function reason(error) {
  const res = error.context
  if (!(res instanceof Response)) return error.message
  let text = ''
  try {
    const body = await res.clone().json()
    text = body.error || body.msg || body.message || JSON.stringify(body)
  } catch {
    text = await res.text().catch(() => '')
  }
  return `${res.status}${text ? `: ${text}` : ''}`
}
