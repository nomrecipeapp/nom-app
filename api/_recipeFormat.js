// Shared instructions for how the AI importers format a recipe, so URL, photo
// and TikTok/Instagram imports all come back the same way.
// The app treats a line ending in ":" (that isn't a numbered step) as a section header.

export const RECIPE_FORMAT_RULES = `Formatting rules:
- "ingredients": one ingredient per line. If the recipe groups ingredients into parts (for example "For the salad" and "For the dressing"), keep that grouping: put the part name on its own line ending with a colon, like "For the dressing:", followed by its ingredients. If there are no groups, do not add any.
- "instructions": one step per line, each step starting with its number ("1. ", "2. "). If the steps are grouped into parts, put the part name on its own line ending with a colon (not numbered), then restart numbering at 1 for that part. If there are no groups, do not add any.
- "prep_time": the prep (active preparation) time if the recipe states it, like "15 min" or "1 hr 10 min". Otherwise empty string.
- "cook_time": the TOTAL time from start to finish if the recipe states it (or prep plus cook time added together when both are given), like "45 min" or "1 hr 30 min". Otherwise empty string.
- Never use em dashes in any field.`

export const RECIPE_FIELDS = `{"title": "", "ingredients": "", "instructions": "", "prep_time": "", "cook_time": "", "difficulty": "Easy or Medium or Hard or empty string", "source_name": ""}`
