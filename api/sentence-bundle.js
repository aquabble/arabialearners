
/**
 * POST /api/sentence-bundle
 * Body: { difficulty, unit, chapter, size, direction }
 * Returns: { ok:true, items:[{prompt,answer,ar,en}] }
 *
 * This version calls OpenAI (chat.completions) when OPENAI_API_KEY is set,
 * and falls back to a local generator on failure.
 */
const { loadGlossary, extractLexicon, makeSimpleSentences } = require("./_lib.js");

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve({}); }
    });
  });
}

function difficultyToTemp(diff) {
  const d = String(diff || "").toLowerCase();
  if (d.includes("easy")) return 0.3;
  if (d.includes("hard") || d.includes("difficult")) return 0.9;
  return 0.6; // medium/default
}

async function generateWithLLM({ lex, size, direction, difficulty }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const temp = difficultyToTemp(difficulty);

  // Keep vocab small to avoid huge prompts
  const sampleLex = (lex || []).slice(0, 80);

  const sys = `
You are a language tutor bot. Produce only valid JSON with this shape:
{"items":[{"prompt":"<string>","answer":"<string>","ar":"<string>","en":"<string>"}...]}

Rules:
- Length: exactly SIZE items.
- Direction:
  - "ar2en": prompt is Arabic, answer is English.
  - "en2ar": prompt is English, answer is Arabic.
- Each item must include both "ar" and "en" fields (the bilingual pair).
- Keep sentences short, concrete, and CEFR A1-A2 unless difficulty=hard, then A2-B1.
- Prefer using the provided vocabulary when possible. Stay simple and grammatical.
- Do not include any additional commentary.
  `.trim();

  const user = {
    task: "Make bilingual sentence pairs for practice",
    size,
    direction,
    difficulty,
    vocabulary: sampleLex,
    constraints: {
      maxWordsPerSentence: (String(difficulty||"").toLowerCase().includes("hard") ? 14 : 9)
    }
  };

  const body = {
    model,
    response_format: { type: "json_object" },
    temperature: temp,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: JSON.stringify(user) }
    ]
  };

  try {
    const r = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("OpenAI error status:", r.status, txt);
      return null;
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    let items = Array.isArray(parsed.items) ? parsed.items : [];

    // Normalize & clamp
    items = items.slice(0, size).map(it => {
      const ar = String(it.ar || it.AR || it.target || "").trim();
      const en = String(it.en || it.EN || it.gloss || "").trim();
      const pair = direction === "en2ar"
        ? { prompt: en, answer: ar, ar, en }
        : { prompt: ar, answer: en, ar, en };
      return pair;
    });

    // If result is weak, return null to trigger local fallback
    if (!items.length) return null;
    return items;

  } catch (e) {
    console.error("OpenAI call failed:", e);
    return null;
  }
}

module.exports = async (req, res) => {
  // CORS for dev convenience
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  const body = await readBody(req);
  const {
    difficulty = "medium",
    unit = "",
    chapter = "",
    size = 5,
    direction = "ar2en"
  } = body || {};

  const { data } = loadGlossary();
  const lex = extractLexicon(data, unit, chapter);

  // Try LLM first
  const llmItems = await generateWithLLM({ lex, size, direction, difficulty });

  const items = llmItems && llmItems.length
    ? llmItems
    : makeSimpleSentences(lex, { size, direction, difficulty });

  res.status(200).json({
    ok: true,
    meta: {
      usedLexicon: lex.length,
      unit,
      chapter,
      difficulty,
      direction,
      llm: !!llmItems
    },
    items
  });
};
