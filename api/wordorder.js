import OpenAI from "openai";
export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function loadSemester(req) {
  const host = req.headers.get("host");
  const urls = [
    `https://${host}/semester1.json`,
    `https://${host}/data/semester1.json`
  ];
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return await res.json();
  }
  throw new Response(JSON.stringify({ error: "semester1.json not found in known paths", tried: urls }), { status: 400 });
}

function normalizeVocab(raw) {
  const out = [];
  const units = Array.isArray(raw?.units) ? raw.units : [];
  for (const u of units) {
    const U = u?.unit;
    if (!U) continue;
    const unitName = (U.name || U.id || "Unit").toString();
    const chapters = Array.isArray(U.chapters) ? U.chapters : [];
    for (const ch of chapters) {
      const chapterName = (ch?.name || ch?.id || "").toString() || null;
      const vocab = Array.isArray(ch?.vocab) ? ch.vocab : [];
      for (const item of vocab) {
        const ar = (item && (item.ar || item.arabic || item.word)) || "";
        const en = (item && (item.en || item.english || item.translation || item.gloss)) || "";
        const AR = String(ar).trim();
        if (!AR) continue;
        out.push({ ar: AR, en: String(en || "").trim(), unit: unitName, chapter: chapterName });
      }
    }
  }
  return out;
}

function pickFocus(vocab, k = 3) {
  if (!vocab.length) return [];
  const picks = new Set();
  while (picks.size < Math.min(k, vocab.length)) {
    picks.add(vocab[Math.floor(Math.random() * vocab.length)].ar);
    if (picks.size >= 2) break;
  }
  return Array.from(picks);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function handler(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const { stage = "SVO", unit = "All", chapter = "All", direction = "ar2en" } = body;

    const raw = await loadSemester(req);
    const all = normalizeVocab(raw);
    if (!all.length) {
      return new Response(JSON.stringify({ error: "No vocab entries found" }), { status: 400 });
    }

    let pool = all;
    if (unit && unit !== "All") pool = pool.filter(w => w.unit === unit);
    if (chapter && chapter !== "All") pool = pool.filter(w => w.chapter === chapter);
    if (!pool.length) pool = all;

    const focusWords = pickFocus(pool);

    const system = `You generate short Arabic ↔ English pairs for a WORD ORDER game.
Return STRICT JSON: {"ar":"...","en":"..."}.
Constraints:
- CEFR A1–A2
- Stage: ${stage} (SV, SVO, or SVO+Time)
- Use EACH of these Arabic focus words exactly once: ${focusWords.join(", ")}
- Prefer undiacritized Arabic unless needed
- Keep sentences short and natural.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ stage, focusWords, unit, chapter }) }
      ],
      max_tokens: 180
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    let pair;
    try { pair = JSON.parse(content) } catch { pair = {} }
    const ar = String(pair?.ar || "").trim();
    const en = String(pair?.en || "").trim();
    if (!ar || !en) {
      return new Response(JSON.stringify({ error: "Model returned empty ar/en" }), { status: 400 });
    }

    // Tokenize: Arabic by space (keeps punctuation as part of tokens), English by spaces
    const tokensAr = ar.split(/\s+/).filter(Boolean);
    const tokensEn = en.split(/\s+/).filter(Boolean);

    // Shuffle for the game
    const shuffledAr = shuffle(tokensAr);
    const shuffledEn = shuffle(tokensEn);

    return new Response(JSON.stringify({
      ar, en,
      tokensAr,
      tokensEn,
      shuffledAr,
      shuffledEn
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
