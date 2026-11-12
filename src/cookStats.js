// Verdict-first cook stats. There is no single "Cook Score" number anymore:
// comparing cookies to pasta doesn't mean much. Instead, recipes are ordered by
// their latest verdict, then how often they've been cooked, then how recently.

export const VERDICT_RANK = { would_make_again: 3, it_was_fine: 2, never_again: 1 }

export const COOK_STATS_FIELDS = 'recipe_id, verdict, cooked_at'

// 2 -> "2nd", 3 -> "3rd", 11 -> "11th", 22 -> "22nd"
export function ordinal(n) {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')
}

const time = c => (c?.cooked_at ? new Date(c.cooked_at).getTime() : 0)

// { [recipe_id]: { verdict, times, last, latest } } where verdict is from the most recent cook.
export function recipeStats(cooks) {
  const out = {}
  for (const cook of cooks || []) {
    if (!cook?.recipe_id) continue
    const s = out[cook.recipe_id] || (out[cook.recipe_id] = { verdict: null, times: 0, last: 0, latest: null })
    s.times += 1
    const t = time(cook)
    if (!s.latest || t >= s.last) { s.last = t; s.latest = cook; s.verdict = cook.verdict || null }
  }
  return out
}

// Favorites order: Would Make Again, then It Was Fine, then Never Again, then never cooked.
// Inside each: cooked more often first, then cooked more recently.
export function compareFavorites(a, b) {
  const ra = a ? VERDICT_RANK[a.verdict] || 0 : -1
  const rb = b ? VERDICT_RANK[b.verdict] || 0 : -1
  if (ra !== rb) return rb - ra
  if (!a || !b) return 0
  if (a.times !== b.times) return b.times - a.times
  return b.last - a.last
}

// How many times this person has cooked this recipe, up to and including this cook.
// `allCooks` are that recipe's cooks (any order, any people).
export function cookNumber(cook, allCooks) {
  const t = time(cook)
  return (allCooks || []).filter(c =>
    c.user_id === cook.user_id && c.recipe_id === cook.recipe_id && (time(c) < t || c.id === cook.id)
  ).length
}

// Loads someone's Go-tos with a light query over all their cooks (not just recent ones),
// then fetches only the recipes that made the list.
export async function fetchGoTos(supabase, userId, limit = 5) {
  const { data: cooks } = await supabase
    .from('cooks').select('id, user_id, recipe_id, verdict, cooked_at').eq('user_id', userId)
  if (!cooks || cooks.length === 0) return []
  const stats = recipeStats(cooks)
  const top = Object.values(stats)
    .filter(s => s.verdict === 'would_make_again')
    .sort(compareFavorites)
    .slice(0, limit)
  if (top.length === 0) return []
  const { data: recipes } = await supabase
    .from('recipes').select('*').in('id', top.map(s => s.latest.recipe_id))
  return top
    .map(s => ({ ...s.latest, times: s.times, recipes: recipes?.find(r => r.id === s.latest.recipe_id) || null }))
    .filter(c => c.recipes)
}
