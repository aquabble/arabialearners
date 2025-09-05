export const config = { runtime: "nodejs" };
  import { createRequire } from 'module';
  const require = createRequire(import.meta.url);
  try { require("./Glossary.json"); } catch {}

  const { loadGlossary, extractLexicon, makeSimpleSentences, postJSON } = require("./_lib.cjs");

  function difficultyToTemp(difficulty){
    const d = String(difficulty||"").toLowerCase();
    if (d === "short" || d === "easy") return 0.2;
    if (d === "hard") return 0.9;
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

  function wc(s){ return String(s||"").trim().split(/\s+/).filter(Boolean).length; }

  function countLex(text, lex, lang){
    const t = String(text||"");
    let n = 0;
    for (const v of (lex||[])) {
      const term = String((lang === "en" ? v?.en : v?.ar) || "").trim();
      if (!term) continue;
      if (t.includes(term)) n++;
    }
    return n;
  }

  function validateItems(items, difficulty, direction, lex){
    const d = String(difficulty||"").toLowerCase();
    let min=4,max=7,minLex=1, langPrompt = (direction==="en2ar" ? "en" : "ar");
    if (d === "medium") { min=6; max=8; minLex=2; }
    else if (d === "hard") { min=8; max=14; minLex=2; }

    const out = [];
    for (const it of (items||[])) {
      const p = String(it?.prompt||"");
      const a = String(it?.answer||"");
      const okLen = wc(p)>=min && wc(p)<=max && wc(a)>=min && wc(a)<=max;
      const used = countLex(p, lex, langPrompt);
      const okLex = used >= minLex;
      if (okLen && okLex) out.push(it);
    }
    return out;
  }

  async function generateWithLLM({ lex, size, direction, difficulty }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const temp = difficultyToTemp(difficulty);
    const sampleLex = (lex || []).slice(0, 60);

    const sys = `You are an Arabic ↔ English tutor. Output ONLY valid JSON:
{"items":[{"prompt":"<string>","answer":"<string>","ar":"<string>","en":"<string>"}]}

DIFFICULTY RULES:
- "short": each sentence 4–7 words, include ≥1 term from LEX (in the prompt language).
- "medium": each sentence 6–8 words, include ≥2 terms from LEX (in the prompt language).
- "hard": each sentence 8–14 words, usually a complex sentence (e.g., with "because/when/that"), include ≥2 terms from LEX (in the prompt language).

GENERAL:
- Sentences should be natural and meaningful; including a person is recommended but optional.
- DIRECTION "ar2en": prompt is Arabic sentence, answer is the English translation.
- DIRECTION "en2ar": prompt is English sentence, answer is the Arabic translation.
- Use vocabulary from LEX; keep A1–A2 language unless "hard".
- Do NOT add commentary; return only the JSON.`;

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
        const prompt = String(it.prompt || (direction === "en2ar" ? (en || "") : (ar || "")));
        const answer = String(it.answer || (direction === "en2ar" ? (ar || "") : (en || "")));
        return { prompt, answer, ar, en };
      });

      const checked = validateItems(items, difficulty, direction, lex);
      return checked.length ? checked : null;
    } catch {
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
      let { difficulty="medium", unit="", chapter="", size=5, direction="ar2en" } = body || {};
      if (difficulty === "easy") difficulty = "short";

      const { data } = loadGlossary();
      const lex = extractLexicon(data, unit, chapter);

      let items = await generateWithLLM({ lex, size, direction, difficulty });
      if (!items || !items.length) {
        items = makeSimpleSentences(lex, { size, direction, difficulty });
      }

      res.status(200).json({
        ok: true,
        meta: { size, difficulty, direction, llm: !!(items && process.env.OPENAI_API_KEY) },
        items
      });
    } catch (e) {
      res.status(500).json({ ok:false, error:String(e?.message||e) });
    }
  }
