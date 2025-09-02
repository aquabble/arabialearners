import OpenAI from "openai";
export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Arabic normalization helpers
const HARKAT = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const normAR = (s) => String(s||"").normalize("NFKC").replace(HARKAT,"").replace(TATWEEL,"").trim();
const normEN = (s) => String(s||"").toLowerCase().replace(/\s+/g,' ').trim();

function json(data, status=200){ return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }

export default async function handler(req){
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const { direction = "ar2en", guess = "", referenceAr = "", referenceEn = "" } = body || {};
  const key = (process.env && process.env.OPENAI_API_KEY) || "";
  if (!key) return json({ error: "Server missing OPENAI_API_KEY" }, 500);

  // quick normalized exact checks
  if (direction === "ar2en" && normEN(guess) && normEN(referenceEn) && normEN(guess) === normEN(referenceEn)) {
    return json({ verdict: "correct", hint: "Exact match (normalized)." });
  }
  if (direction === "en2ar" && normAR(guess) && normAR(referenceAr) && normAR(guess) === normAR(referenceAr)) {
    return json({ verdict: "correct", hint: "مطابقة تامة بعد التطبيع." });
  }

  const system = `You are an Arabic↔English tutor.
  Return STRICT JSON with keys exactly: {"verdict":"correct|minor|wrong","hint":"short helpful hint"}.
  Be concise. Consider minor spelling variants. Ignore Arabic diacritics (harakat).`;

  const user = {
    direction, guess, referenceAr, referenceEn
  };

  try{
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ]
    });
    const content = resp.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { "Content-Type": "application/json" } });
  }catch(e){
    return json({ error: String(e?.message || e) }, 502);
  }
}
