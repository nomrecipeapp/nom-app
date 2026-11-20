// Links someone pasted that didn't fit in today's limit. Kept on the phone
// (iPhone storage in the app, browser storage on the website) so the
// "20 links waiting" card can bring them in tomorrow with one tap.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const keyFor = (userId) => `nom-waiting-links-${userId}`
const listeners = new Set()

export async function getWaitingLinks(userId) {
  if (!userId) return []
  try {
    const raw = Capacitor.isNativePlatform()
      ? (await Preferences.get({ key: keyFor(userId) })).value
      : localStorage.getItem(keyFor(userId))
    const list = JSON.parse(raw || '[]')
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

export async function setWaitingLinks(userId, links) {
  if (!userId) return
  const value = JSON.stringify([...new Set(links)])
  try {
    if (Capacitor.isNativePlatform()) {
      if (links.length) await Preferences.set({ key: keyFor(userId), value })
      else await Preferences.remove({ key: keyFor(userId) })
    } else if (links.length) localStorage.setItem(keyFor(userId), value)
    else localStorage.removeItem(keyFor(userId))
  } catch { /* storage full or blocked: nothing to do */ }
  listeners.forEach(fn => fn(links.length))
}

export async function addWaitingLinks(userId, links) {
  const current = await getWaitingLinks(userId)
  await setWaitingLinks(userId, [...current, ...links])
}

// Lets the Cookbook card update when the list changes
export function onWaitingLinksChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
