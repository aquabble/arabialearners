
/**
 * GET /api/glossary
 * Returns a UI-friendly glossary skeleton (semesters/units/chapters only).
 */
const { loadGlossary, normalizeGlossaryForUI } = require("./_lib.cjs");


module.exports = (req, res) => {
  // CORS for dev convenience
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const full = url.searchParams.get("full");

  const { data, source } = loadGlossary();
  if (!data) return res.status(200).json({ ok:true, source:null, semesters: [] });

  if (full) {
    // Return full semesters (with vocab) using the unified helper
    const sems = (typeof getSemestersList === 'function')
      ? getSemestersList(data)
      : (Array.isArray(data?.semesters) ? data.semesters : (Array.isArray(data) ? (data.find(x => (x?.type||'').toLowerCase()==='semesters')?.items || []) : []));

    return res.status(200).json({ ok: true, source, semesters: sems || [] });
  }

  const normalized = normalizeGlossaryForUI(data);
  res.status(200).json({ ok: true, source, ...normalized });
};

