import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const payload = await req.json()
  const record = payload.record

  const name = record.full_name || record.username || 'Someone'
  const username = record.username ? `@${record.username}` : 'no username yet'
  const email = record.email || 'no email'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nom <onboarding@resend.dev>',
      to: 'nom.recipeapp@gmail.com',
      subject: `New Nom signup 🎉`,
      html: `<p><strong>${name}</strong> (${username}) just joined Nom.</p><p>Email: ${email}</p>`
    })
  })

  return new Response('ok', { status: 200 })
})