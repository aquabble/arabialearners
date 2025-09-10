export const config = { runtime: "edge" }
import { jsonResponse } from './_utils.js'
export default async (req) => {
  try{
    const body = await req.json()
    const correct = String(body?.guess||'').trim() === String(body?.reference||'').trim()
    return jsonResponse({ ok:true, correct })
  }catch(e){
    return jsonResponse({ ok:false, error:String(e?.message||e) }, 500)
  }
}
