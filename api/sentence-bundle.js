// api/sentence-bundle.js
export const config = { runtime: 'edge' }

import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function lengthHintFromDifficulty(difficulty){
  switch(difficulty){
    case 'short': return 'Keep the Arabic sentence concise (≈5–7 words).'
    case 'long': return 'Use a longer Arabic sentence (≈13–20 words).'
    default: return 'Aim for a medium-length Arabic sentence (≈8–12 words).'
  }
}

export default async function handler(req){
  try{
    const body = await req.json()
    const {
      unit = 'All',
      chapter = 'All',
      direction = 'ar2en',
      difficulty = 'medium',
      timeMode = 'none',
      timeText = '',
      size = 3
    } = body || {}

    const lengthHint = lengthHintFromDifficulty(difficulty)
    const timeHint = (timeMode === 'custom' && (timeText||'').trim())
      ? `Include the specific time expression: "${(timeText||'').trim()}".`
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

    const tasks = Array.from({length: Math.max(1, Math.min(10, Number(size)||3))}, (_, i) => ({
      role: 'user', content: userBase + `\n#${i+1}`
    }))

    // Batch create with one multi-turn call where possible; fall back to N calls if needed
    const items = []
    for (let i = 0; i < tasks.length; i++) {
      const resp = await openai.responses.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        input: [
          { role: 'system', content: SYSTEM },
          tasks[i]
        ]
      })
      const text = resp.output_text || '{}'
      let data
      try { data = JSON.parse(text) } catch { data = {} }
      items.push({
        ar: String(data.ar || '').trim(),
        en: String(data.en || '').trim(),
        tokens: Array.isArray(data.tokens) ? data.tokens : []
      })
    }

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }catch(e){
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}
