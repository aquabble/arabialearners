import { json } from "./_json.js";
export const config = { runtime: "edge" };
export default async function handler(req) {
  const base = new URL(req.url);
  base.pathname = "/semester1.json";
  let archiveOk = false, openai = false;
  try { const r = await fetch(base.toString(), { method: "GET" }); archiveOk = r.ok; } catch {}
  try { openai = Boolean(process.env.OPENAI_API_KEY); } catch { openai = false; }
  return json({ ok: true, checks: { archiveOk, openai } });
}
