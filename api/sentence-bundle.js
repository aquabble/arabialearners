
// API SEMESTER1 TAILORED PATCH v4.3 (UI-safe)
// Tailors lexicon loading to src/lib/semester1.json schema:
// { "semester": 1, "units": [ { "difficulty": 3, "unit": { "id": "unit_3", "name": "Unit 3", "chapters": [...] } } ] }
//
// Where vocab may appear at either level:
// - unit.unit.vocab: string[]
// - unit.unit.chapters[].vocab: string[]
// (Also accepts synonyms: words, wordBank, terms, glossary)
//
// Still supports data/semester1.json and data/lexicon.json as fallbacks.
// Accepts client-provided `lexicon` which overrides file(s).
// Keeps: difficulty→length+vocab rules, no-cache, UI-compatible keys, second-pass fill to avoid empties.

import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const config = { api: { bodyParser: true } };

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function safeParse(body) { if (!body) return {}; if (typeof body === "object") return body; try { return JSON.parse(body); } catch { return {}; } }

// ---- Normalizers
const AR_HARAKAT = /[\u064B-\u065F\u0670]/g;
function normLatinTight(s){ return (s||"").toLowerCase().replace(/[^a-z0-9]/g,""); }
function normArabic(s){ return (s||"").replace(AR_HARAKAT,"").replace(/\u0622/g,"\u0627").replace(/\u0623/g,"\u0627").replace(/\u0625/g,"\u0627").replace(/\u0649/g,"\u064A").replace(/\u0629/g,"\u0647").replace(/[^\u0600-\u06FF\s]/g,"").trim(); }

// ---- Difficulty rules
function difficultyRules(d){ d=(d||"").toLowerCase(); if(d==="short"||d==="easy") return {length:"short", wordsRange:[4,8], minHits:1}; if(d==="long"||d==="hard") return {length:"long", wordsRange:[12,20], minHits:2, preferMaxHits:3}; return {length:"medium", wordsRange:[8,12], minHits:2}; }

// ---- Semester1 schema loader
function readJSONIfExists(relOrAbs){
  try{
    let p = relOrAbs;
    if (!p.startsWith("/")) p = path.join(process.cwd(), p);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  }catch{}
  return null;
}

function collectStringsFromAny(x, out){
  if (!x) return;
  if (typeof x === "string") { out.push(x); return; }
  if (Array.isArray(x)) { for (const y of x) collectStringsFromAny(y, out); return; }
  if (typeof x === "object") {
    for (const k of Object.keys(x)) {
      const v = x[k];
      if (typeof v === "string") out.push(v);
      else if (Array.isArray(v)) collectStringsFromAny(v, out);
      else if (k === "ar" || k === "arabic" || k === "en" || k === "english" || k === "word" || k === "root") {
        if (typeof v === "string") out.push(v);
      }
    }
  }
}

function extractVocabFromUnit(unitObj){
  // Accept multiple keys for vocab arrays
  const vocabKeys = ["vocab","words","wordBank","terms","glossary"];
  const out = [];
  for (const k of vocabKeys) {
    if (Array.isArray(unitObj?.[k])) collectStringsFromAny(unitObj[k], out);
  }
  // Chapters
  const chapters = unitObj?.chapters;
  if (Array.isArray(chapters)) {
    for (const ch of chapters) {
      for (const k of vocabKeys) {
        if (Array.isArray(ch?.[k])) collectStringsFromAny(ch[k], out);
      }
    }
  }
  return out;
}

function matchUnit(units, unitLabel){
  if (!Array.isArray(units)) return null;
  const n = normLatinTight(String(unitLabel||""));
  const digits = n.replace(/\D+/g, ""); // "3"
  for (const u of units) {
    const id = normLatinTight(u?.unit?.id || "");
    const name = normLatinTight(u?.unit?.name || "");
    if (!id && !name) continue;
    if (id === n || name === n) return u;
    if (digits && (id.endsWith(digits) || name.endsWith(digits))) return u;
  }
  return null;
}

