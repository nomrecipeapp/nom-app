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

// How many steps the page's recipe data lists (HowToStep, HowToSection or plain
// strings). Returns 0 when we can't tell, so callers can skip the comparison.
export function countSourceSteps(instructions) {
  if (!instructions) return 0
  if (typeof instructions === 'string') {
    const lines = instructions.split(/\n+/).map(l => l.trim()).filter(Boolean)
    return lines.length > 1 ? lines.length : 0
  }
  if (Array.isArray(instructions)) {
    return instructions.reduce((n, item) => {
      if (typeof item === 'string') return n + (item.trim() ? 1 : 0)
      if (item && item.itemListElement) return n + countSourceSteps([].concat(item.itemListElement))
      if (item && (item.text || item.name)) return n + 1
      return n
    }, 0)
  }
  if (instructions.itemListElement) return countSourceSteps([].concat(instructions.itemListElement))
  return 0
}

// Recipe plugins most food blogs use. On long pages the card can sit past our
// text cap, so we start reading from the card when we can find one.
const RECIPE_CARD = /<[^>]+class=["'][^"']*(wprm-recipe-container|tasty-recipes|mv-create-card|recipe-card|easyrecipe|zlrecipe)/i

export function recipeCardStart(html) {
  const m = html.match(RECIPE_CARD)
  return m ? m.index : -1
}

// The page's <title>, for the server logs
export function pageTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 120) : ''
}
