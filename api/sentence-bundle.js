export const config = { runtime: "nodejs" };

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { loadGlossary } = require("./_lib.cjs");

let OpenAI = null;
try {
  // optional import (keeps function working in dev even if dep missing)
  OpenAI = (await import("openai")).default;
} catch {}

/** ---------- helpers ---------- **/
function rand(n) { return Math.floor(Math.random() * n); }
function choice(a) { return a[rand(a.length)]; }
function noStore(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
}
function scopeFromBody(gloss, scope = {}) {
  const sem = (gloss?.semesters || []).find(s => !scope.semester || s.id === scope.semester)
           || (gloss?.semesters || [])[0];
  const unit = (sem?.units || []).find(u => !scope.unit || u.id === scope.unit)
            || (sem?.units || [])[0];
  const chap = (unit?.chapters || []).find(c => !scope.chapter || c.id === scope.chapter)
            || (unit?.chapters || [])[0];
  const vocab = (chap?.vocab || []).filter(v => v?.ar && v?.en);
  return {
    used: { semester: sem?.id, unit: unit?.id, chapter: chap?.id },
    vocab
  };
}

/** A simple local fallback if OpenAI is not available */
function localFallback({ direction = "ar2en", difficulty = "medium", vocab = [] }) {
  const people = [
    { ar: "الطالب", en: "the student" }, { ar: "الطالبة", en: "the female student" },
    { ar: "المعلم", en: "the teacher" }, { ar: "المعلمة", en: "the female teacher" },
    { ar: "أحمد", en: "Ahmed" }, { ar: "سارة", en: "Sarah" }
  ];
  const toPlaces = [
    { ar: "إلى المدرسة", en: "to the school" }, { ar: "إلى المكتبة", en: "to the library" },
    { ar: "إلى المتحف", en: "to the museum" }, { ar: "إلى السوق", en: "to the market" }
  ];
  const atPlaces = [
    { ar: "في البيت", en: "at home" }, { ar: "في المطعم", en: "at the restaurant" },
    { ar: "في الصف", en: "in class" }, { ar: "في الحديقة", en: "at the park" }
  ];
  const times = [
    { ar: "صباحًا", en: "in the morning" }, { ar: "مساءً", en: "in the evening" },
    { ar: "بعد الظهر", en: "in the afternoon" }, { ar: "اليوم", en: "today" }
  ];
  const want = difficulty === "short" ? 1 : difficulty === "hard" ? 3 : 2;
  const picked = vocab.slice(0); // shallow copy
  const must = picked.length ? choice(picked) : null;

  // motion frame or stative frame randomly
  const subj = choice(people);
  let ar, en;
  if (Math.random() < 0.5) {
    const place = choice(toPlaces);
    ar = `${subj.ar} ذهب ${place.ar} ${choice(times).ar}`.trim();
    en = `${subj.en[0].toUpperCase() + subj.en.slice(1)} went ${place.en} ${choice(times).en}`.trim();
  } else {
    const place = choice(atPlaces);
    ar = `${subj.ar} قرأ كتابًا ${place.ar} ${choice(times).ar}`.trim();
    en = `${subj.en[0].toUpperCase() + subj.en.slice(1)} read a book ${place.en} ${choice(times).en}`.trim();
  }

  if (direction === "ar2en") {
    return { prompt: ar, answer: en, tokens: must ? [must.ar] : [] };
  } else {
    return { prompt: en, answer: ar, tokens: must ? [must.en] : [] };
  }
}

