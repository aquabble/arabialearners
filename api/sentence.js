// api/sentence.js
export const config = { runtime: 'edge' }
import OpenAI from 'openai'
import { ok, svc, oops, safe, env } from './_utils.js'

function lengthHintFromDifficulty(d){
  return d === 'short' ? 'Keep the Arabic sentence concise (≈5–7 words).'
       : d === 'long'  ? 'Use a longer Arabic sentence (≈13–20 words).'
       : 'Aim for a medium-length Arabic sentence (≈8–12 words).'
}

export default async function handler(req){
  try{
    const key = env('OPENAI_API_KEY')
    if(!key) return svc({ error:'Missing OPENAI_API_KEY', hint:'Add it in Vercel → Settings → Environment Variables' })
    const client = new OpenAI({ apiKey: key })

    const body = await req.json().catch(()=>({}))
    const { unit='All', chapter='All', direction='ar2en', difficulty='medium', timeMode='none', timeText='' } = body || {}

    const lengthHint = lengthHintFromDifficulty(difficulty)
    const t = safe(timeText)
    const timeHint = (timeMode === 'custom' && t) ? `Include the specific time expression: "${t}".`
                    : (timeMode === 'none' ? 'Do not include any explicit time expression.' : 'Optionally include a natural time expression.')

    const SYSTEM = `You are a helpful Arabic tutoring assistant.
Generate an Arabic sentence and its English translation. ${lengthHint} ${timeHint}
Constrain content to the requested unit/chapter if provided.

Return strict JSON: { "ar": "...", "en": "...", "tokens": ["..."] }
- tokens: list of key Arabic words used (strings).
Avoid diacritics unless essential.`

    const resp = await client.responses.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      input: [
        { role:'system', content: SYSTEM },
        { role:'user', content: `Unit: ${unit}\nChapter: ${chapter}\nDirection: ${direction}` }
      ]
    })

    let data = {}
    try{ data = JSON.parse(resp.output_text || '{}') }catch{}

    return ok({
      ar: safe(data.ar),
      en: safe(data.en),
      tokens: Array.isArray(data.tokens) ? data.tokens : []
    })
  }catch(e){
    // Surface SDK/Edge errors to help debugging
    return oops({ error: String(e?.message || e), where:'api/sentence' })
  }
}
