
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadGlossary } = require("./_lib.cjs");

function send(res, code, obj) {
  try {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(obj));
  } catch (e) {
    console.error("diag send error", e);
  }
}

export default function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });

  let node = process.version || "unknown";
  const { data, source } = loadGlossary();
  const info = {
    ok: true,
    runtime: "node",
    nodeVersion: node,
    hasFetch: typeof fetch === "function",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    glossaryFoundAt: source || null,
    hasGlossary: !!data
  };
  send(res, 200, info);
}
