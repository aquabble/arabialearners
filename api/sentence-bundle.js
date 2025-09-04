
// API DIFFICULTY-LENGTH PATCH v4 (UI-safe)
// - Maps difficulty to target length + minimum curriculum vocab hits.
// - Tries to load a local lexicon at /data/lexicon.json (optional).
// - Also accepts `lexicon` in request body (array of words).
// - Enforces constraints via prompt + post-check; attempts one repair pass if under-hitting.
// - Keeps UI-compatible response keys (items/sentences/list).

import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const config = { api: { bodyParser: true } };

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function safeParse(body) { if (!body) return {}; if (typeof body === "object") return body; try { return JSON.parse(body); } catch { return {}; } }

// ----- Lexicon loading (optional local file) -----
function loadLocalLexicon() {
  try {
    const p = path.join(process.cwd(), "data", "lexicon.json");
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function pickLexicon(local, semester, unit, chapter) {
  // Supports a flat array or nested { [semester]: { [unit]: { [chapter]: [...] } } }
  if (Array.isArray(local)) return local;
  if (local && typeof local === "object") {
    const s = semester ?? "All";
    const u = unit ?? "All";
    const c = chapter ?? "All";
    // Try exact path
    let arr = local?.[s]?.[u]?.[c];
    if (Array.isArray(arr)) return arr;
    // Try fallbacks
    arr = local?.[s]?.[u] || local?.[s] || local?.["All"];
    if (Array.isArray(arr)) return arr;
    if (Array.isArray(local?.["All"]?.["All"]?.["All"])) return local["All"]["All"]["All"];
  }
  return [];
}

// ----- Text normalize utilities -----
const AR_HARAKAT = /[\u064B-\u065F\u0670]/g; // tanween, shadda, sukun, maddah, etc.
function normArabic(s) {
  if (!s) return "";
  return s
    .replace(AR_HARAKAT, "")
    .replace(/\u0622/g, "\u0627") // آ -> ا
    .replace(/\u0623/g, "\u0627") // أ -> ا
    .replace(/\u0625/g, "\u0627") // إ -> ا
    .replace(/\u0649/g, "\u064A") // ى -> ي
    .replace(/\u0629/g, "\u0647") // ة -> ه (rough)
    .replace(/[^\u0600-\u06FF\s]/g, "") // keep Arabic letters & spaces
    .trim();
}
function normLatin(s) {
  if (!s) return "";
  return s.toLowerCase().replace(/[^a-z0-9\s\-']/g, " ").replace(/\s+/g, " ").trim();
}

function countHits(text, lex) {
  if (!Array.isArray(lex) || !lex.length) return 0;
  const ar = normArabic(text);
  const en = normLatin(text);
  let hits = 0;
  const seen = new Set();
  for (const wRaw of lex) {
    const w = typeof wRaw === "string" ? wRaw : (wRaw?.word || "");
    if (!w) continue;
    const wAr = normArabic(w);
    const wEn = normLatin(w);
    let found = false;
    if (wAr) {
      // word boundary-ish for Arabic: simple substring after normalization
      if (ar && ar.includes(wAr)) found = true;
    }
    if (!found && wEn) {
      const re = new RegExp(`\\b${wEn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (en && re.test(en)) found = true;
    }
    if (found && !seen.has(w)) {
      hits++;
      seen.add(w);
    }
  }
  return hits;
}

function difficultyRules(difficulty) {
  const d = (difficulty || "").toLowerCase();
  if (d === "short" || d === "easy") return { length: "short", wordsRange: [4, 8], minHits: 1 };
  if (d === "long" || d === "hard") return { length: "long", wordsRange: [12, 20], minHits: 2, preferMaxHits: 3 };
  return { length: "medium", wordsRange: [8, 12], minHits: 2 }; // default/medium
}

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
  const seen = new Set(); const out = [];
  for (const it of items) {
    const key = (it.ar || "") + "||" + (it.en || "");
    if (!seen.has(key.trim())) { seen.add(key.trim()); out.push(it); }
  }
  return out;
}

async function generateBundle(payload, sysContent) {
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.8,
    top_p: 0.9,
    frequency_penalty: 0.35,
    presence_penalty: 0.25,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sysContent },
      { role: "user", content: JSON.stringify(payload) }
    ]
  });
  const raw = resp.choices?.[0]?.message?.content ?? "{}";
  let parsed = null; try { parsed = JSON.parse(raw); } catch { parsed = extractJSON(raw) || {}; }
  return coerceItems(parsed);
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  res.setHeader("Cache-Control", "no-store");

  try {
    const body = safeParse(req.body);
    const difficulty = body.difficulty ?? "medium"; // "short" | "medium" | "long" also accepted
    const semester = body.semester ?? body.sem ?? "All";
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
    const rules = difficultyRules(difficulty);

    // Assemble lexicon: body.lexicon has priority, else local file by (semester/unit/chapter)
    let lexicon = Array.isArray(body.lexicon) ? body.lexicon : [];
    if (!lexicon.length) {
      const local = loadLocalLexicon();
      lexicon = pickLexicon(local, semester, unit, chapter) || [];
    }

    const sysContent =
`You generate sentence PAIRS for Arabic↔English learners (CEFR A2–B1). 
ALWAYS respond with a single JSON object: { "items": [ { "ar": "...", "en": "...", "hint"?: "..." } ] }.
Obey constraints strictly:
- direction=ar2en => "ar" is Arabic source, "en" is the English meaning.
- direction=en2ar => reverse roles.
- Target length: ${rules.length} (${rules.wordsRange[0]}–${rules.wordsRange[1]} words on the source side).
- Use at least ${rules.minHits}${rules.preferMaxHits ? "-" + rules.preferMaxHits : ""} vocabulary item(s) from the provided curriculum list when available.
- Keep sentences natural and compact; vary structures (questions, negation, tense, time/place adjuncts).
`;

    const payload = {
      difficulty, length_rule: rules,
      semester, unit, chapter, direction, topic,
      time: mustUseTime ? (timeText || "today / yesterday / tomorrow / in the evening") : null,
      count: N,
      style_seed: seed,
      lexicon, // array of strings is fine
      enforce: {
        min_lexicon_hits: rules.minHits,
        prefer_hits_upto: rules.preferMaxHits || rules.minHits,
        source_word_range: rules.wordsRange
      }
    };

    // First pass
    let items = (await generateBundle(payload, sysContent))
      .map(x => normalizePair(x, direction)).filter(Boolean);

    // Post-check & optional repair if lexicon provided
    const needRepair = Array.isArray(lexicon) && lexicon.length > 0;
    if (needRepair) {
      const checked = [];
      const misses = [];
      for (const it of items) {
        const src = direction === "ar2en" ? it.ar : it.en;
        const hits = countHits(src || "", lexicon);
        if (hits >= rules.minHits) checked.push(it); else misses.push({ it, hits });
      }
      if (misses.length) {
        // Ask the model to minimally rewrite the misses to include more lexicon words.
        const repairPayload = {
          direction, length_rule: rules, lexicon,
          items: misses.map(m => m.it),
          target_min_hits: rules.minHits,
          prefer_hits_upto: rules.preferMaxHits || rules.minHits
        };
        const repairSys = `Rewrite the given items so each source sentence contains at least ${rules.minHits} lexicon word(s) (prefer up to ${rules.preferMaxHits || rules.minHits}). Keep meaning natural and within ${rules.wordsRange[0]}–${rules.wordsRange[1]} source-side words. Output {"items":[{ar,en}...]}.`;
        const repaired = (await generateBundle(repairPayload, repairSys))
          .map(x => normalizePair(x, direction)).filter(Boolean);
        items = uniqByText([...checked, ...repaired]);
      }
    }

    // Enforce time adjunct lightly if requested
    if (mustUseTime) {
      const tt = payload.time;
      items = items.map((it, idx) => {
        const combined = (it.ar || "") + " " + (it.en || "");
        const hasTime = /\b(اليوم|أمس|غدًا|صباحًا|مساءً|الليلة|الآن|غداً|tomorrow|yesterday|today|in the (morning|evening|afternoon)|tonight)\b/iu.test(combined);
        if (!hasTime && idx % 2 === 0) {
          if (direction === "ar2en") return { ...it, ar: it.ar.replace(/[\.\!؟]*\s*$/, `، ${tt}.`) };
          else return { ...it, en: it.en.replace(/[.!?]*\s*$/, `, ${tt}.`) };
        }
        return it;
      });
    }

    items = uniqByText(items).slice(0, N);
    if (!items.length) {
      items = direction === "ar2en"
        ? [{ ar: "ذهبتُ إلى السوق صباحًا.", en: "I went to the market in the morning." }]
        : [{ en: "I study Arabic every day.", ar: "أدرسُ العربية كلَّ يوم." }];
    }

    res.status(200).json({ ok: true, items, sentences: items, list: items, seed, rules, hits_enforced: !!(lexicon && lexicon.length) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal error", detail: String(err && err.message || err) });
  }
}
