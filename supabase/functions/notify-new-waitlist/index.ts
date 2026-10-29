// Emails nom.recipeapp@gmail.com whenever someone requests an invite (joins the waitlist).
// Triggered by a Database Webhook on INSERT into public.waitlist (deployed with verify_jwt = false;
// the request is re-read from the database so fake calls can't send email).

import { countsHtml, esc, fetchOne, getCounts, readRecordId, sendAlert, wrap } from '../_shared/alerts.ts'

Deno.serve(async (req) => {
  const id = await readRecordId(req)
  const w = await fetchOne('waitlist', 'id,email,source,created_at', id)
  if (!w) return new Response('waitlist request not found', { status: 404 })

  const counts = await getCounts()
  const where = w.source === 'web' ? 'the website' : w.source === 'app' ? 'the app' : w.source

  const html = wrap('New invite request', `
    <p><strong>${esc(w.email)}</strong> asked for an invite from ${esc(where)}.</p>
    ${countsHtml(counts)}
    <p style="font-size:13px;color:#8A8070">See everyone waiting in Supabase, Table Editor, <strong>waitlist</strong>.</p>`)

  const waiting = counts.waiting === null ? '' : ` (${counts.waiting} waiting)`
  return sendAlert(`Nom invite request: ${w.email}${waiting}`, html)
})
