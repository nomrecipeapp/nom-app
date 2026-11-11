// Push notifications on iPhone.
//
//   setupPush(userId, onTap)  call once after sign-in. If notifications are already
//                             allowed it quietly re-registers (phones' addresses can change).
//                             If we've never asked, it shows a short Nom sheet first and only
//                             then Apple's permission popup, so people know why we're asking.
//   unregisterPush()          call before signing out, so the next person on this
//                             phone doesn't get the last person's notifications.
//
// The phone's push address goes into the device_tokens table. The send-push
// function (Supabase) sends a push whenever a new notification row is added.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'
import { confirmSheet } from './ui'
import { isWhatsNewOpen } from './WhatsNew'

const ASKED_KEY = 'nom_push_asked'
const TOKEN_KEY = 'nom_push_token'
let listenersAdded = false

async function addListeners(onTap) {
  if (listenersAdded) return
  listenersAdded = true
  await PushNotifications.addListener('registration', async ({ value }) => {
    try {
      await Preferences.set({ key: TOKEN_KEY, value })
      await supabase.rpc('claim_device_token', { p_token: value, p_platform: 'ios' })
    } catch { /* try again next launch */ }
  })
  await PushNotifications.addListener('registrationError', () => { /* try again next launch */ })
  // Tapping a notification opens the Notifications screen
  await PushNotifications.addListener('pushNotificationActionPerformed', () => { onTap?.() })
}

function waitForWhatsNewToClose() {
  return new Promise(resolve => {
    const check = () => (isWhatsNewOpen() ? setTimeout(check, 800) : resolve())
    check()
  })
}

export async function setupPush(userId, onTap) {
  try {
    if (!Capacitor.isNativePlatform() || !userId) return
    await addListeners(onTap)
    let { receive } = await PushNotifications.checkPermissions()

    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      const { value: asked } = await Preferences.get({ key: ASKED_KEY })
      if (asked) return
      // Let the app settle (and any "What's new" sheet close) before asking
      await new Promise(r => setTimeout(r, 2500))
      await waitForWhatsNewToClose()
      await Preferences.set({ key: ASKED_KEY, value: new Date().toISOString() })
      const yes = await confirmSheet({
        title: 'Turn on notifications?',
        message: 'Hear when friends like or comment on your cooks, or want to follow you.',
        confirmLabel: 'Turn on',
        cancelLabel: 'Not now',
      })
      if (!yes) return
      receive = (await PushNotifications.requestPermissions()).receive
    }

    if (receive === 'granted') await PushNotifications.register()
  } catch { /* push is a nice-to-have, never block the app */ }
}

export async function unregisterPush() {
  try {
    if (!Capacitor.isNativePlatform()) return
    const { value } = await Preferences.get({ key: TOKEN_KEY })
    if (value) await supabase.from('device_tokens').delete().eq('token', value)
    await Preferences.remove({ key: TOKEN_KEY })
  } catch { /* ignore */ }
}

// Clears Nom's pushes from Notification Center once Notifications is opened
export async function clearBadge() {
  try {
    if (!Capacitor.isNativePlatform()) return
    await PushNotifications.removeAllDeliveredNotifications()
  } catch { /* ignore */ }
}
