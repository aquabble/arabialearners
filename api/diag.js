
export const config = { runtime: "nodejs" };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadGlossary } = require("./_lib.cjs");

function send(res, code, obj) {
  try {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(obj));
  } catch (e) {}
}

export default function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, { ok: true });
    const { data, source } = loadGlossary();
    return send(res, 200, {
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
    return send(res, 500, { ok:false, error: String(e?.message||e) });
  }
}
