// Send the one-time "Nom is on the App Store" email from the terminal.
// Usage (from ~/nom-app):
//   npm run announce -- count              how many people it would email (sends nothing)
//   npm run announce -- test you@email     one copy to that address only
//   npm run announce -- all 75             everyone; the number must match "count"
// Needs NOM_ADMIN_SECRET and VITE_SUPABASE_URL in .env.local (never commit that file).

const [mode, arg] = process.argv.slice(2)
const secret = process.env.NOM_ADMIN_SECRET
const base = process.env.VITE_SUPABASE_URL

if (!['count', 'test', 'all'].includes(mode)) {
  console.log('Use one of:\n  npm run announce -- count\n  npm run announce -- test you@email.com\n  npm run announce -- all 75')
  process.exit(1)
}
if (!secret || !base) {
  console.log('Missing NOM_ADMIN_SECRET or VITE_SUPABASE_URL in .env.local')
  process.exit(1)
}

const body = { mode }
if (mode === 'test') body.email = arg
if (mode === 'all') body.confirm = Number(arg)

const res = await fetch(`${base}/functions/v1/send-announcement`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-nom-admin-secret': secret },
  body: JSON.stringify(body),
})
const out = await res.json().catch(() => ({}))

if (!res.ok) {
  console.log(`Didn't send: ${out.error || res.status}`)
  if (out.sentSoFar) console.log(`Sent before it stopped: ${out.sentSoFar}`)
  if (out.detail) console.log(`Details: ${out.detail}`)
  process.exit(1)
}
if (mode === 'count') {
  console.log(`This would email ${out.count} people.`)
  if (out.skipped?.length) console.log(`Skipping (demo/reviewer): ${out.skipped.join(', ')}`)
  console.log(`To send for real:  npm run announce -- all ${out.count}`)
} else if (mode === 'test') {
  console.log(`Test sent to ${out.sentTo}${out.usedName ? ` (greeting uses "${out.usedName}")` : ' (greeting says "Hi there!")'}`)
} else {
  console.log(`Done! Sent to ${out.sent} people.`)
}
