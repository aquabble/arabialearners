// api/sentence-bundle.js
export const config = { runtime: 'edge' }

import { json, getOpenAI, safeText } from './_utils.js'

function lengthHintFromDifficulty(difficulty){
  switch(difficulty){
    case 'short': return 'Keep the Arabic sentence concise (≈5–7 words).'
    case 'long': return 'Use a longer Arabic sentence (≈13–20 words).'
    default: return 'Aim for a medium-length Arabic sentence (≈8–12 words).'
  }
}

export default async function handler(req){
  try{
    const body = await req.json().catch(()=>({}))
    const {
      unit = 'All',
      chapter = 'All',
      direction = 'ar2en',
      difficulty = 'medium',
      timeMode = 'none',
      timeText = '',
      size = 3
    } = body || {}

    const { client, error } = getOpenAI()
    if (error) return json({ error, hint: 'Set OPENAI_API_KEY in your Vercel project settings.' }, 503)

    const lengthHint = lengthHintFromDifficulty(difficulty)
    const tText = safeText(timeText)
    const timeHint = (timeMode === 'custom' && tText)
      ? `Include the specific time expression: "${tText}".`
      : (timeMode === 'none'
          ? 'Do not include any explicit time expression.'
          : 'Optionally include a natural time expression.'
        )

    const SYSTEM = `You are a helpful Arabic tutoring assistant.
Generate an Arabic sentence and its English translation. ${lengthHint} ${timeHint}
Constrain content to the requested unit/chapter if provided.

Return strict JSON: { "ar": "...", "en": "...", "tokens": ["..."] }
- tokens: list of key Arabic words used (strings).
Avoid diacritics unless essential.`

    const userBase = `Unit: ${unit}\nChapter: ${chapter}\nDirection: ${direction}`

    const n = Math.max(1, Math.min(10, Number(size) || 3))
    const items = []
    for (let i=0; i<n; i++){
      const resp = await client.responses.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        input: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userBase + `\n#${i+1}` }
        ]
      })
      let data = {}
      try { data = JSON.parse(resp.output_text || '{}') } catch {}
      items.push({
        ar: safeText(data.ar),
        en: safeText(data.en),
        tokens: Array.isArray(data.tokens) ? data.tokens : []
      })
    }

    return json({ items })
  }catch(e){
    return json({ error: String(e && e.message || e) }, 500)
  }
}
