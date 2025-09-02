import OpenAI from "openai";

export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeVocab(raw){
  const out = [];
  const units = Array.isArray(raw?.units) ? raw.units : [];
  for (const u of units){
    const U = u?.unit;
    if (!U) continue;
    const unitName = (U.name || U.id || "Unit").toString();
    const chapters = Array.isArray(U.chapters) ? U.chapters : [];
    for (const ch of chapters){
      const chapterName = (ch?.name || ch?.id || "").toString();
      const vocab = Array.isArray(ch?.vocab) ? ch.vocab : [];
      for (const item of vocab){
        const ar = (item && (item.ar || item.arabic || item.word)) || "";
        const en = (item && (item.en || item.english || item.gloss)) || "";
        if (ar && en) out.push({ ar, en, unitName, chapterName });
      }
    }
  }
  return out;
}

function pickFocus(arr, k = 3){
  if (!Array.isArray(arr) || !arr.length) return [];
  const picks = new Set();
  while (picks.size < Math.min(k, arr.length)){
    picks.add(Math.floor(Math.random() * arr.length));
  }
  return Array.from(picks).map(i => arr[i]);
}

async function loadSemester(req){
  const host = req.headers.get("host");
  const urls = [
    `https://${host}/semester1.json`,
    `https://${host}/data/semester1.json`
  ];
  for (const url of urls){
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok){
      try { return await res.json(); } catch {}
    }
  }
  throw new Response(JSON.stringify({ error: "semester1.json not found", tried: urls }), { status: 400 });
}

export default async function handler(req){
  try{
    if (req.method && req.method !== "POST"){
      return new Response("Method Not Allowed", { status: 405 });
    }
    const { stage = "SVO", unit = "All", chapter = "All", direction = "ar2en", count = 5 } = await req.json();

    const semester = await loadSemester(req);
    const all = normalizeVocab(semester);
    if (!all.length) throw new Response(JSON.stringify({ error: "No vocab found" }), { status: 400 });

    let pool = all;
    if (unit && unit !== "All") pool = pool.filter(x => x.unitName === unit);
    if (chapter && chapter !== "All") pool = pool.filter(x => x.chapterName === chapter);
    if (!pool.length) pool = all;

    // Try OpenAI to synthesize a focused bundle; fall back to random picks
    let items = [];
    if (process.env.OPENAI_API_KEY){
      try{
        const prompt = {
          role: "user",
          content: JSON.stringify({
            instructions: "From the provided vocab pool, select distinct pairs for a translation drill.",
            direction,
            stage,
            count: Math.max(1, Math.min(10, Number(count) || 5)),
            pool: pickFocus(pool, Math.min(30, pool.length)), // give a small subset for determinism
            schema: "Return JSON: { items: [ { ar: string, en: string } ] }"
          })
        };
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: "You are a helpful Arabic↔English tutor. Only return valid JSON as instructed." },
            prompt
          ]
        });
        const content = completion.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(content);
        items = Array.isArray(parsed?.items) ? parsed.items : [];
      } catch {}
    }
    if (!items.length){
      items = Array.from({ length: Math.max(1, Math.min(10, Number(count) || 5)) }, () => {
        const { ar, en } = pool[Math.floor(Math.random()*pool.length)];
        return { ar, en };
      });
    }

    return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } });
  }catch(err){
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
