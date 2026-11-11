// App Store rating prompt at a happy moment: right after someone logs their
// third "Would Make Again" cook. Uses Apple's built-in review popup (Apple
// decides whether it actually appears, and caps it at 3 times a year).
// We only ask once per phone, and never while the "What's new" sheet is up.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { InAppReview } from '@capacitor-community/in-app-review'
import { supabase } from './supabase'
import { isWhatsNewOpen } from './WhatsNew'

const ASKED_KEY = 'nom_rating_prompted'
const HAPPY_COOKS_NEEDED = 3

export async function maybeAskForRating(userId, verdict) {
  try {
    if (!Capacitor.isNativePlatform() || verdict !== 'would_make_again' || !userId) return
    const { value } = await Preferences.get({ key: ASKED_KEY })
    if (value) return
    const { count, error } = await supabase
      .from('cooks').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('verdict', 'would_make_again')
    if (error || (count || 0) < HAPPY_COOKS_NEEDED) return
    if (isWhatsNewOpen()) return
    await Preferences.set({ key: ASKED_KEY, value: new Date().toISOString() })
    // Let the "cook saved" moment land first
    setTimeout(() => { InAppReview.requestReview().catch(() => {}) }, 1200)
  } catch { /* never block logging a cook */ }
}
