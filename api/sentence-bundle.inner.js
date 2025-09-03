import OpenAI from "openai";
import { withTimeout } from "./_withTimeout.js";

export const config = { runtime: "edge" };

function toJson(obj, status=200, extra={}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}

function safe(v){ return String(v == null ? "" : v).trim(); }

function normalize(input = {}){
  const asStr = (v)=> typeof v === "string" ? v.trim().toLowerCase() : "";
  const DIFF = new Set(["easy","medium","hard"]);
  const DIRS = new Set(["ar2en","en2ar"]);
  const TM   = new Set(["none","relative","absolute"]);
  const difficulty = DIFF.has(asStr(input.difficulty)) ? asStr(input.difficulty) : "medium";
  const direction  = DIRS.has(asStr(input.direction))   ? asStr(input.direction)  : "ar2en";
  const timeMode   = TM.has(asStr(input.timeMode))      ? asStr(input.timeMode)   : "none";
  const unit       = input.unit === "All" ? null : input.unit ?? null;
  const chapter    = input.chapter === "All" ? null : input.chapter ?? null;
  const rawSize    = typeof input.size === "number" ? input.size : parseInt(input.size, 10);
  const size       = Number.isFinite(rawSize) ? Math.max(1, Math.min(10, rawSize)) : 5;
  const timeText   = typeof input.timeText === "string" ? input.timeText : "";
  return { difficulty, direction, timeMode, unit, chapter, size, timeText };
}

function lengthHintFromDifficulty(d){
  return d === "easy"   ? "Keep the sentence very simple and short (≈5–8 words)."
       : d === "hard"   ? "Use a more complex sentence (≈13–20 words)."
       :                  "Use a medium-length sentence (≈8–12 words).";
}

export default async function handler(req){
  if (req.method !== "POST") return toJson({ error:"Method Not Allowed" }, 405);

  // Read body or accept URL params (for some runtimes)
  let body;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    } else {
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams.entries());
    }
  } catch {
    body = {};
  }
  const { difficulty, direction, timeMode, unit, chapter, size, timeText } = normalize(body);

  const apiKey = (typeof process !== "undefined" && process.env && process.env.OPENAI_API_KEY) ? process.env.OPENAI_API_KEY : "";
  if (!apiKey) {
    return toJson({ error: "Missing OPENAI_API_KEY on server" }, 503);
  }

  const client = new OpenAI({ apiKey });

  const system = [
    "You generate Arabic↔English sentence pairs for a language learning drill.",
    "Return strictly JSON: an array of objects of length 'size'.",
    "Each object MUST have: ar (Arabic), en (English), tokens.ar (array of words), tokens.en (array of words).",
    "Do not include backticks. Do not include any explanations.",
    "Arabic should be fully vowelized only if needed for clarity; otherwise, ordinary script is fine."
  ].join(" ");

  const user = {
    difficulty, direction, unit, chapter, timeMode, timeText, size,
    guidance: lengthHintFromDifficulty(difficulty),
    constraints: {
      topics: "Everyday life, school, family, errands, weather, simple travel.",
      profanity: "none",
      namedEntities: "avoid real names and locations"
    }
  };

  try {
    const rsp = await withTimeout(client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" }, // we'll ask for {"items":[...]} to be safer
      messages: [
        { role: "system", content: system },
        { role: "user", content: [
            "Using the following settings, generate exactly 'size' sentence pairs.",
            "Direction 'ar2en' means Arabic source with English translation.",
            "Direction 'en2ar' means English source with Arabic translation.",
            "Respond as a JSON object with an 'items' array only."
          ].join(" ") },
        { role: "user", content: JSON.stringify(user) }
      ]
    }), 25000, () => ({ choices: [{ message: { content: '{"items":[]}' } }] }));

    const raw = rsp?.choices?.[0]?.message?.content || '{"items":[]}';
    let obj; try { obj = JSON.parse(raw); } catch { obj = { items: [] }; }
    let items = Array.isArray(obj.items) ? obj.items : (Array.isArray(obj) ? obj : []);

    // Sanitize each item
    items = items.slice(0, size).map((it) => {
      const ar = safe(it?.ar);
      const en = safe(it?.en);
      const tAr = Array.isArray(it?.tokens?.ar) ? it.tokens.ar : ar.split(/\s+/).filter(Boolean);
      const tEn = Array.isArray(it?.tokens?.en) ? it.tokens.en : en.split(/\s+/).filter(Boolean);
      return { ar, en, tokens: { ar: tAr, en: tEn } };
    });

    // If model returned 0, generate at least one simple fallback using direction
    if (items.length === 0) {
      if (direction === "ar2en") {
        items = [{ ar: "ذهبتُ إلى المكتبة بعد المدرسة.", en: "I went to the library after school.", tokens: { ar: ["ذهبتُ","إلى","المكتبة","بعد","المدرسة"], en: ["I","went","to","the","library","after","school"] } }];
      } else {
        items = [{ en: "I drink coffee every morning.", ar: "أشرب القهوة كل صباح.", tokens: { en: ["I","drink","coffee","every","morning"], ar: ["أشرب","القهوة","كل","صباح"] } }];
      }
    }

    return toJson({ items });
  } catch (e) {
    return toJson({ error: String(e?.message || e), items: [] }, 502);
  }
}
