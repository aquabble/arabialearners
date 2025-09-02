import OpenAI from "openai";

export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Load semester1.json from your app host (works in dev and prod). */
async function loadSemester(req) {
  const host = req.headers.get("host") || "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const proto = isLocal ? "http" : "https";
  const urls = [
    `${proto}://${host}/semester1.json`,
    `${proto}://${host}/data/semester1.json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {}
  }
  throw new Error(`semester1.json not found; tried: ${urls.join(", ")}`);
}

/** Flatten the units/chapters/vocab into a simple array. */
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

/** Choose k random Arabic focus words from the pool (>=2). */
function pickFocus(vocab, k = 3) {
  if (!vocab.length) return [];
  const picks = new Set();
  while (picks.size < Math.min(k, vocab.length)) {
    picks.add(vocab[Math.floor(Math.random() * vocab.length)].ar);
    if (picks.size >= 2) break; // keep sentences short
  }
  return Array.from(picks);
}

export default async function handler(req) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), { status: 400, headers });
    }

    const body = await req.json().catch(() => ({}));
    const { stage = "SVO", unit = "All", chapter = "All", count = 5, scopeKey = "" } = body;

    const raw = await loadSemester(req);
    const all = normalizeVocab(raw);
    if (!all.length) {
      return new Response(JSON.stringify({ error: "No vocab entries found", scopeKey }), { status: 400, headers });
    }

    // Filter by unit/chapter, with graceful fallback to all
    let pool = all;
    if (unit && unit !== "All") pool = pool.filter(w => w.unit === unit);
    if (chapter && chapter !== "All") pool = pool.filter(w => w.chapter === chapter);
    if (!pool.length) pool = all;

    // Build bundles of focus words (reduce round trips)
    const bundles = Array.from({ length: Math.max(1, Math.min(10, count)) }, () => pickFocus(pool, 3));

    const system = `You generate Arabic↔English pairs for learners.
Return STRICT JSON: {"items":[{"ar":"...","en":"...","tokens":["S","V","O","Time"]}, ...]}.
Constraints:
- CEFR A1–A2
- Stage: ${stage} (SV, SVO, or SVO+Time)
- For each item, include EACH provided Arabic focus word exactly once
- Prefer no diacritics unless needed; keep sentences short.`;

    const user = { stage, unit, chapter, bundles };

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.45,
      max_tokens: 360,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    let items = Array.isArray(parsed?.items) ? parsed.items : (Array.isArray(parsed) ? parsed : []);

    // Fallback so the UI never stalls if the model misbehaves
    if (!items.length) {
      const simple = [];
      for (let i = 0; i < Math.min(count, 5) && i < pool.length; i++) {
        const w = pool[Math.floor(Math.random() * pool.length)];
        simple.push({ ar: w.ar, en: w.en || "", tokens: ["S","V","O"] });
      }
      items = simple;
    }

    // Tag for sanity & echo scopeKey so the client can ignore stale responses
    const tagged = items.map(it => ({ ...it, unit, chapter }));

    return new Response(JSON.stringify({ items: tagged, scopeKey }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.stack || err) }), { status: 500, headers });
  }
}
