export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'No URL provided' })

  const isTikTok = url.includes('tiktok.com')
  const isInstagram = url.includes('instagram.com')

  try {
    let caption = ''
    let thumbnail_url = null
    let author = ''

    if (isTikTok) {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
      if (!oembedRes.ok) throw new Error('Could not fetch TikTok data')
      const data = await oembedRes.json()
      caption = data.title || ''
      thumbnail_url = data.thumbnail_url || null
      author = data.author_name || 'TikTok'
    } else if (isInstagram) {
      // Instagram oEmbed requires a token — fall back to og scrape
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      })
      const html = await pageRes.text()
      const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
      const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
      caption = descMatch?.[1] || ''
      thumbnail_url = imageMatch?.[1] || null
      author = 'Instagram'
    }

    if (!caption) {
      return res.status(200).json({
        error: 'no_content',
        message: 'Could not read the caption from this post. Try screenshotting it and using From Photo instead.'
      })
    }

    // Pass caption to Claude to extract recipe
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Extract a recipe from this social media post caption. Return JSON only, no markdown, no explanation.

Caption: ${caption}

Use these exact fields:
{
  "title": "recipe name only, no extra text",
  "ingredients": "one ingredient per line",
  "instructions": "numbered steps, one per line",
  "cook_time": "e.g. 30 min or empty string",
  "difficulty": "Easy or Medium or Hard or empty string",
  "source_name": "${author}"
}

If there is no recipe in this caption, return {"error": "no_recipe"}.
Only include what is actually in the caption — do not invent or add ingredients or steps.`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (parsed.error === 'no_recipe') {
      return res.status(200).json({
        error: 'no_recipe',
        message: 'No recipe found in this post caption. The recipe might only be spoken in the video — try screenshotting and using From Photo instead.'
      })
    }

    return res.status(200).json({ ...parsed, image_url: thumbnail_url })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}