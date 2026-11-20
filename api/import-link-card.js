// Bulk link import, the free path: read the site's built-in recipe card and
// turn it into a recipe in code, with no AI. Counts toward the daily link
// limit like any other link import, but costs nothing.
//
// Answers with one of:
//   { recipe, source_steps }   the card was good, here's the recipe
//   { needsAi: true }          no usable card (or a TikTok/Instagram link): use the normal AI import
//   { blocked: true }          the site turned our server away (NYT, Food Network)
//   429 { limitReached }       today's links are used up
import { handleCors, requireUser, claimImport } from './_auth.js'
import { findJsonLdRecipeNode, countSourceSteps, pageTitle } from './_jsonLd.js'
import { recipeFromCard, siteNameFromHtml } from './_recipeCard.js'

const SOCIAL = /(^|\.)(tiktok\.com|instagram\.com)$/i

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await requireUser(req, res))) return

  const { url } = req.body || {}
  let host
  try { host = new URL(url).hostname } catch { return res.status(400).json({ error: true, message: 'Not a link' }) }
  if (SOCIAL.test(host)) return res.status(200).json({ needsAi: true })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const pageRes = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    const html = await pageRes.text()
    clearTimeout(timer)

    const node = findJsonLdRecipeNode(html)
    const recipe = recipeFromCard(node, url, siteNameFromHtml(html))
    console.log('import-link-card', JSON.stringify({ host, status: pageRes.status, foundCard: !!node, usedCard: !!recipe }))

    if (!recipe) {
      const blocked = [401, 403, 429].includes(pageRes.status) || /access denied|are you a robot|just a moment/i.test(pageTitle(html))
      return res.status(200).json(blocked ? { blocked: true } : { needsAi: true })
    }

    const claim = await claimImport(req, res, 'card')
    if (!claim) return
    return res.status(200).json({ recipe, source_steps: countSourceSteps(node.recipeInstructions) })
  } catch (e) {
    console.error('import-link-card failed', url, e.message)
    // Couldn't read the page (timeout, bad link): let the normal importer have a go
    return res.status(200).json({ needsAi: true })
  }
}
