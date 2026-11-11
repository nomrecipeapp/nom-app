// Open an outside web page (a recipe's original site, Terms, Privacy).
// On iPhone it slides up inside Nom (Safari view with a Done button), so
// people don't get bounced out of the app. On the website it opens a new tab.
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export function openLink(url) {
  if (!url) return
  if (Capacitor.isNativePlatform()) {
    Browser.open({ url, presentationStyle: 'popover' }).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer')
    })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

// For <a> tags: keeps the normal link on the website, opens in-app on iPhone.
export function linkProps(url) {
  return {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
    onClick: (e) => {
      if (!Capacitor.isNativePlatform()) return
      e.preventDefault()
      openLink(url)
    },
  }
}
