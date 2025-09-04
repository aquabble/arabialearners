
// API COMPAT PATCH v2 (UI-safe)
// File: api/sentence-bundle.js

import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const config = { api: { bodyParser: true } };

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function safeParse(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try { return JSON.parse(body); } catch { return {}; }
}

function coerceItems(parsed) {
  if (!parsed) return [];
  // Try common keys
  let items = parsed.items || parsed.sentences || parsed.list || parsed.data;
  if (Array.isArray(items)) return items;

  // If model returned something like { bundle: { items: [...] } }
  if (parsed.bundle && Array.isArray(parsed.bundle.items)) return parsed.bundle.items;

  // As a last resort, try to pull an array from any property value
  for (const v of Object.values(parsed)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

function normalizePair(obj, direction) {
  // Normalize to { ar, en } with optional hint
  if (!obj || typeof obj !== "object") return null;
  let ar = obj.ar ?? obj.arabic ?? null;
  let en = obj.en ?? obj.english ?? null;
  if (!ar && !en) {
    // maybe the model used {prompt, answer}
    if (direction === "ar2en") {
      ar = obj.prompt ?? null;
      en = obj.answer ?? null;
    } else {
      en = obj.prompt ?? null;
      ar = obj.answer ?? null;
    }
  }
  if (!ar || !en) return null;
  const hint = obj.hint ?? obj.note ?? obj.gloss ?? null;
  return { ar, en, ...(hint ? { hint } : {}) };
}

function extractJSON(text) {
  // Try to extract the first balanced {...} block
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = safeParse(req.body);
    const difficulty = body.difficulty ?? "medium";
    const unit = body.unit ?? "All";
    const chapter = body.chapter ?? "All";
    const direction = body.direction ?? "ar2en";
    const topic = body.topic ?? "";
    const countRaw = body.count ?? body.size ?? 3;
    const N = clamp(Number(countRaw) || 3, 1, 10);

    const schemaHint = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { ar: { type: "string" }, en: { type: "string" }, hint: { type: "string" } },
            required: ["ar", "en"],
            additionalProperties: true
          }
        }
      },
      required: ["items"],
      additionalProperties: true
    };

    const sys = [
      { role: "system", content: "You are an Arabic↔English sentence generator for language learners. ALWAYS reply with a single JSON object matching the requested schema." }
    ];

    const user = [
      {
        role: "user",
        content: JSON.stringify({
          instruction: "Generate a small bundle of CEFR A2–B1 level sentences with natural variety. When direction is ar2en, put Arabic in 'ar' and English in 'en'. When en2ar, reverse accordingly. Keep sentences compact.",
          difficulty, unit, chapter, direction, topic, count: N,
          schema: schemaHint,
          variety: { preferMix: ["statement", "question"], aspects: ["tense", "negation", "timeAdjunct", "connector"] }
        })
      }
    ];

    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.3,
      presence_penalty: 0.2,
      response_format: { type: "json_object" },
      messages: [...sys, ...user]
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    let parsed = null;
    try { parsed = JSON.parse(raw); }
    catch { parsed = extractJSON(raw) || {}; }

    let items = coerceItems(parsed);

    // Normalize and filter invalid pairs; as a fallback allow simple strings
    items = items
      .map(x => {
        if (typeof x === "string") {
          // If model gave plain strings, wrap based on direction
          return direction === "ar2en" ? { ar: x, en: "" } : { en: x, ar: "" };
        }
        return normalizePair(x, direction);
      })
      .filter(Boolean)
      .slice(0, N);

    // If still empty, return a minimal safe placeholder so UI doesn't break
    if (!items.length) {
      if (direction === "ar2en") {
        items = [
          { ar: "ذهبتُ إلى السوق صباحًا.", en: "I went to the market in the morning." },
          { ar: "هل تستطيع مساعدتي من فضلك؟", en: "Can you help me, please?" }
        ].slice(0, N);
      } else {
        items = [
          { en: "I study Arabic every day.", ar: "أدرسُ العربية كلَّ يوم." },
          { en: "Where is the nearest cafe?", ar: "أين أقرب مقهى؟" }
        ].slice(0, N);
      }
    }

    // Return multiple aliases for compatibility
    res.status(200).json({ ok: true, items, sentences: items, list: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal error", detail: String(err && err.message || err) });
  }
}
