
// API COMPAT PATCH v2 (UI-safe)
// File: api/sentence.js

import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const config = { api: { bodyParser: true } };

function safeParse(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try { return JSON.parse(body); } catch { return {}; }
}

function extractJSON(text) {
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

    const sys = [{ role: "system", content: "You generate ONE sentence pair for Arabic↔English learning. Always reply with JSON: { item: { ar, en } }." }];
    const user = [{ role: "user", content: JSON.stringify({ difficulty, unit, chapter, direction }) }];

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
    try { parsed = JSON.parse(raw); } catch { parsed = extractJSON(raw) || {}; }
    let item = parsed?.item || parsed?.sentence || null;

    if (!item || typeof item !== "object") {
      // Fallback minimal sample
      item = direction === "ar2en"
        ? { ar: "الطقسُ جميلٌ اليوم.", en: "The weather is nice today." }
        : { en: "I finished my homework.", ar: "أنهيتُ واجبي المنزلي." };
    }

    res.status(200).json({ ok: true, item, sentence: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal error", detail: String(err && err.message || err) });
  }
}
