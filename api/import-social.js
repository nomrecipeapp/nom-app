export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'No URL provided' })

  try {
    // Fetch the page — TikTok and Instagram embed caption text in the HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })

    const html = await response.text()

    // Extract og:title and og:description which usually contain the caption
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
    const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

    const title = titleMatch?.[1] || ''
    const description = descMatch?.[1] || ''
    const image_url = imageMatch?.[1] || null

    if (!title && !description) {
      return res.status(200).json({ error: 'no_content', message: 'Could not read content from this link. The recipe may only be in the video — try screenshotting the caption and using From Photo instead.' })
    }

    // Pass to Claude to extract recipe
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

Title from post: ${title}
Caption/description: ${description}

Use these exact fields: {"title": "", "ingredients": "one per line", "instructions": "numbered steps one per line", "cook_time": "", "difficulty": "Easy or Medium or Hard or empty", "source_name": "TikTok" or "Instagram"}.

If there is no recipe content in this text, return {"error": "no_recipe"}.
If ingredients or instructions are missing, use empty string — do not invent content.`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (parsed.error === 'no_recipe') {
      return res.status(200).json({ error: 'no_recipe', message: 'No recipe found in this post. The recipe might only be in the video audio — try screenshotting the caption and using From Photo instead.' })
    }

    return res.status(200).json({ ...parsed, image_url })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}