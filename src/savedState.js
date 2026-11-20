// Keep your place when iOS closes Nom in the background.
// iOS can quietly close an app that's in the background (to free up memory),
// and when it reopens, everything typed into React state is gone. This keeps a
// small copy of an in-progress screen (an Add recipe draft, the onboarding
// step) on the phone: iPhone storage in the app, browser storage on the website.
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const native = Capacitor.isNativePlatform()

// Where an in-progress Add recipe is kept. App.jsx also reads it on launch
// to reopen Add if iOS closed Nom mid-draft.
export const addDraftKey = (userId) => `nom-add-draft-${userId}`

async function readRaw(key) {
  if (native) return (await Preferences.get({ key })).value
  return localStorage.getItem(key)
}

// Returns the saved data, or null if there's nothing (or it's older than maxAgeMs)
export async function loadSaved(key, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  if (!key) return null
  try {
    const parsed = JSON.parse((await readRaw(key)) || 'null')
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return null
    if (Date.now() - (parsed.savedAt || 0) > maxAgeMs) {
      await clearSaved(key)
      return null
    }
    return { ...parsed.data, savedAt: parsed.savedAt }
  } catch { return null }
}

export async function saveState(key, data) {
  if (!key) return
  const value = JSON.stringify({ savedAt: Date.now(), data })
  try {
    if (native) await Preferences.set({ key, value })
    else localStorage.setItem(key, value)
  } catch { /* storage full or blocked: nothing to do */ }
}

export async function clearSaved(key) {
  if (!key) return
  try {
    if (native) await Preferences.remove({ key })
    else localStorage.removeItem(key)
  } catch { /* ignore */ }
}

// Saves `data` under `key` a moment after it stops changing, and right away
// when Nom goes to the background (that's when iOS might close it).
// Pass data = null to skip saving (for example, while a saved copy is still loading),
// or data = false to delete the saved copy (for example, the form is empty again).
// Returns finish(): deletes the saved copy and stops saving (call it on Save or Cancel).
export function useSaveState(key, data) {
  const latest = useRef({ key, data })
  useEffect(() => { latest.current = { key, data } })
  const stopped = useRef(false)
  const json = data ? JSON.stringify(data) : data === false ? 'clear' : null

  useEffect(() => {
    if (!key || !json || stopped.current) return
    const t = setTimeout(() => {
      if (stopped.current) return
      if (json === 'clear') clearSaved(key)
      else saveState(key, JSON.parse(json))
    }, 300)
    return () => clearTimeout(t)
  }, [key, json])

  useEffect(() => {
    function flush() {
      if (document.visibilityState !== 'hidden' || stopped.current) return
      const { key: k, data: d } = latest.current
      if (k && d) saveState(k, d)
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  return function finish() {
    stopped.current = true
    return clearSaved(latest.current.key)
  }
}
