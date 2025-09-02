// api/sentence.js
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
      stage = 'SVO',
      unit = 'All',
      chapter = 'All',
      direction = 'ar2en',
      difficulty = 'medium',
      timeMode = 'none',
      timeText = ''
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

    const userParts = []
    userParts.push(`Unit: ${unit}`)
    userParts.push(`Chapter: ${chapter}`)
    userParts.push(`Direction: ${direction}`)

    const prompt = userParts.join('\n')

    const resp = await openai.responses.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      input: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt }
      ]
    })

    const text = resp.output_text || '{}'
    let data
    try { data = JSON.parse(text) } catch { data = {} }

    const ar = String(data.ar || '').trim()
    const en = String(data.en || '').trim()
    const tokens = Array.isArray(data.tokens) ? data.tokens : []

    return new Response(JSON.stringify({ ar, en, tokens }), {
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
