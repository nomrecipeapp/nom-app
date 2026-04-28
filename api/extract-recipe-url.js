export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    let text = ''

    // Substack: use their API to get full post content without needing JS rendering
    const substackMatch = url.match(/https?:\/\/([^/]+)\/p\/([^/?]+)/)
    if (substackMatch && url.includes('substack.com')) {
      const subdomain = substackMatch[1]
      const slug = substackMatch[2]
      const apiUrl = `https://${subdomain}/api/v1/posts/${slug}`
      const apiRes = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json' }
      })
      const apiData = await apiRes.json()
      const bodyHtml = apiData.body_html || apiData.truncated_body_text || ''
      text = bodyHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000)
    } else {
      // Generic fetch for all other URLs
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      })
      const html = await pageRes.text()
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000)
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
          content: `Extract the recipe from this webpage content. Return JSON only, no markdown, no explanation. Use these exact fields: {"title": "", "ingredients": "one per line", "instructions": "numbered steps, one per line", "cook_time": "", "difficulty": "Easy or Medium or Hard or empty", "source_name": ""}. If a field is not found, use empty string. If there is no recipe on this page, return {"error": "no recipe found"}.

Page content:
${text}`
        }]
      })
    })

    const data = await response.json()
    const raw = data.content?.[0]?.text || ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (parsed.error) {
      return res.status(200).json({ error: true, message: parsed.error })
    }

    res.status(200).json(parsed)
  } catch (e) {
    res.status(500).json({ error: true, message: e.message })
  }
}