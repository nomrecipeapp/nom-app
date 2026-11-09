// Makes a fresh one-time invite code and emails it to someone (usually from the waitlist).
// Only Syd can call it, two ways:
//   1. The Admin page (nomrecipeapp.com/admin): signed in as an account on the admins list
//   2. The Mac:  npm run invite -- friend@example.com  (carries NOM_ADMIN_SECRET)
// Marks the waitlist row as invited, so the Admin page shows who's been invited.
// Deployed with verify_jwt = false because the checks below are the lock.

import { dbHeaders, fetchColumn, SERVICE_KEY, SUPABASE_URL } from '../_shared/alerts.ts'
import { inviteEmail, sendEmail } from '../_shared/emails.ts'

const ALLOWED_ORIGINS = ['https://www.nomrecipeapp.com', 'https://nomrecipeapp.com', 'http://localhost:5173']
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } })

const db = dbHeaders

// Signed in on the Admin page? Returns the admin's user id, or null.
async function adminFromSession(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token === SERVICE_KEY) return null
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } })
    if (!u.ok) return null
    const user = await u.json()
    if (!user?.id) return null
    const a = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`, { headers: db })
    const rows = await a.json()
    return Array.isArray(rows) && rows.length > 0 ? user.id : null
  } catch (_e) {
    return null
  }
}

// Compare secrets without leaking timing
function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// 8 characters, uppercase letters and numbers (same look as the in-app codes)
function newCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const corsHeaders: Record<string, string> = ALLOWED_ORIGINS.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
      }
    : {}
  const out = (b: unknown, status = 200) => json(b, status, corsHeaders)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return out({ error: 'Use POST' }, 405)

  const secret = Deno.env.get('NOM_ADMIN_SECRET') ?? ''
  const viaSecret = sameSecret(req.headers.get('x-nom-admin-secret') ?? '', secret)
  const adminId = viaSecret ? null : await adminFromSession(req)
  if (!viaSecret && !adminId) {
    return out({ error: 'Not allowed' }, 401)
  }

  let email = ''
  let waitlistId = ''
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
    waitlistId = String(body?.waitlist_id ?? '')
  } catch (_e) { /* handled below */ }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out({ error: 'That doesn\'t look like an email address' }, 400)

  // Don't invite people who already have an account
  const existing = await fetchColumn('profiles', 'email')
  if (existing.some((e) => e.trim().toLowerCase() === email)) {
    return out({ error: `${email} already has a Nom account. No invite needed.` }, 409)
  }

  // Save the code (try a few times in the rare case of a duplicate)
  let code = ''
  let lastError = ''
  for (let attempt = 0; attempt < 3 && !code; attempt++) {
    const candidate = newCode()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/invites`, {
      method: 'POST',
      headers: {
        ...dbHeaders,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ code: candidate, source: 'admin', created_by: adminId || Deno.env.get('INVITE_CREATED_BY') || null }),
    })
    if (res.ok) code = candidate
    else lastError = `${res.status} ${await res.text()}`
  }
  if (!code) {
    console.error('Invite insert failed:', lastError)
    return out({ error: 'Could not create an invite code', detail: lastError }, 500)
  }

  const sent = await sendEmail(email, inviteEmail({ code }))
  if (!sent.ok) {
    return out({ error: 'Code made, but the email did not send. You can send the code by hand.', code, detail: sent.error }, 502)
  }

  // Mark them as invited on the waitlist (by row if the Admin page sent one, otherwise by email)
  const invitedAt = new Date().toISOString()
  const filter = /^[0-9a-f-]{36}$/i.test(waitlistId)
    ? `id=eq.${waitlistId}`
    : `email=eq.${encodeURIComponent(email)}`
  try {
    const w = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?${filter}`, {
      method: 'PATCH',
      headers: { ...db, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ invited_at: invitedAt }),
    })
    if (!w.ok) console.error('Waitlist update failed:', w.status, await w.text())
  } catch (e) {
    console.error('Waitlist update error:', e)
  }

  return out({ ok: true, email, code, invited_at: invitedAt })
})
