import { handleCors, requireUser } from './_auth.js'

// Server-side Spoonacular recipe extraction, so the API key never ships to browsers.
// Returns Spoonacular's JSON unchanged (including { code: 402 } when the daily limit is hit).
export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await requireUser(req, res))) return

  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: true, message: 'URL required' })

  const apiKey = process.env.SPOONACULAR_KEY || process.env.VITE_SPOONACULAR_KEY
  if (!apiKey) return res.status(500).json({ error: true, message: 'Server is not configured.' })

  try {
    const r = await fetch(`https://api.spoonacular.com/recipes/extract?url=${encodeURIComponent(url)}&apiKey=${apiKey}`)
    const data = await r.json()
    return res.status(200).json(data)
  } catch (e) {
    console.error('Spoonacular failed:', e)
    return res.status(502).json({ error: true, message: 'Could not reach the recipe service.' })
  }
}
