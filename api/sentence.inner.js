import OpenAI from "openai";
import { json } from "./_json.js";

export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function safe(v){ return String(v == null ? "" : v).trim(); }
function lengthHintFromDifficulty(d){
  return d === "easy"   ? "Keep the sentence very simple and short (≈5–8 words)."
       : d === "hard"   ? "Use a more complex sentence (≈13–20 words)."
       :                  "Use a medium-length sentence (≈8–12 words).";
}

export default async function handler(req){
  if (req.method !== "POST") return json({ error:"Method Not Allowed" }, 405);
  let body = {};
  try { body = await req.json(); } catch {}
  const difficulty = ["easy","medium","hard"].includes((body.difficulty||"").toLowerCase()) ? body.difficulty.toLowerCase() : "medium";
  const direction  = ["ar2en","en2ar"].includes((body.direction||"").toLowerCase()) ? body.direction.toLowerCase() : "ar2en";

  const system = [
    "You generate ONE Arabic↔English sentence pair for a language learning drill.",
    "Return strictly JSON with fields: ar, en, tokens.ar, tokens.en",
    "No extra text, no markdown."
  ].join(" ");

  const user = {
    difficulty, direction,
    guidance: lengthHintFromDifficulty(difficulty),
    constraints: {
      topics: "Everyday life, school, family, errands, weather, simple travel.",
      profanity: "none", namedEntities: "avoid real names/locations"
    }
  };

  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ]
    });
    const content = resp.choices?.[0]?.message?.content || "{}";
    let out; try { out = JSON.parse(content) } catch { out = {}; }
    const ar = safe(out.ar);
    const en = safe(out.en);
    const tAr = Array.isArray(out?.tokens?.ar) ? out.tokens.ar : ar.split(/\s+/).filter(Boolean);
    const tEn = Array.isArray(out?.tokens?.en) ? out.tokens.en : en.split(/\s+/).filter(Boolean);
    return json({ ar, en, tokens: { ar: tAr, en: tEn } });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502);
  }
}
