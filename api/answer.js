export const config = { runtime: "edge" }
import { jsonResponse } from './_utils.js'

const HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const norm = (s) => String(s||'')
  .normalize('NFC')
  .replace(HARAKAT,'')
  .replace(/[\u061B\u061F\u060C]/g,' ') // ؛ ؟ ،
  .replace(/[\.\!\?\,\;:]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();

export default async (req) => {
  try{
    const body = await req.json();
    const guess = norm(body?.guess);
    const reference = norm(body?.reference);
    const correct = !!guess && !!reference && guess === reference;
    return jsonResponse({ ok:true, correct });
  }catch(e){
    return jsonResponse({ ok:false, error:String(e?.message||e) }, 500);
  }
}
