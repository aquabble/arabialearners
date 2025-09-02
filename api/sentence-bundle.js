import OpenAI from "openai";
export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function json(data, status=200){ return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
const safe = (v)=> String(v == null ? "" : v).trim();
const clamp = (n,min,max)=> Math.max(min, Math.min(max, Math.floor(n||0)));

function lengthHintFromDifficulty(d){
  return d === "short" ? "Keep each Arabic sentence concise (≈5–7 words)."
       : d === "long"  ? "Use longer Arabic sentences (≈13–20 words)."
       : "Aim for medium-length Arabic sentences (≈8–12 words).";
}

export default async function handler(req){
  if (req.method !== "POST") return json({ error:"Method Not Allowed" }, 405);
  let body; try{ body = await req.json(); }catch{ return json({ error:"Bad JSON" }, 400); }

  const { difficulty="medium", unit="All", chapter="All", direction="ar2en", topic="", count=3 } = body || {};
  const N = clamp(count, 1, 10);
  const key = (process.env && process.env.OPENAI_API_KEY) || "";
  if (!key) return json({ error:"Server missing OPENAI_API_KEY" }, 500);

  const system = `You generate multiple Arabic↔English sentence pairs for learners.
  Output STRICT JSON: {"items": [{"ar": "...", "en": "...", "tokens": {"ar": string[], "en": string[]}}, ...]}.
  Tokens must be whitespace-separated word tokens, no punctuation-only tokens.
  Keep content classroom-safe and general.`;

  const lengthHint = lengthHintFromDifficulty(difficulty);
  const user = {
    direction, unit, chapter, topic, count: N,
    instruction: `Create ${N} varied sentence pairs relevant to "${unit}/${chapter}"${topic?` on "${topic}"`:""}. ${lengthHint}`
  };

  try{
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ]
    });
    let content = resp.choices?.[0]?.message?.content || "{}";
    let data; try{ data = JSON.parse(content) }catch{ data = {}; }
    const items = Array.isArray(data.items) ? data.items : [];
    const clean = items.map(it => {
      const ar = safe(it?.ar);
      const en = safe(it?.en);
      const tokensAr = Array.isArray(it?.tokens?.ar) ? it.tokens.ar : ar.split(/\s+/).filter(Boolean);
      const tokensEn = Array.isArray(it?.tokens?.en) ? it.tokens.en : en.split(/\s+/).filter(Boolean);
      return { ar, en, tokens: { ar: tokensAr, en: tokensEn } };
    });
    return json({ items: clean });
  }catch(e){
    return json({ error: String(e?.message || e) }, 502);
  }
}
