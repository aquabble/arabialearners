
// API MODIFIERS PATCH v3 (UI-safe, variety-on, no-cache)
// File: api/sentence-bundle.js

import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const config = { api: { bodyParser: true } };

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function safeParse(body) { if (!body) return {}; if (typeof body === "object") return body; try { return JSON.parse(body); } catch { return {}; } }

function coerceItems(parsed) {
  if (!parsed) return [];
  let items = parsed.items || parsed.sentences || parsed.list || parsed.data;
  if (Array.isArray(items)) return items;
  if (parsed.bundle && Array.isArray(parsed.bundle.items)) return parsed.bundle.items;
  for (const v of Object.values(parsed)) if (Array.isArray(v)) return v;
  return [];
}

function normalizePair(obj, direction) {
  if (!obj || typeof obj !== "object") return null;
  let ar = obj.ar ?? obj.arabic ?? null;
  let en = obj.en ?? obj.english ?? null;
  if (!ar && !en) {
    if (direction === "ar2en") { ar = obj.prompt ?? null; en = obj.answer ?? null; }
    else { en = obj.prompt ?? null; ar = obj.answer ?? null; }
  }
  if (!ar || !en) return null;
  const hint = obj.hint ?? obj.note ?? obj.gloss ?? null;
  return { ar, en, ...(hint ? { hint } : {}) };
}

function extractJSON(text) {
  if (typeof text !== "string") return null;
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

function uniqByText(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.ar || "") + "||" + (it.en || "");
    if (!seen.has(key.trim())) {
      seen.add(key.trim());
      out.push(it);
    }
  }
  return out;
}

function difficultyHints(level) {
  switch ((level || "").toLowerCase()) {
    case "easy": return { length: "short", vocab: "basic", grammar: "simple" };
    case "hard": return { length: "medium", vocab: "richer", grammar: "include subordinate clauses" };
    default: return { length: "short-to-medium", vocab: "common", grammar: "mix of simple and a bit complex" };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // Prevent any caching
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
    const countRaw = body.count ?? body.size ?? 3;
    const N = clamp(Number(countRaw) || 3, 1, 10);
    const seed = (body.seed ?? Math.floor(Math.random() * 1e9)) + "";

    const mustUseTime = (("" + timeModeRaw).toLowerCase() !== "none") || (timeText.length > 0);

    const diff = difficultyHints(difficulty);

    const sys = [
      { role: "system",
        content:
`You generate sentence PAIRS for Arabic↔English learners (CEFR A2–B1).
You MUST ONLY reply with one JSON object: { "items": [ { "ar": "...", "en": "...", "hint": "..."? } ] }.
Obey constraints strictly:
- direction=ar2en => "ar" is Arabic source, "en" is the English meaning.
- direction=en2ar => reverse roles.
- Honor difficulty: ${difficulty} (${diff.length}, ${diff.vocab}, ${diff.grammar}).
- If unit != "All" or chapter != "All", keep content thematically consistent with Unit/Chapter.
- If topic provided, keep all sentences on that topic.
- Vary structure across items (questions, statements, negation, different tenses, time/place adjuncts).
- Keep sentences compact and natural.` }
    ];

    const constraints = {
      difficulty,
      unit,
      chapter,
      direction,
      topic,
      count: N,
      style_seed: seed,
      require_time_adjunct: mustUseTime,
      time_text: mustUseTime ? (timeText || "today / yesterday / tomorrow / in the evening") : null,
      variety_recipe: [
        "1 statement (present)",
        "1 yes/no question (present)",
        "1 statement with negation (past)",
        "1 wh-question (past)",
        "1 plan/intent (future or near-future)",
        "1 with a connector (because, but, so)",
        "1 with place adjunct",
        "1 with time adjunct"
      ]
    };

    const user = [{ role: "user", content: JSON.stringify(constraints) }];

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

    let items = coerceItems(parsed).map(x => normalizePair(x, direction)).filter(Boolean);

    // enforce time adjunct if requested
    if (mustUseTime) {
      const tt = constraints.time_text;
      items = items.map((it, idx) => {
        const hasTime = /\b(اليوم|أمس|غدًا|صباحًا|مساءً|الليلة|الآن|غداً|غذا|tomorrow|yesterday|today|in the (morning|evening|afternoon)|tonight)\b/iu.test((it.ar || "") + " " + (it.en || ""));
        if (!hasTime && idx % 2 === 0) { // add to about half
          if (direction === "ar2en") return { ...it, ar: it.ar.replace(/[\.\!؟]*\s*$/, `، ${tt}.`) };
          else return { ...it, en: it.en.replace(/[.!?]*\s*$/, `, ${tt}.`) };
        }
        return it;
      });
    }

    items = uniqByText(items).slice(0, N);

    if (!items.length) {
      // Safe fallback (still honoring direction)
      items = direction === "ar2en"
        ? [{ ar: "ذهبتُ إلى السوق صباحًا.", en: "I went to the market in the morning." }]
        : [{ en: "I study Arabic every day.", ar: "أدرسُ العربية كلَّ يوم." }];
    }

    res.status(200).json({ ok: true, items, sentences: items, list: items, seed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal error", detail: String(err && err.message || err) });
  }
}
