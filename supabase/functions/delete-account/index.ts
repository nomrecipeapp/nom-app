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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const userId = await userFromToken(req)
  if (!userId) return json({ error: 'Not signed in' }, 401)

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
