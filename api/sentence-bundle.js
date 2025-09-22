// api/sentence-bundle.js
export const config = { runtime: "edge" };

/** Small helper: consistent JSON response with permissive CORS (same-origin is fine, but this keeps flexibility) */
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });
}

// Arabic normalization helpers
const __AL_HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const __alNormAr = (s) => String(s||'')
  .normalize('NFC').replace(HARAKAT,'')
  .replace(/[\u061B\u061F\u060C]/g,' ')
  .replace(/[\.\!\?\,\;:]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();
const __alToks = (s) => __alNormAr(s).split(/\s+/).filter(Boolean);

function __alCountVocabInclusion(text, vocab){
  const t = __alNormAr(text);
  let count = 0;
  for(const v of (vocab||[])){
    const needle = __alNormAr(v.ar||v.word||'');
    if (needle && (t.includes(' '+needle+' ') || t.endsWith(' '+needle) || t.startsWith(needle+' ') || t === needle)) {
      count++;
    }
  }
  return count;
}

/** Parse JSON body safely */
async function readBody(request) {
  try {
    if (request.method === "GET") return {};
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/** Load the public Glossary.json from the same origin (Edge-friendly; no fs) */
async function loadGlossary(request) {
  try {
    const url = new URL("/Glossary.json", request.url);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Glossary fetch ${res.status}`);
    return await res.json();
  } catch (e) {
    return { type: "Glossary", semesters: [] };
  }
}

/** Traverse glossary to get vocab scoped to semester/unit/chapter */
function getScopedVocab(glossary, scope = {}) {
  const { semesterId, unitId, chapterId } = scope;
  const semesters = Array.isArray(glossary?.semesters) ? glossary.semesters : [];

  // Helper to normalize vocab entries: want { ar, en }
  const norm = (list) =>
    (Array.isArray(list) ? list : [])
      .map((v) =>
        typeof v === "string"
          ? { ar: v, en: "" }
          : { ar: v?.ar ?? v?.word ?? "", en: v?.en ?? v?.gloss ?? "" }
      )
      .filter((v) => v.ar && typeof v.ar === "string");

  // If fully scoped (S/U/C) grab that chapter vocab.
  if (semesterId && unitId && chapterId) {
    const chapVocab =
      semesters
        .find((s) => s.id === semesterId)?.units
        ?.find((u) => u.id === unitId)?.chapters
        ?.find((c) => c.id === chapterId)?.vocab;
    const v = norm(chapVocab);
    if (v.length) return v;
  }

  // If S + U only: concat all chapters
  if (semesterId && unitId) {
    const chapters =
      semesters
        .find((s) => s.id === semesterId)?.units
        ?.find((u) => u.id === unitId)?.chapters ?? [];
    const v = chapters.flatMap((c) => norm(c?.vocab));
    if (v.length) return v;
  }

  // If S only: concat all units/chapters
  if (semesterId) {
    const units = semesters.find((s) => s.id === semesterId)?.units ?? [];
    const v = units.flatMap((u) => (u?.chapters ?? []).flatMap((c) => norm(c?.vocab)));
    if (v.length) return v;
  }

  // Fallback: all vocab in the entire glossary
  const all = semesters.flatMap((s) =>
    (s?.units ?? []).flatMap((u) => (u?.chapters ?? []).flatMap((c) => norm(c?.vocab)))
  );
  return all;
}

/** Pick N unique random items from array */
function sampleN(arr, n) {
  const a = [...arr];
  const out = [];
  n = Math.max(0, Math.min(n, a.length));
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * a.length);
    out.push(a[idx]);
    a.splice(idx, 1);
  }
  return out;
}

/** Local sentence generator that guarantees vocab inclusion & difficulty bounds */
function localGenerate({ vocab, difficulty = "medium" }) {
  // difficulty spec: counts refer to Arabic token count *included* from vocab
  //   short:  4–7 words total, include ≥1 vocab
  //   medium: 6–8 words total, include ≥2 vocab
  //   hard:   8–14 words total, include ≥3 vocab (prefer complex)
  const DIFF = {
    short: { totalMin: 4, totalMax: 7, mustInclude: 1 },
    medium: { totalMin: 6, totalMax: 8, mustInclude: 2 },
    hard: { totalMin: 8, totalMax: 14, mustInclude: 3 },
  }[difficulty] ?? { totalMin: 6, totalMax: 8, mustInclude: 2 };

  // Safety: if vocab is too small, degrade mustInclude
  const must = Math.min(DIFF.mustInclude, vocab.length || 0);

  // Choose vocab items to include
  const chosen = sampleN(vocab, must);

  // Basic fillers (Arabic) to keep things meaningful but compact
  const fillers = [
    "اليوم", "غدًا", "أمس", "الآن", "عادةً", "أحيانًا",
    "في البيت", "في المدرسة", "في السوق", "في العمل",
    "مع صديقي", "مع عائلتي", "من فضلك", "لأن", "لكن"
  ];

  // Simple person/subject pool (user asked for meaningful sentences; person optional but common)
  const subjects = [
    "أنا", "أنت", "هو", "هي", "نحن", "الطالب", "المدرس", "الصديق", "الجار", "الأب", "الأم"
  ];
  const verbs = [
    "يقرأ", "يكتب", "يشاهد", "يزور", "يحب", "يشتري", "يحتاج", "يسأل", "يجد", "يفضّل", "يخطط"
  ];

  // Build a base skeleton: [subject] [verb] [filler] [vocab…]
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const filler = Math.random() < 0.7 ? fillers[Math.floor(Math.random() * fillers.length)] : "";

  // Compose tokens ensuring we include vocab.ar strings
  const vocabTokens = chosen.map((t) => t.ar);
  // Start with subject + verb
  let tokens = [subject, verb];
  if (filler) tokens.push(filler);
  // interleave vocab
  for (const t of vocabTokens) tokens.push(t);

  // Pad with extra fillers until within totalMin..totalMax
  const target = DIFF.totalMin + Math.floor(Math.random() * (DIFF.totalMax - DIFF.totalMin + 1));
  while (tokens.length < target) {
    const f = fillers[Math.floor(Math.random() * fillers.length)];
    // avoid duplicates right next to each other
    if (tokens[tokens.length - 1] !== f) tokens.push(f);
    else tokens.push("هناك");
  }

  // Produce an English gloss (very light) for answer: join selected vocab.en if available
  const glossParts = [];
  for (const t of chosen) {
    if (t.en) glossParts.push(t.en);
  }
  const answer = glossParts.length
    ? `Includes: ${glossParts.join(", ")}`
    : "Translate the sentence to English.";

  return {
    prompt: tokens.join(" ").replace(/\s+/g, " ").trim() + " .",
    answer,
    vocabUsed: chosen,
  };
}

/** OPTIONAL: OpenAI-backed generation that *still* enforces vocab inclusion */
async function openAIGenerate({ vocab, difficulty = "medium", systemLang = "ar" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Build a small, explicit instruction so the model MUST include certain tokens
  const required = sampleN(vocab, Math.min(vocab.length, { short:1, medium:2, hard:3 }[difficulty] ?? 2));
  const reqAr = required.map((t) => `- ${t.ar}${t.en ? ` (${t.en})` : ""}`).join("\n");

  const totalHint = { short: "4-7", medium: "6-8", hard: "8-14" }[difficulty] ?? "6-8";

  const body = {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You produce a single, natural Arabic sentence for students. It must be meaningful and not generic. Do not include transliteration.",
      },
      {
        role: "user",
        content: [
          `Difficulty: ${difficulty} (about ${totalHint} words total).`,
          `You MUST include these Arabic vocabulary tokens verbatim (choose exact surface form):`,
          reqAr,
          `Respond ONLY with the Arabic sentence, nothing else.`,
        ].join("\n"),
      },
    ],
    temperature: 0.6,
  };

  const res = await fetch(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  // Validate difficulty & vocab inclusion; if not satisfied, let caller fallback to local generator
  const di = { short:{min:4,max:7,must:1}, medium:{min:6,max:8,must:2}, hard:{min:8,max:14,must:3} }[difficulty] || {min:6,max:8,must:2};
  const tokenCount = __alToks(text).length;
  const inclusion = __alCountVocabInclusion(text, required);
  if (tokenCount < di.min || tokenCount > di.max || inclusion < di.must) {
    return null;
  }
  return {
    prompt: text.endsWith("۔") || text.endsWith(".") ? text : text + " .",
    answer: "Translate the sentence to English.",
    vocabUsed: required,
  };
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return jsonResponse({}, 200);

  const body = await readBody(request);
  const { difficulty = "medium", semesterId, unitId, chapterId } = body || {};

  const glossary = await loadGlossary(request);
  const scopedVocab = getScopedVocab(glossary, { semesterId, unitId, chapterId });

  if (!scopedVocab.length) {
    return jsonResponse(
      {
        ok: false,
        error: "NO_VOCAB_FOUND",
        note: "Check that Glossary.json has vocab arrays at the selected scope.",
        scope: { semesterId, unitId, chapterId },
      },
      200
    );
  }

  // Try OpenAI first if available; otherwise local generator
  let bundle = null;
  try {
    bundle = await openAIGenerate({ vocab: scopedVocab, difficulty });
  } catch {
    // fallthrough
  }
  if (!bundle) {
    bundle = localGenerate({ vocab: scopedVocab, difficulty });
  }

  return jsonResponse({
    ok: true,
    source: "edge",
    scope: { semesterId, unitId, chapterId, difficulty },
    prompt: bundle.prompt,
    answer: bundle.answer,
    vocabUsed: bundle.vocabUsed, // [{ar,en}]
  });
}

// Arabic normalization helpers
  .normalize('NFC').replace(HARAKAT,'')
  .replace(/[\u061B\u061F\u060C]/g,' ')
  .replace(/[\.\!\?\,\;:]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();

  const t = __alNormAr(text);
  let count = 0;
  for(const v of (vocab||[])){
    const needle = __alNormAr(v.ar||v.word||'');
    if (needle && (t.includes(' '+needle+' ') || t.endsWith(' '+needle) || t.startsWith(needle+' ') || t === needle)) {
      count++;
    }
  }
  return count;
}