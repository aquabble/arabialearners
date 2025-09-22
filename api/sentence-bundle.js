// api/sentence-bundle.js
export const config = { runtime: "edge" };

/** ---- Small helpers ---- **/
function corsHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders() });
}

/** ---- Arabic normalization & validation helpers (namespaced to avoid collisions) ---- **/
const __AL_HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g; // Arabic diacritics
const __alNormAr = (s) =>
  String(s || "")
    .normalize("NFC")
    .replace(__AL_HARAKAT, "")
    .replace(/[\u061B\u061F\u060C]/g, " ") // ؛ ؟ ،
    .replace(/[\.!\?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const __alToks = (s) => __alNormAr(s).split(/\s+/).filter(Boolean);

function __alCountVocabInclusion(text, vocab) {
  const t = ` ${__alNormAr(text)} `;
  let count = 0;
  for (const v of Array.isArray(vocab) ? vocab : []) {
    const needle = __alNormAr(v?.ar || v?.word || "");
    if (!needle) continue;
    const wrapped = ` ${needle} `;
    if (t.includes(wrapped) || t.startsWith(wrapped.trim() + " ") || t.endsWith(" " + wrapped.trim())) {
      count++;
    }
  }
  return count;
}

/** ---- Difficulty policy ---- **/
const DIFF = {
  short: { totalMin: 4, totalMax: 7, mustInclude: 1 },
  medium: { totalMin: 6, totalMax: 8, mustInclude: 2 },
  hard: { totalMin: 8, totalMax: 14, mustInclude: 3 },
};

function pickDifficulty(d) {
  return DIFF[d] || DIFF.medium;
}

/** ---- Fetch & scope vocab from public Glossary ---- **/
async function loadGlossaryFromPublic(origin) {
  // Fetch public/Glossary.json (synced from src/lib/Glossary.json in your build)
  const url = new URL("/Glossary.json", origin).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load Glossary.json (${res.status})`);
  return res.json();
}

function normalizeVocabArray(vlist) {
  // Accept ["كلمة", ...] or [{ar,en/gloss,word}, ...] -> normalize to {ar,en}
  return (Array.isArray(vlist) ? vlist : [])
    .map((v) =>
      typeof v === "string"
        ? { ar: v, en: "" }
        : { ar: v?.ar ?? v?.word ?? "", en: v?.en ?? v?.gloss ?? "" }
    )
    .filter((v) => v.ar && typeof v.ar === "string");
}

function scopeVocab(glossary, semesterId, unitId, chapterId) {
  const semesters = glossary?.semesters || [];
  const s = semesters.find((x) => x.id === semesterId);
  const u = s?.units?.find((x) => x.id === unitId);
  const c = u?.chapters?.find((x) => x.id === chapterId);

  // Most specific first
  if (c?.vocab?.length) {
    const v = normalizeVocabArray(c.vocab);
    if (v.length) return v;
  }
  if (u?.chapters?.length) {
    const v = u.chapters.flatMap((cc) => normalizeVocabArray(cc?.vocab));
    if (v.length) return v;
  }
  // Fallback: all chapters of all units of semester
  if (s?.units?.length) {
    const v = s.units.flatMap((uu) => (uu?.chapters || []).flatMap((cc) => normalizeVocabArray(cc?.vocab)));
    if (v.length) return v;
  }
  // Global fallback: everything in glossary
  return semesters.flatMap((ss) =>
    (ss?.units || []).flatMap((uu) => (uu?.chapters || []).flatMap((cc) => normalizeVocabArray(cc?.vocab)))
  );
}

/** ---- Random helpers ---- **/
function sampleN(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}

/** ---- Local sentence generator (enforces difficulty + vocab inclusion) ---- **/
function localGenerate({ vocab, difficulty = "medium" }) {
  const policy = pickDifficulty(difficulty);
  const must = Math.min(policy.mustInclude, vocab.length || 0);

  const chosen = sampleN(vocab, must);

  const fillers = [
    "اليوم",
    "غدًا",
    "أمس",
    "الآن",
    "عادةً",
    "أحيانًا",
    "في البيت",
    "في المدرسة",
    "في السوق",
    "في العمل",
    "مع صديقي",
    "مع عائلتي",
    "من فضلك",
    "لأن",
    "لكن",
  ];

  const subjects = ["أنا", "أنت", "هو", "هي", "نحن", "الطالب", "المدرس", "الصديق", "الجار", "الأب", "الأم"];
  const verbs = ["يقرأ", "يكتب", "يشاهد", "يزور", "يحب", "يشتري", "يحتاج", "يسأل", "يجد", "يفضّل", "يخطط"];

  const subject = subjects[(Math.random() * subjects.length) | 0];
  const verb = verbs[(Math.random() * verbs.length) | 0];
  const filler = Math.random() < 0.7 ? fillers[(Math.random() * fillers.length) | 0] : "";

  const vocabTokens = chosen.map((t) => t.ar);
  let tokens = [subject, verb];
  if (filler) tokens.push(filler);
  for (const t of vocabTokens) tokens.push(t);

  // Pad to target range
  const target = policy.totalMin + ((Math.random() * (policy.totalMax - policy.totalMin + 1)) | 0);
  while (tokens.length < target) {
    const f = fillers[(Math.random() * fillers.length) | 0];
    if (tokens[tokens.length - 1] !== f) tokens.push(f);
  }
  if (tokens.length > policy.totalMax) {
    tokens = tokens.slice(0, policy.totalMax);
  }

  const sentence = tokens.join(" ").replace(/\s+/g, " ").trim() + " .";
  const inclusion = __alCountVocabInclusion(sentence, chosen);
  if (inclusion < must) {
    // Make sure we hit inclusion; if not, append one missing token once
    for (const v of chosen) {
      if (__alCountVocabInclusion(sentence, [v]) === 0) {
        tokens.push(v.ar);
        break;
      }
    }
  }
  return {
    prompt: tokens.join(" ").replace(/\s+/g, " ").trim() + " .",
    answer: chosen.length ? `Includes: ${chosen.map((t) => t.en || t.ar).join(", ")}` : "Translate the sentence to English.",
    vocabUsed: chosen,
  };
}

/** ---- Optional OpenAI generator with validation & fallback ---- **/
async function openAIGenerate({ vocab, difficulty = "medium" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const policy = pickDifficulty(difficulty);
  const required = sampleN(vocab, Math.min(vocab.length, policy.mustInclude));
  const reqAr = required.map((t) => `- ${t.ar}${t.en ? ` (${t.en})` : ""}`).join("\n");
  const totalHint =
    difficulty === "short" ? "4-7" : difficulty === "hard" ? "8-14" : "6-8";

  const body = {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You produce a single, natural Arabic sentence for students. It must be meaningful and not generic. Do not include any explanation—only the Arabic sentence.",
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

  // Validate difficulty & inclusion; else signal caller to fallback
  const tokenCount = __alToks(text).length;
  const inclusion = __alCountVocabInclusion(text, required);
  if (tokenCount < policy.totalMin || tokenCount > policy.totalMax || inclusion < required.length) {
    return null;
  }

  return {
    prompt: text.endsWith("۔") || text.endsWith(".") ? text : text + " .",
    answer: "Translate the sentence to English.",
    vocabUsed: required,
  };
}

/** ---- Handler ---- **/
export default async function handler(request) {
  if (request.method === "OPTIONS") return jsonResponse({}, 200);

  try {
    const body = await request.json().catch(() => ({}));
    const difficulty = String(body?.difficulty || "medium").toLowerCase();
    const semesterId = body?.semesterId || body?.semester || body?.semesterID || body?.sem || "S1";
    const unitId = body?.unitId || body?.unit || body?.unitID || body?.uni || "";
    const chapterId = body?.chapterId || body?.chapter || body?.chapterID || body?.chap || "";

    const origin = new URL(request.url).origin;
    const glossary = await loadGlossaryFromPublic(origin);
    const scopedVocab = scopeVocab(glossary, semesterId, unitId, chapterId);

    // Try OpenAI first (if configured), then local fallback
    let bundle = null;
    try {
      bundle = await openAIGenerate({ vocab: scopedVocab, difficulty });
    } catch {
      // ignore and fallback
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
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e?.message || e) }, 500);
  }
}
