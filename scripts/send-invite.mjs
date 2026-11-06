// Send someone a Nom invite from the terminal.
// Usage (from ~/nom-app):  npm run invite -- friend@example.com
// Needs NOM_ADMIN_SECRET and VITE_SUPABASE_URL in .env.local (never commit that file).

const email = process.argv[2]
const secret = process.env.NOM_ADMIN_SECRET
const base = process.env.VITE_SUPABASE_URL

if (!email) {
  console.log('Add the email after the command, like:  npm run invite -- friend@example.com')
  process.exit(1)
}
if (!secret || !base) {
  console.log('Missing NOM_ADMIN_SECRET or VITE_SUPABASE_URL in .env.local')
  process.exit(1)
}

const res = await fetch(`${base}/functions/v1/send-invite`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-nom-admin-secret': secret },
  body: JSON.stringify({ email }),
})
const out = await res.json().catch(() => ({}))

if (res.ok) {
  console.log(`Invite sent to ${out.email} with code ${out.code}`)
} else {
  console.log(`Didn't send: ${out.error || res.status}`)
  if (out.code) console.log(`The code is ${out.code} if you want to send it yourself.`)
  if (out.detail) console.log(`Details: ${out.detail}`)
  process.exit(1)
}
