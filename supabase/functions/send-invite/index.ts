// Makes a fresh one-time invite code and emails it to someone (usually from the waitlist).
// Only Syd can call it: the request must carry NOM_ADMIN_SECRET (a Supabase secret).
// Run it from the Mac with:  npm run invite -- friend@example.com
// Deployed with verify_jwt = false because the admin secret is the lock.

import { fetchColumn, SERVICE_KEY, SUPABASE_URL } from '../_shared/alerts.ts'
import { inviteEmail, sendEmail } from '../_shared/emails.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

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
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const secret = Deno.env.get('NOM_ADMIN_SECRET') ?? ''
  if (!sameSecret(req.headers.get('x-nom-admin-secret') ?? '', secret)) {
    return json({ error: 'Not allowed' }, 401)
  }

  let email = ''
  try {
    email = String((await req.json())?.email ?? '').trim().toLowerCase()
  } catch (_e) { /* handled below */ }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'That doesn\'t look like an email address' }, 400)

  // Don't invite people who already have an account
  const existing = await fetchColumn('profiles', 'email')
  if (existing.some((e) => e.trim().toLowerCase() === email)) {
    return json({ error: `${email} already has a Nom account. No invite needed.` }, 409)
  }

  // Save the code (try a few times in the rare case of a duplicate)
  let code = ''
  let lastError = ''
  for (let attempt = 0; attempt < 3 && !code; attempt++) {
    const candidate = newCode()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/invites`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ code: candidate, created_by: Deno.env.get('INVITE_CREATED_BY') || null }),
    })
    if (res.ok) code = candidate
    else lastError = `${res.status} ${await res.text()}`
  }
  if (!code) {
    console.error('Invite insert failed:', lastError)
    return json({ error: 'Could not create an invite code', detail: lastError }, 500)
  }

  const sent = await sendEmail(email, inviteEmail({ code }))
  if (!sent.ok) {
    return json({ error: 'Code made, but the email did not send. You can send the code by hand.', code, detail: sent.error }, 502)
  }
  return json({ ok: true, email, code })
})
