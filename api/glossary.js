export const config = { runtime: "nodejs" };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try { require("./Glossary.json"); } catch {}

const lib = require("./_lib.cjs");
const { loadGlossary, getSemestersList, normalizeGlossaryForUI } = lib;

function hasParam(urlStr, name){
  const u = String(urlStr || "");
  return u.includes(name + "=1") || u.includes(name + "=true");
}

export default (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const { data, source } = loadGlossary();
    if (!data) return res.status(200).json({ ok:true, source:null, semesters: [] });
    const full = hasParam(req.url, "full");
    if (full) {
      const sems = (typeof getSemestersList === "function") ? (getSemestersList(data) || []) : [];
      return res.status(200).json({ ok:true, source, semesters: sems });
    }
    const payload = (typeof normalizeGlossaryForUI === "function")
      ? normalizeGlossaryForUI(data)
      : { semesters: (getSemestersList(data) || []).map(s => ({ id:s?.id, name:s?.name, units:(s?.units||[]).map(u => ({ id:u?.id, name:u?.name, chapters:(u?.chapters||[]).map(c => ({ id:c?.id, name:c?.name })) })) })) };
    return res.status(200).json({ ok:true, source, ...payload });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
}
