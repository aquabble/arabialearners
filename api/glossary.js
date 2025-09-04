
/**
 * GET /api/glossary
 * Returns a UI-friendly glossary skeleton (semesters/units/chapters only).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadGlossary, normalizeGlossaryForUI } = require("./_lib.cjs");

export default (req, res) => {
  // CORS for dev convenience
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { data, source } = loadGlossary();
  const normalized = normalizeGlossaryForUI(data);
  res.status(200).json({ ok: true, source, ...normalized });
};
