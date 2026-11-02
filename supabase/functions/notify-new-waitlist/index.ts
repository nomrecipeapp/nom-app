// Emails nom.recipeapp@gmail.com whenever someone requests an invite (joins the waitlist).
// Triggered by a Database Webhook on INSERT into public.waitlist (deployed with verify_jwt = false;
// the request is re-read from the database so fake calls can't send email).

import { countsHtml, esc, fetchColumn, fetchOne, getCounts, readRecordId, sendAlert, wrap } from '../_shared/alerts.ts'

Deno.serve(async (req) => {
  const id = await readRecordId(req)
  const w = await fetchOne('waitlist', 'id,email,source,created_at', id)
  if (!w) return new Response('waitlist request not found', { status: 404 })

  const counts = await getCounts()
  // Flag requests from emails that already have an account (only shown to us, never in the app)
  let hasAccount = false
  try {
    const emails = await fetchColumn('profiles', 'email')
    const mine = String(w.email).trim().toLowerCase()
    hasAccount = emails.some((e) => e.trim().toLowerCase() === mine)
  } catch (_e) { /* still send the alert */ }
  const where = w.source === 'web' ? 'the website' : w.source === 'app' ? 'the app' : w.source

  const html = wrap('New invite request', `
    <p><strong>${esc(w.email)}</strong> asked for an invite from ${esc(where)}.</p>
    ${hasAccount ? '<p style="background:#FAF6EF;border:1px solid #D9C9B0;border-radius:12px;padding:12px 16px">This email <strong>already has a Nom account</strong>. No invite needed; they probably meant to log in.</p>' : ''}
    ${countsHtml(counts)}
    <p style="font-size:13px;color:#8A8070">See everyone waiting in Supabase, Table Editor, <strong>waitlist</strong>.</p>`)

  const waiting = counts.waiting === null ? '' : ` (${counts.waiting} waiting)`
  const flag = hasAccount ? ' (already has an account)' : ''
  return sendAlert(`Nom invite request: ${w.email}${flag}${waiting}`, html)
})
