// Most recipe sites hide a clean, machine-readable copy of the recipe in the page
// (schema.org "Recipe" inside <script type="application/ld+json">). Finding it means
// the AI reads just the recipe instead of a wall of menus and ads.
// Files starting with "_" are not deployed as routes by Vercel.

function isRecipe(node) {
  const t = node && node['@type']
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))
}

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n)
      if (r) return r
    }
    return null
  }
  if (isRecipe(node)) return node
  if (node['@graph']) return findRecipe(node['@graph'])
  if (node.mainEntity) return findRecipe(node.mainEntity)
  return null
}

// Returns a trimmed recipe object, or null if the page has none
export function extractJsonLdRecipe(html) {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
    let parsed
    try { parsed = JSON.parse(json) } catch { continue }
    const r = findRecipe(parsed)
    if (r && (r.recipeIngredient || r.ingredients)) {
      return {
        name: r.name,
        description: r.description,
        author: r.author,
        recipeYield: r.recipeYield,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        totalTime: r.totalTime,
        recipeIngredient: r.recipeIngredient || r.ingredients,
        recipeInstructions: r.recipeInstructions,
      }
    }
  }
  return null
}

// The page's <title>, for the server logs
export function pageTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 120) : ''
}
