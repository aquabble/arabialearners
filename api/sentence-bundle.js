export const config = { runtime: "nodejs22.x" };
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadGlossary, extractLexicon, makeSimpleSentences, postJSON } = require("./_lib.cjs");

function difficultyToTemp(difficulty){
  const d = String(difficulty||"").toLowerCase();
  if (d.includes("easy")) return 0.2;
  if (d.includes("hard")) return 0.9;
  return 0.5;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
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
- Keep sentences short and CEFR A1–A2 unless difficulty=hard.
- Prefer provided LEX terms; avoid rare words.`;

  const user = JSON.stringify({
    size: Math.max(1, Math.min(50, Number(size||5))),
    direction: direction || "ar2en",
    difficulty: difficulty || "medium",
    lex: sampleLex
  });

  try {
    const r = await postJSON(`${baseURL}/chat/completions`, {
      model,
      temperature: temp,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    }, {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    });

    if (!r?.ok) return null;
    const content = String(r?.json?.choices?.[0]?.message?.content || "{}");
    let parsed; try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const arr = Array.isArray(parsed?.items) ? parsed.items : [];
    const items = arr.map((it) => {
      const ar = String(it.ar || it.AR || it.target || "").trim();
      const en = String(it.en || it.EN || it.gloss || "").trim();
      return (direction === "en2ar")
        ? { prompt: en, answer: ar, ar, en }
        : { prompt: ar, answer: en, ar, en };
    });
    return items.length ? items : null;
  } catch (e) {
    console.error("LLM gen error", e);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  try {
    const body = await readBody(req);
    const { difficulty="medium", unit="", chapter="", size=5, direction="ar2en" } = body || {};

    const { data } = loadGlossary();
    const lex = extractLexicon(data, unit, chapter);

    let items = await generateWithLLM({ lex, size, direction, difficulty });
    if (!items || !items.length) items = makeSimpleSentences(lex, { size, direction, difficulty });

    res.status(200).json({ ok:true, meta:{ difficulty, direction, llm: !!(items && process.env.OPENAI_API_KEY) }, items });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
}
