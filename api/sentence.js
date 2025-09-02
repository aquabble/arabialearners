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
    const { unit = "All", chapter = "All" } = await req.json();
    const semester = await loadSemester(req);
    const all = normalizeVocab(semester);
    let pool = all;
    if (unit && unit !== "All") pool = pool.filter(x => x.unitName === unit);
    if (chapter && chapter !== "All") pool = pool.filter(x => x.chapterName === chapter);
    if (!pool.length) pool = all;
    const base = pool[Math.floor(Math.random()*pool.length)];

    // Optionally expand/enrich with OpenAI
    let out = { ar: base.ar, en: base.en, tokens: [] };
    if (process.env.OPENAI_API_KEY){
      try{
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return JSON { ar:string, en:string, tokens:string[] } using the provided pair. Do not add explanations." },
            { role: "user", content: JSON.stringify({ base }) }
          ]
        });
        out = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
        if (!out?.ar || !out?.en) out = { ar: base.ar, en: base.en, tokens: [] };
      } catch {}
    }
    return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
  }catch(err){
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
