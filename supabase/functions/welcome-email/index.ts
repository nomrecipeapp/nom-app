// Sends the welcome email to someone who just made a Nom account.
// Triggered by the existing webhook on new profiles (payload.record is the new row).
// The design and copy live in ../_shared/emails.ts.

import { sendEmail, welcomeEmail } from '../_shared/emails.ts'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const user = payload?.record
    const email = user?.email
    if (!email) return new Response('No email', { status: 400 })

    const result = await sendEmail(email, welcomeEmail({ name: user.full_name }))
    if (!result.ok) return new Response('Email failed', { status: 500 })
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Welcome email error:', err)
    return new Response('Error', { status: 500 })
  }
})
