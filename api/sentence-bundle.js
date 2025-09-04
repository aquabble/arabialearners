
const { loadGlossary, extractLexicon, makeSimpleSentences, postJSON } = require("./_lib.js");

function readBody(req) {
  return new Promise((resolve) => {
    try {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        try { resolve(JSON.parse(data || "{}")); }
        catch { resolve({}); }
      });
    } catch (e) {
      resolve({});
    }
  });
}

function send(res, code, obj) {
  try {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end(JSON.stringify(obj));
  } catch (e) {
    console.error("send error", e);
  }
}

function difficultyToTemp(diff) {
  const d = String(diff || "").toLowerCase();
  if (d.includes("easy")) return 0.3;
  if (d.includes("hard") || d.includes("difficult")) return 0.9;
  return 0.6;
}

async function generateWithLLM({ lex, size, direction, difficulty }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const temp = difficultyToTemp(difficulty);
  const sampleLex = (lex || []).slice(0, 80);

  const sys = `You are a language tutor bot. Produce only valid JSON with this shape:
{"items":[{"prompt":"<string>","answer":"<string>","ar":"<string>","en":"<string>"}...]}
Rules:
- Length: exactly SIZE items.
- Direction:
  - "ar2en": prompt is Arabic, answer is English.
  - "en2ar": prompt is English, answer is Arabic.
- Each item must include both "ar" and "en" fields (the bilingual pair).
- Keep sentences short, concrete, and CEFR A1-A2 unless difficulty=hard, then A2-B1.
- Prefer using the provided vocabulary when possible. Stay simple and grammatical.
- Do not include any additional commentary.`;

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

  const r = await postJSON(`${baseURL}/chat/completions`, body, {
    "Authorization": `Bearer ${apiKey}`
  });

  if (!r || !r.ok) {
    console.error("OpenAI call failed", r && r.status, r && r.text);
    return null;
  }
  const data = r.json || {};
  const content = data?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try { parsed = JSON.parse(content); } catch { parsed = {}; }
  let items = Array.isArray(parsed.items) ? parsed.items : [];

  items = items.slice(0, size).map(it => {
    const ar = String(it.ar || it.AR || it.target || "").trim();
    const en = String(it.en || it.EN || it.gloss || "").trim();
    const pair = direction === "en2ar"
      ? { prompt: en, answer: ar, ar, en }
      : { prompt: ar, answer: en, ar, en };
    return pair;
  });

  return items.length ? items : null;
}

async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, { ok: true });
    if (req.method !== "POST") return send(res, 405, { ok:false, error:"Method Not Allowed" });

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

    let items = await generateWithLLM({ lex, size, direction, difficulty });
    if (!items || !items.length) {
      items = makeSimpleSentences(lex, { size, direction, difficulty });
    }

    return send(res, 200, {
      ok: true,
      meta: {
        usedLexicon: lex.length,
        unit,
        chapter,
        difficulty,
        direction,
        llm: !!(items && items.length && process.env.OPENAI_API_KEY)
      },
      items
    });
  } catch (e) {
    console.error("sentence-bundle fatal", e);
    return send(res, 200, { ok:false, error:String(e && e.message || e) });
  }
}

module.exports = handler;
module.exports.default = handler;
