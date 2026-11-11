// Sends an iPhone push notification whenever a row is added to public.notifications
// (likes, comments, mentions, saves, follow requests and approvals).
// Triggered by a Database Webhook on INSERT into public.notifications (deployed with
// verify_jwt = false; the notification is re-read from the database so fake calls can't send pushes).
//
// Secrets (set with `supabase secrets set`):
//   APNS_KEY_ID       the Key ID shown next to the "Nom Push" key on developer.apple.com
//   APNS_TEAM_ID      your Apple Team ID
//   APNS_PRIVATE_KEY  the contents of the AuthKey_XXXX.p8 file
// The key works for both Xcode test builds (sandbox) and the App Store app (production):
// we try production first and fall back to sandbox for phones running a build from Xcode.

import { dbHeaders, fetchOne, SUPABASE_URL } from '../_shared/alerts.ts'

const BUNDLE_ID = 'com.nomrecipeapp.nom'
const KEY_ID = Deno.env.get('APNS_KEY_ID') ?? ''
const TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? ''
const PRIVATE_KEY = (Deno.env.get('APNS_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')

const HOSTS = ['https://api.push.apple.com', 'https://api.sandbox.push.apple.com']

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Apple's sign-in token for APNs (good for up to an hour; we make a fresh one each run)
async function apnsJwt(): Promise<string> {
  const pem = PRIVATE_KEY.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }))
  const claims = b64url(JSON.stringify({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) }))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`))
  return `${header}.${claims}.${b64url(sig)}`
}

function nameOf(p: { full_name?: string; username?: string } | null): string {
  return p?.full_name?.trim() || (p?.username ? `@${p.username}` : 'Someone')
}

function messageFor(type: string, actor: string, recipe: string | null): string | null {
  switch (type) {
    case 'follow_request': return `${actor} wants to follow you`
    case 'follow_approved': return `${actor} approved your follow request`
    case 'like': return `${actor} liked your cook${recipe ? ` of ${recipe}` : ''}`
    case 'comment': return `${actor} commented on your cook${recipe ? ` of ${recipe}` : ''}`
    case 'mention': return `${actor} mentioned you in a comment${recipe ? ` on ${recipe}` : ''}`
    case 'save': return `${actor} saved ${recipe ? `"${recipe}"` : 'a recipe'} from your cookbook`
    default: return null
  }
}

async function removeToken(token: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/device_tokens?token=eq.${encodeURIComponent(token)}`, {
    method: 'DELETE', headers: dbHeaders,
  }).catch(() => {})
}

async function sendTo(token: string, jwt: string, body: string, notificationId: string) {
  const payload = JSON.stringify({
    aps: { alert: { body }, sound: 'default', 'thread-id': 'nom' },
    notification_id: notificationId,
  })
  for (const host of HOSTS) {
    const res = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: payload,
    })
    if (res.ok) return 'sent'
    const reason = (await res.json().catch(() => ({})))?.reason ?? String(res.status)
    // Wrong environment for this phone: try the other one
    if (reason === 'BadDeviceToken' && host === HOSTS[0]) continue
    // The phone uninstalled Nom or turned notifications off for good
    if (reason === 'Unregistered' || reason === 'BadDeviceToken') { await removeToken(token); return 'removed' }
    return `failed: ${reason}`
  }
  return 'failed'
}

Deno.serve(async (req) => {
  let payload: { record?: { id?: string } } = {}
  try { payload = await req.json() } catch (_e) { /* ignore */ }
  const n = await fetchOne('notifications', '*', payload.record?.id ?? null)
  if (!n) return new Response('no notification', { status: 200 })
  if (!KEY_ID || !TEAM_ID || !PRIVATE_KEY) return new Response('APNs secrets not set', { status: 200 })
  if (n.actor_id && n.actor_id === n.recipient_id) return new Response('self', { status: 200 })

  const [actor, recipe] = await Promise.all([
    fetchOne('profiles', 'full_name,username', n.actor_id),
    fetchOne('recipes', 'title', n.recipe_id),
  ])
  const body = messageFor(n.type, nameOf(actor), recipe?.title ?? null)
  if (!body) return new Response('type not pushed', { status: 200 })

  const res = await fetch(`${SUPABASE_URL}/rest/v1/device_tokens?select=token&user_id=eq.${encodeURIComponent(n.recipient_id)}`, { headers: dbHeaders })
  const tokens: { token: string }[] = await res.json().catch(() => [])
  if (!Array.isArray(tokens) || tokens.length === 0) return new Response('no devices', { status: 200 })

  const jwt = await apnsJwt()
  const results = await Promise.all(tokens.map(t => sendTo(t.token, jwt, body, n.id).catch(e => `error: ${e}`)))
  return new Response(JSON.stringify(results), { status: 200, headers: { 'content-type': 'application/json' } })
})
