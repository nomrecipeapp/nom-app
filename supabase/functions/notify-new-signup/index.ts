// Emails nom.recipeapp@gmail.com whenever someone creates a Nom account.
// Triggered by a Database Webhook on INSERT into public.profiles (deployed with verify_jwt = false;
// the profile is re-read from the database so fake calls can't send email).

import { countsHtml, esc, fetchOne, getCounts, readRecordId, sendAlert, wrap } from '../_shared/alerts.ts'

Deno.serve(async (req) => {
  // Only trust profiles that really exist (the webhook just tells us which one)
  const id = await readRecordId(req)
  const p = await fetchOne('profiles', 'id,full_name,username,email,created_at', id)
  if (!p) return new Response('profile not found', { status: 404 })

  const counts = await getCounts()
  const name = p.full_name || p.username || 'Someone'
  const handle = p.username ? ` (@${esc(p.username)})` : ''

  const html = wrap('New Nom sign-up', `
    <p><strong>${esc(name)}</strong>${handle} just joined Nom.<br>
    <span style="color:#8A8070">${esc(p.email || 'no email on file')}</span></p>
    ${countsHtml(counts)}`)

  const total = counts.users === null ? '' : ` (#${counts.users})`
  return sendAlert(`New Nom sign-up: ${name}${total}`, html)
})
