export const config = { runtime: "edge" }
import { jsonResponse } from './_utils.js'
export default async (req) => {
  try{
    const body = await req.json()
    const correct = Array.isArray(body?.target) && Array.isArray(body?.order) &&
      body.target.length === body.order.length &&
      body.target.every((x,i)=> x===body.order[i])
    return jsonResponse({ ok:true, correct })
  }catch(e){
    return jsonResponse({ ok:false, error:String(e?.message||e) }, 500)
  }
}
