import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Stay signed in on iPhone.
// iOS can clear a web view's browser storage (localStorage) when the phone is
// low on space or the app sits unused, which signs people out. On the iPhone
// app we keep the sign-in in the app's own storage instead. The first time a
// key is read, anything still in browser storage is copied over, so nobody
// who is already signed in gets logged out by this update.
const nativeStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key })
    if (value !== null && value !== undefined) return value
    let legacy = null
    try { legacy = window.localStorage.getItem(key) } catch { /* storage unavailable */ }
    if (legacy !== null) {
      await Preferences.set({ key, value: legacy })
      try { window.localStorage.removeItem(key) } catch { /* ignore */ }
    }
    return legacy
  },
  async setItem(key, value) {
    await Preferences.set({ key, value })
  },
  async removeItem(key) {
    await Preferences.remove({ key })
    try { window.localStorage.removeItem(key) } catch { /* ignore */ }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, Capacitor.isNativePlatform()
  ? { auth: { storage: nativeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
  : undefined)

// Relative '/api/...' calls only resolve inside a browser tab served from
// the app's own origin. The native (Capacitor) build loads from a local
// bundle with no such origin, so those calls need an absolute base there.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
