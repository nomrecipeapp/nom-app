// Share to Nom: links shared from TikTok, Instagram, Safari or any app's share sheet.
//
// How a link gets here (iPhone only):
// 1. The share extension (ios/App/ShareExtension/ShareViewController.swift) saves the
//    link in a spot both it and Nom can read (the App Group), then opens Nom.
// 2. SceneDelegate.swift moves the links into Nom's own phone storage whenever Nom
//    opens or comes back, under the same key the Preferences plugin uses.
// 3. App.jsx calls takeSharedLinks() and opens Add with the link importing.
// If opening Nom ever fails, the link just waits here until the next time Nom opens.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const KEY = 'nom-share-inbox'
let taking = null

// Returns the waiting links (oldest first) and clears them, so each link opens once
export function takeSharedLinks() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve([])
  // App.jsx checks a few times as Nom comes back; only one check reads at a time
  if (taking) return taking.then(() => [])
  taking = (async () => {
    try {
      const { value } = await Preferences.get({ key: KEY })
      if (!value) return []
      await Preferences.remove({ key: KEY })
      const list = JSON.parse(value)
      if (!Array.isArray(list)) return []
      return [...new Set(list.filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)))]
    } catch { return [] }
  })()
  const result = taking
  result.finally(() => { taking = null })
  return result
}
