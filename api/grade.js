export const config = { runtime: "edge" }
import { jsonResponse } from './_utils.js'

function normalize(s){ return String(s||'').trim().toLowerCase() }
function score(guess, reference){
  const g = normalize(guess), r = normalize(reference)
  if (!g || !r) return 0
  if (g === r) return 1
  // token overlap
  const gs = new Set(g.split(/\s+/)), rs = new Set(r.split(/\s+/))
  const inter = [...gs].filter(x => rs.has(x)).length
  return Math.max(0, Math.min(1, inter / Math.max(gs.size, rs.size)))
}

export default async (req) => {
  try{
    const body = await req.json()
    const s = score(body?.guess, body?.reference)
    const feedback = s === 1 ? 'Perfect' : s > 0.6 ? 'Close' : 'Keep practicing'
    return jsonResponse({ ok:true, score: s, feedback })
  }catch(e){
    return jsonResponse({ ok:false, error:String(e?.message||e) }, 500)
  }
}
