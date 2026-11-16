// Who is signed in. In sample mode (no Supabase connection) there are no
// logins, so everyone counts as signed in.
import { useEffect, useState } from 'react'
import { supabase, usingSupabase } from '../lib/supabase.js'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(usingSupabase)

  useEffect(() => {
    if (!usingSupabase) return
    // The browser remembers the sign-in.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  return {
    checking,
    signedIn: !usingSupabase || Boolean(session),
    email: session?.user?.email ?? '',
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
}
