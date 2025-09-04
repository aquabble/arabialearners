// DROP-IN REPLACEMENT
// File: api/sentence-bundle.js
// - Accepts `count` or `size` from body
// - Uses higher temperature + penalties for variety
// - Keeps response format stable: { items: [...] }

import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const difficulty = body.difficulty ?? "medium";
    const unit = body.unit ?? "All";
    const chapter = body.chapter ?? "All";
    const direction = body.direction ?? "ar2en";
    const topic = body.topic ?? "";
    const countRaw = body.count ?? body.size ?? 3;   // <— accept either key
    const N = clamp(Number(countRaw) || 3, 1, 10);

    const sys = [
      {
        role: "system",
        content:
          "You are a sentence generator for Arabic learners. Produce compact, CEFR A2–B1 sentences with natural variety. Output JSON only."
      }
    ];

    const user = [
      {
        role: "user",
        content: JSON.stringify({
          difficulty,
          unit,
          chapter,
          direction,
          topic,
          count: N,
          // gentle structure variety knobs to avoid sameness
          variety: {
            preferMix: ["statement", "question"],
            aspects: ["tense", "negation", "timeAdjunct", "connector"]
          }
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

    const txt = resp.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = { items: [] };
    }
    const items = parsed.items || parsed.sentences || parsed.data || [];
    res.status(200).json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error", detail: String(err && err.message || err) });
  }
}