// Shared helpers for the api/ routes. Files starting with "_" are not deployed as routes by Vercel.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// CORS: let the iOS app (capacitor://localhost) call these endpoints.
// Returns true if this was the browser's pre-check (OPTIONS) and the request is finished.
export function handleCors(req, res) {
  const allowedOrigins = ['capacitor://localhost', 'http://localhost']
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

// Only signed-in Nom users may use the paid import services (Anthropic, Spoonacular).
// Checks the Supabase session token sent as "Authorization: Bearer <token>".
// Returns the user, or sends a 401 and returns null.
export async function requireUser(req, res) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: true, message: 'Please sign in to import recipes.' })
    return null
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase env vars missing on the server')
    res.status(500).json({ error: true, message: 'Server is not configured.' })
    return null
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      res.status(401).json({ error: true, message: 'Your session expired. Please sign in again.' })
      return null
    }
    const user = await r.json()
    if (!user?.id) {
      res.status(401).json({ error: true, message: 'Please sign in to import recipes.' })
      return null
    }
    return user
  } catch (e) {
    console.error('Auth check failed:', e)
    res.status(500).json({ error: true, message: 'Could not check your sign-in. Please try again.' })
    return null
  }
}

// Fallback text for older app builds. Newer builds write their own message from limit.cap and limit.reset_at.
export const IMPORT_LIMIT_MESSAGE = "You've used today's imports. To help keep Nom free while we grow, imports are limited each day. You can add this recipe manually, or import it again tomorrow."

// Daily import cap (set in the claim_import function in Supabase).
// Call right before using the AI. Returns true if the import may go ahead,
// or sends a 429 with { limitReached: true } and returns false.
// If the check itself fails (Supabase hiccup), the import goes ahead and the
// Anthropic Console spend limit stays the backstop.
export async function claimImport(req, res, kind) {
  const token = (req.headers.authorization || '').slice(7)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_import`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_kind: kind }),
    })
    if (!r.ok) {
      console.error('claim_import failed', r.status, await r.text())
      return true
    }
    const result = await r.json()
    if (result?.allowed === false) {
      console.log('import limit reached', JSON.stringify({ kind, used: result.used, cap: result.cap }))
      res.status(429).json({
        error: true,
        limitReached: true,
        message: IMPORT_LIMIT_MESSAGE,
        limit: { cap: result.cap, first_week: result.first_week, reset_at: result.reset_at },
      })
      return false
    }
    return true
  } catch (e) {
    console.error('claim_import error:', e.message)
    return true
  }
}
