// Shareable links (1.0.4): tapping www.nomrecipeapp.com/r/<id> or /c/<id> on an iPhone with Nom
// opens the app (Universal Links). SceneDelegate.swift (OpenLink) saves "recipe:<id>" or
// "cook:<id>" in phone storage; App.jsx calls takeOpenLink() as Nom opens or comes back
// and opens that recipe or cook. Website: always null.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

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
