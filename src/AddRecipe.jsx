import { useState } from 'react'
import { supabase } from './supabase'

export default function AddRecipe({ session, onSave, onCancel }) {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recipe, setRecipe] = useState(null)
  const [duplicate, setDuplicate] = useState(null)

  // Manual form fields
  const [title, setTitle] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [notes, setNotes] = useState('')

  async function importFromUrl() {
    if (!url) return
    setLoading(true)
    setError(null)
    setDuplicate(null)

    // Check for duplicate first
    const { data: existing } = await supabase
      .from('recipes')
      .select('id, title')
      .eq('user_id', session.user.id)
      .eq('source_url', url)
      .single()

    if (existing) {
      setDuplicate(existing)
      setLoading(false)
      return
    }

    try {
      // --- STEP 1: Try schema.org first (free) ---
      let recipeData = null

      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
        const proxyRes = await fetch(proxyUrl)
        const proxyData = await proxyRes.json()
        const html = proxyData.contents

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        // Find schema.org/Recipe JSON-LD
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
        for (const script of scripts) {
          try {
            const json = JSON.parse(script.textContent)
            const schema = json['@type'] === 'Recipe' ? json
              : Array.isArray(json['@graph']) ? json['@graph'].find(n => n['@type'] === 'Recipe')
              : null

            if (schema) {
              const ingredients = Array.isArray(schema.recipeIngredient)
                ? schema.recipeIngredient.join('\n')
                : ''

              const instructions = Array.isArray(schema.recipeInstructions)
                ? schema.recipeInstructions.map((s, i) => {
                    const text = typeof s === 'string' ? s : s.text || ''
                    return `${i + 1}. ${text}`
                  }).join('\n')
                : typeof schema.recipeInstructions === 'string'
                ? schema.recipeInstructions
                : ''

              const cookTime = schema.totalTime
                ? schema.totalTime.replace('PT', '').replace('H', 'h ').replace('M', ' min').trim()
                : schema.cookTime
                ? schema.cookTime.replace('PT', '').replace('H', 'h ').replace('M', ' min').trim()
                : ''

              const image = Array.isArray(schema.image)
                ? (typeof schema.image[0] === 'string' ? schema.image[0] : schema.image[0]?.url)
                : typeof schema.image === 'string'
                ? schema.image
                : schema.image?.url || null

              recipeData = {
                title: schema.name || '',
                source_url: url,
                source_name: new URL(url).hostname.replace('www.', ''),
                image_url: image,
                cook_time: cookTime,
                difficulty: '',
                ingredients,
                instructions,
                notes: ''
              }
              break
            }
          } catch {}
        }
      } catch {}

      // --- STEP 2: Fall back to Spoonacular if schema.org failed ---
      if (!recipeData || (!recipeData.ingredients && !recipeData.instructions)) {
        const apiKey = import.meta.env.VITE_SPOONACULAR_KEY
        const res = await fetch(`https://api.spoonacular.com/recipes/extract?url=${encodeURIComponent(url)}&apiKey=${apiKey}`)
        const data = await res.json()

        if (data.code === 402) {
          setError('Daily import limit reached. Try again tomorrow or add manually.')
          setLoading(false)
          return
        }

        const ingredients = data.extendedIngredients
          ? data.extendedIngredients.map(i => i.original).join('\n')
          : ''

        const instructions = data.analyzedInstructions?.[0]?.steps
          ? data.analyzedInstructions[0].steps.map((s, i) => `${i + 1}. ${s.step}`).join('\n')
          : data.instructions || ''

        recipeData = {
          title: data.title || '',
          source_url: url,
          source_name: data.sourceName || new URL(url).hostname.replace('www.', ''),
          image_url: data.image || null,
          cook_time: data.readyInMinutes ? `${data.readyInMinutes} min` : '',
          difficulty: '',
          ingredients,
          instructions,
          notes: ''
        }
      }

      setRecipe(recipeData)

    } catch (e) {
      setError('Could not fetch recipe. Try adding it manually.')
    }

    setLoading(false)
  }
}