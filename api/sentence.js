import OpenAI from "openai";

export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- LOAD VOCAB FROM STATIC FILE ---
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

// --- FLATTEN THE USER'S SCHEMA ---
// Expected shape (simplified):
// { semester: 1, units: [ { unit: { id, name, chapters: [ { id, name, vocab: [ { ar, en }, ... ] } ] } }, ... ] }
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
          pos: "",                 // no POS field in this schema
          unit: unitName,
          chapter: chapterName,
        });
      }
    }
  }
  return out;
}

// --- PICK 1-3 FOCUS WORDS ---
function pickFocusWords(vocab) {
  if (!vocab.length) return [];
  const picks = new Set();
  while (picks.size < Math.min(3, vocab.length)) {
    const rnd = vocab[Math.floor(Math.random() * vocab.length)].ar;
    picks.add(rnd);
    if (picks.size >= 2) break;
  }
  return Array.from(picks);
}

export default async function handler(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { stage = "SVO", unit = "All", chapter = "All" } = body;

    const raw = await loadSemester(req);
    const all = normalizeVocab(raw);
    if (!all.length) {
      return new Response(JSON.stringify({ error: "semester1.json loaded but had no usable entries for this schema" }), { status: 400 });
    }

    // Filter by unit/chapter
    let pool = all;
    if (unit && unit !== "All") pool = pool.filter(w => w.unit === unit);
    if (chapter && chapter !== "All") pool = pool.filter(w => w.chapter === chapter);
    if (!pool.length) pool = all; // graceful fallback

    const focusWords = pickFocusWords(pool);

    const system = `You generate short Arabic ↔ English pairs for learners.
Return STRICT JSON: {"ar":"...","en":"...","tokens":["S","V","O","Time"]}.
Constraints:
- CEFR A1–A2 level
- Stage indicates structure: SV, SVO, or SVO+Time
- You MUST include EACH of these Arabic focus words exactly once: ${focusWords.join(", ")}
- You MAY add short function words for naturalness (في، على، من، إلى، مع، هذا، هذه)
- Prefer un-diacritized Arabic unless needed for clarity
- Keep sentences natural and short.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.6,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ stage, focusWords, unit, chapter }) },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
