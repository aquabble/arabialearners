import OpenAI from "openai";
export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function json(data, status=200){ return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
const safe = (v)=> String(v == null ? "" : v).trim();

function lengthHintFromDifficulty(d){
  return d === "short" ? "Keep the Arabic sentence concise (≈5–7 words)."
       : d === "long"  ? "Use a longer Arabic sentence (≈13–20 words)."
       : "Aim for a medium-length Arabic sentence (≈8–12 words).";
}

export default async function handler(req){
  if (req.method !== "POST") return json({ error:"Method Not Allowed" }, 405);
  let body; try{ body = await req.json(); }catch{ return json({ error:"Bad JSON" }, 400); }

  const { difficulty="medium", unit="All", chapter="All", direction="ar2en", topic="" } = body || {};
  const key = (process.env && process.env.OPENAI_API_KEY) || "";
  if (!key) return json({ error:"Server missing OPENAI_API_KEY" }, 500);

  const system = `You generate one Arabic↔English sentence pair for learners.
  Output STRICT JSON: {"ar": "...", "en": "...", "tokens": {"ar": string[], "en": string[]}}.
  Tokens must be whitespace-separated word tokens, no punctuation-only tokens.
  Keep content classroom-safe and general.`;

  const lengthHint = lengthHintFromDifficulty(difficulty);
  const user = {
    direction, unit, chapter, topic,
    instruction: `Make a sentence relevant to "${unit}/${chapter}"${topic?` on "${topic}"`:""}. ${lengthHint}`
  };

  try{
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ]
    });
    let content = resp.choices?.[0]?.message?.content || "{}";
    let out; try{ out = JSON.parse(content) }catch{ out = {}; }
    const ar = safe(out.ar);
    const en = safe(out.en);
    let tokensAr = Array.isArray(out?.tokens?.ar) ? out.tokens.ar : ar.split(/\s+/).filter(Boolean);
    let tokensEn = Array.isArray(out?.tokens?.en) ? out.tokens.en : en.split(/\s+/).filter(Boolean);
    return json({ ar, en, tokens: { ar: tokensAr, en: tokensEn } });
  }catch(e){
    return json({ error: String(e?.message || e) }, 502);
  }
}
