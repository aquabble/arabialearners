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
  try {
    const body = await req.json();
    const guess = norm(body?.guess);
    const reference = norm(body?.reference);
    if (!guess || !reference) return jsonResponse({ ok:true, score: 0 });

    if (guess === reference) return jsonResponse({ ok:true, score: 1 });

    const gs = new Set(guess.split(/\s+/));
    const rs = new Set(reference.split(/\s+/));
    const inter = [...gs].filter(x => rs.has(x)).length;
    const score = Math.max(0, Math.min(1, inter / Math.max(gs.size, rs.size)));
    return jsonResponse({ ok:true, score });
  } catch (e) {
    return jsonResponse({ ok:false, error:String(e?.message||e) }, 500);
  }
}