function pickLexiconFromSemester1(json, unitLabel, chapterLabel){
  // json: { semester, units: [ {difficulty, unit:{id,name,chapters}} ] }
  if (!json || typeof json !== "object" || !Array.isArray(json.units)) return [];
  const u = matchUnit(json.units, unitLabel) || json.units[0];
  if (!u) return [];
  const unitObj = u.unit || {};
  let lex = extractVocabFromUnit(unitObj);

  // If a specific chapter is requested, try to narrow to that chapter first
  const chapN = normLatinTight(String(chapterLabel||""));
  const digits = chapN.replace(/\D+/g, "");
  const chapters = Array.isArray(unitObj.chapters) ? unitObj.chapters : [];
  const ch = chapters.find(c => {
    const id = normLatinTight(c?.id || "");
    const name = normLatinTight(c?.name || "");
    if (chapN && (id === chapN || name === chapN)) return true;
    if (digits && (id.endsWith(digits) || name.endsWith(digits))) return true;
    return false;
  });
  if (ch) {
    const narrowed = extractVocabFromUnit({ chapters:[ch] });
    if (narrowed.length) lex = narrowed;
  }

  // de-dup
  const seen = new Set(); const uniq = [];
  for (const w of lex) if (!seen.has(w)) { seen.add(w); uniq.push(w); }
  return uniq;
}

function mergedLexicon(semester, unit, chapter){
  // Priority files (in order):
  const prefer = process.env.LEXICON_FILES
    ? process.env.LEXICON_FILES.split(",").map(s => s.trim())
    : ["src/lib/semester1.json", "data/semester1.json", "data/lexicon.json"];

  let merged = [];

  for (const fp of prefer) {
    const j = readJSONIfExists(fp);
    if (!j) continue;
    if (j && Array.isArray(j.units)) {
      // semester1 schema
      merged.push(...pickLexiconFromSemester1(j, unit, chapter));
    } else if (Array.isArray(j)) {
      // flat array
      collectStringsFromAny(j, merged);
    } else if (typeof j === "object") {
      // nested/other schema: collect strings broadly
      collectStringsFromAny(j, merged);
    }
  }

  // de-dup
  const seen = new Set(); const uniq = [];
  for (const w of merged) if (!seen.has(w)) { seen.add(w); uniq.push(w); }
  return uniq;
}

// ---- Model I/O
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

    // Prefer client-provided lexicon; else derive from semester1.json (tailored)
    let lexicon = Array.isArray(body.lexicon) ? body.lexicon : null;
    if (!lexicon) {
      lexicon = mergedLexicon(semester, unit, chapter);
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

    // First call
    let parsed = await callModel([
      { role: "system", content: baseSys },
      { role: "user", content: JSON.stringify(payload) }
    ]);
    let items = coerceItems(parsed).map(x => normalizePair(x, direction)).filter(Boolean);

    // If too few, run a second pass w/o lexicon to fill
    if (items.length < N) {
      const fillParsed = await callModel([
        { role: "system", content: baseSys },
        { role: "user", content: JSON.stringify({ ...payload, lexicon: [], enforce: { min_lexicon_hits: 0, source_word_range: rules.wordsRange }, count: N }) }
      ]);
      const fillItems = coerceItems(fillParsed).map(x => normalizePair(x, direction)).filter(Boolean);
      items = uniqByText([...items, ...fillItems]).slice(0, N);
    }

    // Light time adjunct enforcement
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
      const base = direction === "ar2en"
        ? [{ ar: "ذهبتُ إلى السوق صباحًا.", en: "I went to the market in the morning." }]
        : [{ en: "I study Arabic every day.", ar: "أدرسُ العربية كلَّ يوم." }];
      items = base.slice(0, N);
    } else if (items.length < N) {
      const padded = [];
      for (let i = 0; i < N; i++) padded.push({ ...items[i % items.length] });
      items = padded.slice(0, N);
    }

    res.status(200).json({ ok: true, items, sentences: items, list: items, lexicon_source: "semester1-tailored", lexicon_used: (lexicon && lexicon.length) ? lexicon.length : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal error", detail: String(err && err.message || err) });
  }
}
