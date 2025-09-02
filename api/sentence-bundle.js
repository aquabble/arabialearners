// api/sentence-bundle.js
export const config = { runtime: 'edge' }
import OpenAI from 'openai'

function safe(v){ return String(v == null ? '' : v).trim() }

function lengthHintFromDifficulty(d){
  return d === 'short' ? 'Keep the Arabic sentence concise (≈5–7 words).'
       : d === 'long'  ? 'Use a longer Arabic sentence (≈13–20 words).'
       : 'Aim for a medium-length Arabic sentence (≈8–12 words).'
}

export default async function handler(req){
  const url = new URL(req.url)
  const debug = url.searchParams.get('debug') === '1'
  try{
    const key = (process.env && process.env.OPENAI_API_KEY) || ''
    if(!key){
      const payload = { error:'Missing OPENAI_API_KEY', where:'api/sentence-bundle' }
      return new Response(JSON.stringify(payload), { status: debug ? 200 : 503, headers:{'content-type':'application/json'} })
    }
    const client = new OpenAI({ apiKey: key })

    const body = await req.json().catch(()=>({}))
    const { unit='All', chapter='All', direction='ar2en', difficulty='medium', timeMode='none', timeText='', size=3 } = body || {}

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

    const userBase = `Unit: ${unit}\nChapter: ${chapter}\nDirection: ${direction}`
    const n = Math.max(1, Math.min(10, Number(size) || 3))
    const items = []

    for (let i=0; i<n; i++){
      const resp = await client.responses.create({
        model: 'gpt-4o-mini',
        input: [
          { role:'system', content: SYSTEM },
          { role:'user', content: userBase + `\n#${i+1}` }
        ],
        text: { format: "json" }
      })
      let data = {}
      try{ data = JSON.parse(resp.output_text || '{}') }catch{}
      items.push({ ar: safe(data.ar), en: safe(data.en), tokens: Array.isArray(data.tokens)?data.tokens:[] })
    }

    return new Response(JSON.stringify({ items }), { status: 200, headers:{'content-type':'application/json'} })
  }catch(e){
    const payload = { error: String(e?.message || e), where:'api/sentence-bundle' }
    return new Response(JSON.stringify(payload), { status: debug ? 200 : 500, headers:{'content-type':'application/json'} })
  }
}
