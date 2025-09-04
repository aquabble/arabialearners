// DROP-IN REPLACEMENT
// File: api/sentence.js
// - Increases temperature and adds penalties for more diverse outputs.

import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const sys = [
      {
        role: "system",
        content:
          "You are a sentence generator for Arabic learners. Produce one compact CEFR A2–B1 sentence. Output JSON with { item }."
      }
    ];

    const user = [
      {
        role: "user",
        content: JSON.stringify({ difficulty, unit, chapter, direction })
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
      parsed = { item: null };
    }
    const item = parsed.item || parsed.sentence || parsed.data || null;
    res.status(200).json({ item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error", detail: String(err && err.message || err) });
  }
}