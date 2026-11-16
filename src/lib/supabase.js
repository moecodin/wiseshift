// Connection to Supabase (database + logins).
// The two values come from .env.local. If they're missing, the site runs with
// made-up sample data saved only in this browser, which is handy for trying things.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
export const usingSupabase = Boolean(supabase)
