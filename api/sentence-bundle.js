import OpenAI from "openai";

export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Reuse the same flattening logic you have in /api/sentence.js
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
        out.push({
          ar: AR,
          en: String(en || "").trim(),
          unit: unitName,
          chapter: chapterName,
        });
      }
    }
  }
  return out;
}

function pickFocus(vocab, k=3) {
  if (!vocab.length) return [];
  const picks = new Set();
  while (picks.size < Math.min(k, vocab.length)) {
    picks.add(vocab[Math.floor(Math.random()*vocab.length)].ar);
  }
  return Array.from(picks);
}

export default async function handler(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), { status: 400 });
    }
    const body = await req.json().catch(()=>({}));
    const { stage="SVO", unit="All", chapter="All", count=5 } = body;

    const raw = await loadSemester(req);
    const all = normalizeVocab(raw);
    if (!all.length) {
      return new Response(JSON.stringify({ error: "No vocab entries found" }), { status: 400 });
    }

    let pool = all;
    if (unit && unit !== "All") pool = pool.filter(w => w.unit === unit);
    if (chapter && chapter !== "All") pool = pool.filter(w => w.chapter === chapter);
    if (!pool.length) pool = all;

    // Build K focus groups to reduce round trips
    const tasks = Array.from({length: Math.max(1, Math.min(10, count))}, () => pickFocus(pool, 3));

    const system = `You generate Arabic↔English pairs for learners.
Return STRICT JSON ARRAY where each item is: {"ar":"...", "en":"...", "tokens":["S","V","O","Time"]}.
Constraints:
- CEFR A1–A2
- Stage: ${stage} (SV, SVO, or SVO+Time)
- For each item, include EACH provided Arabic focus word exactly once
- Prefer no diacritics unless needed; keep sentences short.`;

    const user = { stage, unit, chapter, bundles: tasks };

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ],
      // modest cap to reduce latency
      max_tokens: 320
    });

    // Expecting: {"items":[{...},{...}]}
    const content = completion.choices?.[0]?.message?.content || "{}";
    let out;
    try { out = JSON.parse(content); } catch { out = {}; }
    const items = Array.isArray(out.items) ? out.items : out.items ? [out.items] : [];
    if (!items.length) {
      // fallback: try to build minimal one from the pool
      return new Response(JSON.stringify({ items: [] }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
