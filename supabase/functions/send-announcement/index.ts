// One-time launch announcement: "Nom is on the App Store" to everyone with an account.
// Only Syd can call it, from the Mac:
//   npm run announce -- count              how many people it would email (sends nothing)
//   npm run announce -- test you@email     sends one copy to that address only
//   npm run announce -- all 75             sends to everyone; the number must match "count"
// Carries NOM_ADMIN_SECRET. Deployed with verify_jwt = false because the secret is the lock.
// Uses Resend's batch API (up to 100 per call) with idempotency keys, so running "all"
// twice within 24 hours will not email anyone twice.

import { SERVICE_KEY, SUPABASE_URL } from '../_shared/alerts.ts'
import { announcementEmail, FROM, REPLY_TO, sendEmail } from '../_shared/emails.ts'

const CAMPAIGN = 'nom-launch-announcement-2026-11'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const db = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Reviewer and demo accounts (nom.recipeapp+anything@gmail.com) never get it
const isInternal = (email: string) => /^nom\.recipeapp\+/i.test(email)

type Person = { email: string; full_name: string | null }

async function recipients(): Promise<{ people: Person[]; skipped: string[] }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email,full_name&limit=10000`, { headers: db })
  if (!res.ok) throw new Error(`profiles read failed: ${res.status} ${await res.text()}`)
  const rows: Person[] = await res.json()
  const seen = new Set<string>()
  const people: Person[] = []
  const skipped: string[] = []
  for (const r of rows) {
    const email = String(r.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (seen.has(email)) continue
    seen.add(email)
    if (isInternal(email)) { skipped.push(email); continue }
    people.push({ email, full_name: r.full_name })
  }
  people.sort((a, b) => a.email.localeCompare(b.email)) // stable order keeps batches (and idempotency keys) the same
  return { people, skipped }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  if (!sameSecret(req.headers.get('x-nom-admin-secret') ?? '', Deno.env.get('NOM_ADMIN_SECRET') ?? '')) {
    return json({ error: 'Not allowed' }, 401)
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch (_e) { /* empty body */ }
  const mode = String(body.mode ?? '')

  let list: { people: Person[]; skipped: string[] }
  try {
    list = await recipients()
  } catch (e) {
    console.error(e)
    return json({ error: 'Could not read the user list', detail: String(e) }, 500)
  }

  if (mode === 'count') {
    return json({ ok: true, count: list.people.length, skipped: list.skipped })
  }

  if (mode === 'test') {
    const to = String(body.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: 'Add the email to send the test to' }, 400)
    const match = list.people.find((p) => p.email === to)
    const email = announcementEmail({ name: match?.full_name ?? '' })
    const sent = await sendEmail(to, { ...email, subject: `[Test] ${email.subject}` })
    if (!sent.ok) return json({ error: 'Test did not send', detail: sent.error }, 502)
    return json({ ok: true, sentTo: to, usedName: match?.full_name ?? null })
  }

  if (mode === 'all') {
    // Safety catch: the number typed must match the real count
    if (Number(body.confirm) !== list.people.length) {
      return json({ error: `Type the exact count to confirm. Right now it's ${list.people.length}.`, count: list.people.length }, 400)
    }
    const batches: Person[][] = []
    for (let i = 0; i < list.people.length; i += 100) batches.push(list.people.slice(i, i + 100))

    let sent = 0
    for (let b = 0; b < batches.length; b++) {
      const payload = batches[b].map((p) => {
        const e = announcementEmail({ name: p.full_name ?? '' })
        return { from: FROM, to: p.email, reply_to: REPLY_TO, subject: e.subject, html: e.html, text: e.text }
      })
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${CAMPAIGN}-batch-${b + 1}-of-${batches.length}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = `${res.status} ${await res.text()}`
        console.error('Batch failed:', detail)
        return json({ error: `Batch ${b + 1} of ${batches.length} did not send`, sentSoFar: sent, detail }, 502)
      }
      sent += payload.length
      if (b < batches.length - 1) await new Promise((r) => setTimeout(r, 1000))
    }
    return json({ ok: true, sent, skipped: list.skipped })
  }

  return json({ error: 'mode must be count, test or all' }, 400)
})
