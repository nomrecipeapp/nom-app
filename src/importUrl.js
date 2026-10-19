// Import a recipe from a website link. Used by Add Recipe and onboarding.
// Asks the AI importer and Spoonacular at the same time, trusts the AI first
// (Spoonacular sometimes grabs the wrong recipe on busy pages), and throws
// out anything that looks like an error page (sites like NYT block servers).
import { apiPost } from './api'

function formatMinutes(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  if (!h) return `${m} min`
  return m ? `${h} hr ${m} min` : `${h} hr`
}

const ERROR_TITLE = /page not found|not found|\b404\b|access denied|forbidden|are you a robot|just a moment|attention required|something went wrong|^error\b/i

function lineCount(text) {
  return (text || '').split('\n').filter(l => l.trim()).length
}

// A real recipe has a real title and at least a couple of ingredients
function usable(title, ingredients) {
  return !!title && !ERROR_TITLE.test(title) && lineCount(ingredients) >= 2
}

function isGenericImage(src) {
  return !!src && /defaultOg|default-og|placeholder|nytimes\.com\/assets/.test(src)
}

function siteName(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return 'this site' }
}

// Returns { recipe } on success, or { error } with a message to show the user
// `hint` is the suggestion added after "We couldn't read this recipe"
export async function importRecipeFromUrl(url, hint = 'Try a screenshot with From Photo instead.') {
  const aiPromise = apiPost('/api/extract-recipe-url', { url })
    .then(r => r.json())
    .then(d => (d && !d.error ? d : null))
    .catch(() => null)

  const spoonPromise = apiPost('/api/spoonacular-extract', { url })
    .then(async r => ({ status: r.status, data: await r.json() }))
    .catch(() => ({ status: 0, data: {} }))

  const [ai, spoonRes] = await Promise.all([aiPromise, spoonPromise])
  const data = spoonRes.data || {}

  if (spoonRes.status === 401) {
    return { error: data.message || 'Please sign in again to import recipes.' }
  }

  // Spoonacular's version
  const spoonIngredients = data.extendedIngredients
    ? data.extendedIngredients.map(i => i.original).join('\n')
    : ''
  const groups = (data.analyzedInstructions || []).filter(g => g.steps?.length)
  const spoonInstructions = groups.length
    ? groups.map(g => [
        ...(groups.length > 1 && g.name ? [`${g.name.trim().replace(/:$/, '')}:`] : []),
        ...g.steps.map((s, i) => `${i + 1}. ${s.step}`),
      ].join('\n')).join('\n')
    : data.instructions || ''

  const aiOk = !!ai && usable(ai.title, ai.ingredients)
  const spoonOk = data.code !== 402 && usable(data.title, spoonIngredients)

  if (!aiOk && !spoonOk) {
    if (data.code === 402) {
      return { error: 'Daily import limit reached. Try again tomorrow or add manually.' }
    }
    return { error: `We couldn't read this recipe from ${siteName(url)}. ${hint}` }
  }

  const title = aiOk ? ai.title : data.title
  const ingredients = aiOk ? ai.ingredients : spoonIngredients
  const instructions = (aiOk && ai.instructions) ? ai.instructions : (spoonOk ? spoonInstructions : '')

  let cookTime = aiOk ? (ai.cook_time || '') : ''
  let prepTime = aiOk ? (ai.prep_time || '') : ''
  if (spoonOk && !cookTime && data.readyInMinutes) cookTime = formatMinutes(data.readyInMinutes)
  if (spoonOk && !prepTime && data.preparationMinutes > 0) prepTime = formatMinutes(data.preparationMinutes)

  // Image: Spoonacular's if it found the same page, otherwise the page's share image
  let imageUrl = (spoonOk && data.image && !isGenericImage(data.image)) ? data.image : null
  if (!imageUrl) {
    try {
      const ogRes = await apiPost('/api/fetch-og-image', { url })
      const og = await ogRes.json()
      imageUrl = (og.image_url && !isGenericImage(og.image_url)) ? og.image_url : null
    } catch { /* no image is fine */ }
  }

  return {
    recipe: {
      title,
      source_url: url,
      source_name: (aiOk && ai.source_name) || (spoonOk && data.sourceName) || siteName(url),
      image_url: imageUrl,
      cook_time: cookTime,
      prep_time: prepTime,
      difficulty: (aiOk && ai.difficulty) || '',
      ingredients,
      instructions,
    }
  }
}
