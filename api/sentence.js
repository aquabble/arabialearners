import OpenAI from "openai";

export const config = { runtime: "edge" };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function loadSemesterVocab(req) {
  // Try to load /semester1.json from the app's public assets.
  // You should place your real Semester 1 vocab file at /public/semester1.json
  // The code supports several common shapes.
  const url = new URL("/semester1.json", req.url);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not load semester1.json at ${url}`);
  }
  const data = await res.json();
  return data;
}

// Normalize varied vocab file shapes into a flat [{ar, en, pos}] list.
function normalizeVocab(raw) {
  const out = [];
  const push = (ar, en, pos) => {
    if (!ar) return;
    const arStr = String(ar).trim();
    if (!arStr) return;
    out.push({ ar: arStr, en: en ? String(en).trim() : "", pos: pos ? String(pos).trim().toLowerCase() : "" });
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") push(item, "", "");
      else if (item && typeof item === "object") {
        push(item.ar || item.arabic || item.word || item.term, item.en || item.english || item.gloss, item.pos || item.tag || "");
      }
    }
    return out;
  }

  if (raw && typeof raw === "object") {
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string") push(item, "", k);
          else if (item && typeof item === "object") {
            push(item.ar || item.arabic || item.word || item.term, item.en || item.english || item.gloss, item.pos || item.tag || k);
          }
        }
      } else if (v && typeof v === "object") {
        // nested units: { unit1: { nouns:[...], verbs:[...] } }
        for (const kk of Object.keys(v)) {
          const arr = v[kk];
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (typeof item === "string") push(item, "", kk);
              else if (item && typeof item === "object") {
                push(item.ar || item.arabic || item.word || item.term, item.en || item.english || item.gloss, item.pos || item.tag || kk);
              }
            }
          }
        }
      }
    }
    return out;
  }

  return out;
}

function pickFocusWords(vocab) {
  if (!vocab.length) return [];
  // Prefer one verb + one noun if we can, else up to 2-3 random content words.
  const nouns = vocab.filter(v => /noun|اسم/i.test(v.pos) || (!v.pos && v.en && !/^(to\s)/i.test(v.en)));
  const verbs = vocab.filter(v => /verb|فعل/i.test(v.pos) || (v.en && /^to\s/i.test(v.en)));
  const adjs  = vocab.filter(v => /adj|صفة/i.test(v.pos));

  const picks = [];
  if (verbs.length) picks.push(verbs[Math.floor(Math.random()*verbs.length)].ar);
  if (nouns.length) picks.push(nouns[Math.floor(Math.random()*nouns.length)].ar);
  if (picks.length < 2 && adjs.length) picks.push(adjs[Math.floor(Math.random()*adjs.length)].ar);

  // Fallback randoms to reach 2 words
  while (picks.length < 2 && picks.length < vocab.length) {
    const rnd = vocab[Math.floor(Math.random()*vocab.length)].ar;
    if (!picks.includes(rnd)) picks.push(rnd);
  }

  // Cap at 3 to keep sentences short
  return picks.slice(0, 3);
}

export default async function handler(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { stage = "SVO", unit = null } = body;

    const raw = await loadSemesterVocab(req);
    const vocab = normalizeVocab(raw);
    if (!vocab.length) {
      throw new Error("semester1.json loaded but had no usable entries");
    }

    // TODO: if your JSON has units, filter by 'unit' here
    const focusWords = pickFocusWords(vocab);

    const system = `You generate short Arabic ↔ English pairs for learners.
Return STRICT JSON: {"ar":"...","en":"...","tokens":["S","V","O","Time"]}.
Constraints:
- CEFR A1–A2 level
- Stage indicates structure: SV, SVO, or SVO+Time
- You MUST include EACH of these Arabic focus words exactly once: ${focusWords.join(", ")}
- You MAY add simple particles/short function words for naturalness (e.g., في، على، من، إلى، مع، هذا، هذه)
- Prefer un-diacritized Arabic unless needed for clarity
- Keep sentences natural and short.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.6,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ stage, focusWords }) },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}