/** ---------- OpenAI-powered generator ---------- **/
async function generateWithOpenAI({ direction, difficulty, scopedVocab, model = "gpt-4o-mini" }) {
  if (!OpenAI || !process.env.OPENAI_API_KEY) {
    return { usedFallback: true, ...localFallback({ direction, difficulty, vocab: scopedVocab }) };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // difficulty → constraints
  const diffRules = {
    short:  { min: 4, max: 7,  minGloss: 1, hint: "simple clause" },
    medium: { min: 6, max: 8,  minGloss: 2, hint: "one informative clause" },
    hard:   { min: 8, max: 14, minGloss: 3, hint: "two related clauses with a connector like ثم/ولكن" }
  }[difficulty] || { min: 6, max: 8, minGloss: 2, hint: "one informative clause" };

  // pass a small list of target tokens the model should include (Arabic forms only)
  const arTokens = scopedVocab.map(v => v.ar);
  const enTokens = scopedVocab.map(v => v.en);

  const response = await client.chat.completions.create({
    model,
    temperature: 0.7,
    max_tokens: 180,
    // Ask the model to return strict JSON
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
`You generate natural Arabic/English practice sentences for DLI-style learners.
Return ONLY a compact JSON object with:
{ "prompt": string, "answer": string, "tokens": string[] }.
- If direction="ar2en": "prompt" MUST be Arabic and "answer" MUST be English.
- If direction="en2ar": "prompt" MUST be English and "answer" MUST be Arabic.
- Make the sentence meaningful and grammatical (no "ذهب في ..."). Use "إلى" for motion destinations; use "في" for stative locations.
- Length target: between MIN_WORDS and MAX_WORDS words in the PROMPT language.
- Include at least MIN_GLOSSARY tokens (from 'glossaryTokens') in the PROMPT language; keep them intact (no inflection if that would change spelling).
- Avoid repeating the same template. Vary verbs, places, objects, time adverbials, and connectors according to the hint.`.replace("MIN_WORDS","").replace("MAX_WORDS","").replace("MIN_GLOSSARY","")
      },
      {
        role: "user",
        content: JSON.stringify({
          direction,
          difficulty,
          constraints: {
            minWords: diffRules.min,
            maxWords: diffRules.max,
            minGlossary: diffRules.minGloss,
            hint: diffRules.hint
          },
          // The model must pick tokens in the prompt language
          glossaryTokens: direction === "ar2en" ? arTokens : enTokens,
          examples: {
            // a couple of “style anchors” (not to be copied verbatim)
            ar2en: [
              { prompt: "قابلَ أحمد صديقَه في الحديقة مساءً.", answer: "Ahmed met his friend in the park in the evening." },
              { prompt: "ذهبتِ الطالبة إلى المكتبة بعد الظهر.", answer: "The female student went to the library in the afternoon." }
            ],
            en2ar: [
              { prompt: "The officer visited the museum yesterday.", answer: "زار الضابط المتحف أمس." },
              { prompt: "My sister drank tea at home in the evening.", answer: "شربت أختي الشاي في البيت مساءً." }
            ]
          }
        })
      }
    ]
  });

  let obj;
  try {
    obj = JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch {
    return { usedFallback: true, ...localFallback({ direction, difficulty, vocab: scopedVocab }) };
  }

  // Basic validation / trimming
  const promptTxt = String(obj.prompt || "").trim();
  const answerTxt = String(obj.answer || "").trim();
  const tokens = Array.isArray(obj.tokens) ? obj.tokens.slice(0, 6) : [];

  if (!promptTxt || !answerTxt) {
    return { usedFallback: true, ...localFallback({ direction, difficulty, vocab: scopedVocab }) };
  }

  return { prompt: promptTxt, answer: answerTxt, tokens, usedFallback: false };
}

/** ---------- Route ---------- **/
export default async (req, res) => {
  noStore(res);
  try {
    const body = await new Promise(resolve => {
      let b = ""; req.on("data", c => b += c); req.on("end", () => resolve(b || "{}"));
    });
    const { direction = "ar2en", difficulty = "medium", scope = {} } = JSON.parse(body || "{}");

    const gloss = loadGlossary();
    const { vocab: scopedVocab, used } = scopeFromBody(gloss, scope);

    const out = await generateWithOpenAI({ direction, difficulty, scopedVocab });

    return res.status(200).json({
      ok: true,
      provider: out.usedFallback ? "local-fallback" : "openai",
      version: "sb-openai-2025-09-10",
      direction,
      difficulty,
      scopeUsed: used,
      prompt: out.prompt,
      answer: out.answer,
      tokens: out.tokens
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
