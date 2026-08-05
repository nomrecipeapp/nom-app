import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Relative '/api/...' calls only resolve inside a browser tab served from
// the app's own origin. The native (Capacitor) build loads from a local
// bundle with no such origin, so those calls need an absolute base there.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''