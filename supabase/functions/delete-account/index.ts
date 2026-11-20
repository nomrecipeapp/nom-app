// Deletes the signed-in person's account, then their photos.
// Called from Settings > Delete account (web and iOS app).
//   1. Checks who's asking from their sign-in token (you can only delete yourself)
//   2. Deletes their auth user. Every Nom table cascades from it, same as the old delete_user().
//   3. Removes their files from the avatars, recipe-images and cook-photos buckets.
//      Every upload is saved under a folder named after the user id, so we clear that folder.
// Account first, photos second: if photo cleanup hiccups, the account is still gone
// (the important part for people and for Apple), and we log what was left behind.
// Deployed with verify_jwt = false because the token check below is the lock.

import { SERVICE_KEY, SUPABASE_URL } from '../_shared/alerts.ts'

const BUCKETS = ['avatars', 'recipe-images', 'cook-photos']
const admin = { apikey: SERVICE_KEY }

// The iOS app calls from capacitor://localhost, so allow any origin.
// Safe here: there are no cookies, and the caller must send their own sign-in token.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

async function userFromToken(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token === SERVICE_KEY) return null
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { ...admin, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const user = await r.json()
  return typeof user?.id === 'string' ? user.id : null
}

// Every file path inside one bucket's user folder
async function listFolder(bucket: string, userId: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { ...admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: `${userId}/`, limit: 1000, offset }),
    })
    if (!r.ok) throw new Error(`list ${bucket}: ${r.status} ${await r.text()}`)
    const items: { name: string; id: string | null }[] = await r.json()
    // Real files have an id; sub-folders come back with id null
    for (const it of items) if (it.id) paths.push(`${userId}/${it.name}`)
    if (items.length < 1000) return paths
  }
}

async function removeFiles(bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += 500) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { ...admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths.slice(i, i + 500) }),
    })
    if (!r.ok) throw new Error(`remove ${bucket}: ${r.status} ${await r.text()}`)
  }
}

// ── Sign in with Apple: cut the Apple link (Apple requires this when an account is deleted) ──
// The app sends a fresh one-time code from Apple (appleAuthorizationCode). We trade it for a token,
// then ask Apple to revoke it. Needs three secrets (set once with `supabase secrets set`):
//   APPLE_KEY_ID       the Key ID of the "Nom Sign in with Apple" key
//   APPLE_PRIVATE_KEY  the contents of that key's .p8 file
//   APPLE_TEAM_ID      Apple team ID (falls back to APNS_TEAM_ID, same team)
// Never blocks the delete: if anything here fails, it's logged and the account is still deleted.
const APPLE_CLIENT_ID = 'com.nomrecipeapp.nom'

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Apple's "client secret" is a short-lived token signed with the .p8 key (ES256)
async function appleClientSecret(): Promise<string | null> {
  const keyId = Deno.env.get('APPLE_KEY_ID')
  const teamId = Deno.env.get('APPLE_TEAM_ID') ?? Deno.env.get('APNS_TEAM_ID')
  const pem = Deno.env.get('APPLE_PRIVATE_KEY')
  if (!keyId || !teamId || !pem) return null
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const payload = b64url(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: APPLE_CLIENT_ID }))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`
}

async function revokeApple(code: string): Promise<string> {
  try {
    const secret = await appleClientSecret()
    if (!secret) return 'skipped: Apple secrets not set'
    const form = (fields: Record<string, string>) => new URLSearchParams({ client_id: APPLE_CLIENT_ID, client_secret: secret, ...fields })
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ grant_type: 'authorization_code', code }),
    })
    if (!tokenRes.ok) return `token failed: ${tokenRes.status} ${await tokenRes.text()}`
    const tokens = await tokenRes.json()
    const token = tokens.refresh_token ?? tokens.access_token
    const hint = tokens.refresh_token ? 'refresh_token' : 'access_token'
    if (!token) return 'token failed: no token'
    const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ token, token_type_hint: hint }),
    })
    return revokeRes.ok ? 'revoked' : `revoke failed: ${revokeRes.status} ${await revokeRes.text()}`
  } catch (e) {
    return `revoke error: ${String(e)}`
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const userId = await userFromToken(req)
  if (!userId) return json({ error: 'Not signed in' }, 401)

  let body: { appleAuthorizationCode?: string; emptyOnly?: boolean } = {}
  try { body = await req.json() } catch (_e) { /* no body: plain delete */ }

  // emptyOnly: the app is cleaning up a just-made Apple sign-in with no invite code.
  // Refuse if this account turns out to have a Nom profile, so a real member is never removed this way.
  if (body.emptyOnly) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id`, { headers: admin })
    const rows = r.ok ? await r.json() : null
    if (!Array.isArray(rows) || rows.length > 0) return json({ error: 'Account has a profile' }, 409)
  }

  // 0. Apple link (only for people who use Sign in with Apple)
  if (typeof body.appleAuthorizationCode === 'string' && body.appleAuthorizationCode) {
    console.log('apple revoke', userId, await revokeApple(body.appleAuthorizationCode))
  }

  // 1. The account
  const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })
  if (!del.ok) {
    console.error('delete user failed', userId, del.status, await del.text())
    return json({ error: "Couldn't delete the account" }, 500)
  }

  // 2. Their photos
  const leftover: string[] = []
  let removed = 0
  for (const bucket of BUCKETS) {
    try {
      const paths = await listFolder(bucket, userId)
      if (paths.length) await removeFiles(bucket, paths)
      removed += paths.length
    } catch (e) {
      console.error('photo cleanup failed', userId, bucket, String(e))
      leftover.push(bucket)
    }
  }
  console.log('account deleted', userId, { removed, leftover })

  return json({ ok: true, photosRemoved: removed, photoCleanupFailed: leftover })
})
