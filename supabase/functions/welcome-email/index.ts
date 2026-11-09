// Sends the welcome email to someone who just made a Nom account.
// Triggered by the Database Webhook on INSERT into public.profiles (payload.record.id is the new row).
// Deployed with verify_jwt = false (the new secret keys aren't JWTs). To stay safe without that check,
// the profile is re-read from the database by id, so a fake call can only ever email a real Nom member
// their own welcome email, never an address someone made up.
// The design and copy live in ../_shared/emails.ts.

import { fetchOne, readRecordId } from '../_shared/alerts.ts'
import { sendEmail, welcomeEmail } from '../_shared/emails.ts'

Deno.serve(async (req) => {
  try {
    const id = await readRecordId(req)
    const p = await fetchOne('profiles', 'id,full_name,email,created_at', id)
    if (!p?.email) return new Response('profile not found', { status: 404 })

    // Only welcome brand-new accounts (blocks replays for older members)
    const ageMs = Date.now() - new Date(p.created_at).getTime()
    if (!(ageMs < 60 * 60 * 1000)) return new Response('not a new account', { status: 200 })

    const result = await sendEmail(p.email, welcomeEmail({ name: p.full_name }))
    if (!result.ok) return new Response('Email failed', { status: 500 })
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Welcome email error:', err)
    return new Response('Error', { status: 500 })
  }
})
