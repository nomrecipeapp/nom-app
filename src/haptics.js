// Little taps you feel on the iPhone. Does nothing on the website.
//   tap()      light tick: tab switches, picking a verdict or score, likes
//   success()  happy buzz: saved a recipe, logged a cook
//   warning()  for destructive confirms
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const native = Capacitor.isNativePlatform()

export function tap() {
  if (!native) return
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

export function success() {
  if (!native) return
  Haptics.notification({ type: NotificationType.Success }).catch(() => {})
}

export function warning() {
  if (!native) return
  Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
}
