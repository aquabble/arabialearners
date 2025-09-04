export const config = { runtime: "nodejs" };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Ensure Glossary.json is bundled with the function
try { require("./Glossary.json"); } catch {}

const lib = require("./_lib.cjs");
const loadGlossary = lib.loadGlossary;
const getSemestersList = lib.getSemestersList;
const normalizeGlossaryForUI = lib.normalizeGlossaryForUI;

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

    let payload;
    if (typeof normalizeGlossaryForUI === "function") {
      payload = normalizeGlossaryForUI(data);
    } else {
      // Fallback skeleton
      const sems = (typeof getSemestersList === "function") ? (getSemestersList(data) || []) : [];
      payload = {
        semesters: (sems || []).map(s => ({
          id: s && s.id, name: s && s.name,
          units: Array.isArray(s && s.units) ? s.units.map(u => ({
            id: u && u.id, name: u && u.name,
            chapters: Array.isArray(u && u.chapters) ? u.chapters.map(c => ({ id: c && c.id, name: c && c.name })) : []
          })) : []
        }))
      };
    }

    return res.status(200).json({ ok:true, source, ...payload });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e && e.message || e) });
  }
}
