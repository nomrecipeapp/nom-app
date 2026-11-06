// Emails nom.recipeapp@gmail.com when AI spending crosses 75% or 100% of the monthly budget.
// Triggered by a Database Webhook on INSERT into public.budget_alerts. The database adds a row
// at most once per level per month (see check_budget in supabase/sql/2026-11-06-admin-page.sql),
// and at 100% it has already paused friend invites by the time this runs.
// Deployed with verify_jwt = false; the alert is re-read from the database so fake calls can't send email.

import { ALERT_TO, fetchOne, getCounts, readRecordId } from '../_shared/alerts.ts'
import { budgetAlertEmail, sendEmail } from '../_shared/emails.ts'

Deno.serve(async (req) => {
  const id = await readRecordId(req)
  const a = await fetchOne('budget_alerts', 'id,level,spent,budget', id)
  if (!a) return new Response('budget alert not found', { status: 404 })

  const counts = await getCounts()
  const email = budgetAlertEmail({
    spent: Number(a.spent),
    budget: Number(a.budget),
    level: Number(a.level) === 100 ? 100 : 75,
    users: counts.users,
    waiting: counts.waiting,
  })
  const sent = await sendEmail(ALERT_TO, email)
  if (!sent.ok) return new Response('email failed', { status: 500 })
  return new Response('ok', { status: 200 })
})
