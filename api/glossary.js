
export const config = { runtime: "nodejs" };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Ensure Glossary.json is bundled inside the Serverless function package:
try { require("./Glossary.json"); } catch {}
const { loadGlossary, normalizeGlossaryForUI, getSemestersList } = require("./_lib.cjs");

export default async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const full = url.searchParams.get("full");

    let { data, source } = loadGlossary();
    // HTTP fallback if not found in the fs bundle
    if (!data && typeof fetch === "function") {
      try {
        const http = await fetch(new URL("/Glossary.json", url.origin), { cache: "no-store" });
        if (http.ok) { data = await http.json(); source = url.origin + "/Glossary.json"; }
      } catch {}
    }

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
