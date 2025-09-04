
// API MODIFIERS PATCH v3 (UI-safe, variety-on, no-cache)
// File: api/sentence.js

import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const config = { api: { bodyParser: true } };

function safeParse(body) { if (!body) return {}; if (typeof body === "object") return body; try { return JSON.parse(body); } catch { return {}; } }
function extractJSON(text) { if (typeof text !== "string") return null; const s = text.indexOf("{"), e = text.lastIndexOf("}"); if (s === -1 || e === -1 || e <= s) return null; try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; } }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  res.setHeader("Cache-Control", "no-store");

  try {
    const body = safeParse(req.body);
    const difficulty = body.difficulty ?? "medium";
    const unit = body.unit ?? "All";
    const chapter = body.chapter ?? "All";
    const direction = body.direction ?? "ar2en";
    const topic = body.topic ?? "";
    const timeModeRaw = body.timeMode ?? body.time ?? "None";
    const timeText = (body.timeText ?? "").toString().trim();
    const mustUseTime = (("" + timeModeRaw).toLowerCase() !== "none") || (timeText.length > 0);

    const sys = [{ role: "system", content: "Generate ONE pair for Arabic↔English learning. Reply with JSON: { item: { ar, en } } and follow constraints." }];

    const user = [{ role: "user", content: JSON.stringify({
      difficulty, unit, chapter, direction, topic,
      require_time_adjunct: mustUseTime,
      time_text: mustUseTime ? (timeText || "today / this evening") : null,
      variety: ["question_or_statement", "negation_or_affirmation"]
    }) }];

    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.75,
      top_p: 0.9,
      frequency_penalty: 0.35,
      presence_penalty: 0.25,
      response_format: { type: "json_object" },
      messages: [...sys, ...user]
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    let parsed = null; try { parsed = JSON.parse(raw); } catch { parsed = extractJSON(raw) || {}; }
    let item = parsed?.item || parsed?.sentence || null;

    if (!item || typeof item !== "object" || (!item.ar && !item.en)) {
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
