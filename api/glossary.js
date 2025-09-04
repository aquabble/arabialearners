export const config = { runtime: "nodejs" };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadGlossary, normalizeGlossaryForUI, getSemestersList } = require("./_lib.cjs");

export default (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const full = url.searchParams.get("full");

    const { data, source } = loadGlossary();
    if (!data) return res.status(200).json({ ok:true, source:null, semesters: [] });

    if (full) {
      const sems = getSemestersList(data) || [];
      return res.status(200).json({ ok:true, source, semesters: sems });
    }

    const normalized = normalizeGlossaryForUI(data);
    res.status(200).json({ ok:true, source, ...normalized });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e?.message||e) });
  }
}
