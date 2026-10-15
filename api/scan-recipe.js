import { handleCors, requireUser } from './_auth.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await requireUser(req, res))) return

  const { images } = req.body || {}
  if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: true, message: 'No images provided' })

  const imageContent = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 }
  }))

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: 'Extract the recipe from these images. They may be multiple pages of the same recipe — combine them into one. Return JSON only, no markdown, no explanation. Use these exact fields: {"title": "", "ingredients": "one per line", "instructions": "numbered steps, one per line", "cook_time": "", "difficulty": "Easy or Medium or Hard or empty", "source_name": ""}. If a field is not visible, use empty string.'
            }
          ]
        }]
      })
    })

    const data = await response.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}