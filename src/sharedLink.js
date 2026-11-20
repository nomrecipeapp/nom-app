// Shareable links (1.0.4): tapping www.nomrecipeapp.com/r/<id> or /c/<id> on an iPhone with Nom
// opens the app (Universal Links). SceneDelegate.swift (OpenLink) saves "recipe:<id>" or
// "cook:<id>" in phone storage; App.jsx calls takeOpenLink() as Nom opens or comes back
// and opens that recipe or cook. Website: always null.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { supabase } from './supabase'

const KEY = 'nom-open-link'

// Returns { kind: 'recipe' | 'cook', id } once, then clears it
export async function takeOpenLink() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { value } = await Preferences.get({ key: KEY })
    if (!value) return null
    await Preferences.remove({ key: KEY })
    const [kind, id] = value.split(':')
    if ((kind !== 'recipe' && kind !== 'cook') || !id) return null
    return { kind, id }
  } catch { return null }
}

// The link people get when they tap Share on a recipe or cook
export function shareLink(kind, id) {
  return `https://www.nomrecipeapp.com/${kind === 'cook' ? 'c' : 'r'}/${id}`
}

// Tapping Share on your OWN recipe or cook marks it as shareable, so its link shows the
// full preview even if your account is Private (see 2026-11-20-share-links-owner.sql).
// Runs in the background: the share sheet has to open right away from the tap.
export function markShared(kind, id) {
  supabase.from(kind === 'cook' ? 'cooks' : 'recipes')
    .update({ link_shared_at: new Date().toISOString() })
    .eq('id', id)
    .then(({ error }) => { if (error) console.error('markShared', error) })
}
