
export const config = { runtime: "nodejs" };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Ensure Glossary.json is bundled in the function package
try { require("./Glossary.json"); } catch {}

const { loadGlossary } = require("./_lib.cjs");
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const { data, source } = loadGlossary();
    res.status(200).json({
      ok: true,
      runtime: "node",
      nodeVersion: process.version,
      hasFetch: typeof fetch === "function",
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      glossaryFoundAt: source || null,
      hasGlossary: !!data
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e?.message||e) });
  }
}
