// Spots imports that probably came in with missing steps, so Review & Save can
// say "This recipe might be missing some steps" and point to the original.
// Pure functions, no network: cheap to rerun every time the user edits.

// A section header is a line ending in ":" that isn't a numbered step (see _recipeFormat.js)
function isHeader(line) {
  return /:$/.test(line) && !/^\d+[.)]\s/.test(line)
}

function realLines(text) {
  return (text || '').split('\n').map(l => l.trim()).filter(l => l && !isHeader(l))
}

export function countSteps(instructions) {
  return realLines(instructions).length
}

export function countIngredients(ingredients) {
  return realLines(ingredients).length
}

// Last step stops mid-thought: "...", "…", "see more", or a dangling comma/"and"
const CUT_OFF_END = /(\.\.\.|…|\bsee more|\bread more|,|\band|\bthen|\bthe|\bwith|\bto)$/i

// Returns a short reason string if the recipe looks incomplete, or null.
// `hints` come from the importer:
//   sourceSteps: how many steps the page's own recipe data lists (URL imports)
//   sourceIncomplete: the AI said the source itself looked cut off
export function missingStepsReason(recipe, hints = {}) {
  if (!recipe) return null
  const steps = countSteps(recipe.instructions)
  const ingredients = countIngredients(recipe.ingredients)
  const stepText = realLines(recipe.instructions).join(' ')

  if (ingredients >= 3 && steps === 0) return 'no_steps'
  if (hints.sourceSteps && steps < hints.sourceSteps - 1) return 'fewer_than_source'
  if (hints.sourceIncomplete && steps > 0) return 'source_cut_off'
  // Lots of ingredients but only a line or two of short directions
  if (ingredients >= 6 && steps <= 2 && stepText.length < 300) return 'too_few_steps'
  const last = realLines(recipe.instructions).pop() || ''
  if (last && CUT_OFF_END.test(last)) return 'cut_off'
  return null
}
