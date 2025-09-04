
// File: pages/api/sentence-bundle.js (Pages Router) — reuses v4.4 logic but imports shared helpers.
import { OpenAI } from "openai";
import { findGlossary, extractLexiconFromGlossary } from "@/src/lib/glossary-server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const config = { api: { bodyParser: true } };

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function safeParse(body) { if (!body) return {}; if (typeof body === "object") return body; try { return JSON.parse(body); } catch { return {}; } }

function difficultyRules(d){ d=(d||"").toLowerCase(); if(d==="short"||d==="easy") return {length:"short", wordsRange:[4,8], minHits:1}; if(d==="long"||d==="hard") return {length:"long", wordsRange:[12,20], minHits:2, preferMaxHits:3}; return {length:"medium", wordsRange:[8,12], minHits:2}; }

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

async function callModel(messages) {
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.8,
    top_p: 0.9,
    frequency_penalty: 0.35,
    presence_penalty: 0.25,
    response_format: { type: "json_object" },
    messages
  });
  const raw = resp.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch { return extractJSON(raw) || {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  res.setHeader("Cache-Control", "no-store");
  try {
    const body = safeParse(req.body);
    const difficulty = body.difficulty ?? "medium";
    const semester = body.semester ?? body.sem ?? "S1";
    const unit = String(body.unit ?? "All");
    const chapter = String(body.chapter ?? "All");
    const direction = body.direction ?? "ar2en";
    const topic = body.topic ?? "";
    const timeModeRaw = body.timeMode ?? body.time ?? "None";
    const timeText = (body.timeText ?? "").toString().trim();
    const countRaw = body.count ?? body.size ?? 3;
    const N = clamp(Number(countRaw) || 3, 1, 10);
    const seed = (body.seed ?? Math.floor(Math.random() * 1e9)) + "";

    const rules = difficultyRules(difficulty);
    const mustUseTime = (("" + timeModeRaw).toLowerCase() !== "none") || (timeText.length > 0);

    let lexicon = Array.isArray(body.lexicon) ? body.lexicon : null;
    if (!lexicon) {
      const { data } = findGlossary();
      lexicon = data ? extractLexiconFromGlossary(data, semester, unit, chapter) : [];
    }

    const baseSys =
`You generate sentence PAIRS for Arabic↔English learners (CEFR A2–B1).
Return ONLY: {"items":[{"ar":"...","en":"...","hint"?: "..."}]}.
- direction=ar2en => "ar" is Arabic source, "en" is the English meaning (vice versa for en2ar).
- Target length ${rules.length} (${rules.wordsRange[0]}–${rules.wordsRange[1]} words on source side).
- Use at least ${rules.minHits}${rules.preferMaxHits?("-"+rules.preferMaxHits):""} curriculum vocab word(s) when provided.
- Keep sentences natural and compact; vary structure (questions, negation, tense, time/place).`;

    const payload = {
      difficulty, semester, unit, chapter, direction, topic,
      time: mustUseTime ? (timeText || "today / yesterday / tomorrow / in the evening") : null,
      count: N, style_seed: seed,
      lexicon,
      enforce: {
        min_lexicon_hits: (lexicon && lexicon.length) ? rules.minHits : 0,
        prefer_hits_upto: rules.preferMaxHits || rules.minHits,
        source_word_range: rules.wordsRange
      }
    };

    let parsed = await callModel([
      { role: "system", content: baseSys },
      { role: "user", content: JSON.stringify(payload) }
    ]);
    let items = coerceItems(parsed).map(x => normalizePair(x, direction)).filter(Boolean);

    if (items.length < N) {
      const fillParsed = await callModel([
        { role: "system", content: baseSys },
        { role: "user", content: JSON.stringify({ ...payload, lexicon: [], enforce: { min_lexicon_hits: 0, source_word_range: rules.wordsRange }, count: N }) }
      ]);
      const fillItems = coerceItems(fillParsed).map(x => normalizePair(x, direction)).filter(Boolean);
      items = uniqByText([...items, ...fillItems]).slice(0, N);
    }

    if (mustUseTime && items.length) {
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

    if (!items.length) {
      const fallback = direction === "ar2en"
        ? [{ ar: "ذهبتُ إلى السوق صباحًا.", en: "I went to the market in the morning." }]
        : [{ en: "I study Arabic every day.", ar: "أدرسُ العربية كلَّ يوم." }];
      items = fallback.slice(0, N);
    } else if (items.length < N) {
      const padded = [];
      for (let i = 0; i < N; i++) padded.push({ ...items[i % items.length] });
      items = padded.slice(0, N);
    }

    res.status(200).json({ ok: true, items, sentences: items, list: items, lexicon_used: (lexicon && lexicon.length) ? lexicon.length : 0 });
  } catch (err) {
    res.status(500).json({ ok:false, error:String(err && err.message || err) });
  }
}
