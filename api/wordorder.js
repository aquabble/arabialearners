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

function tokenizeAr(s){ return s.trim().split(/\s+/); }
function tokenizeEn(s){ return s.trim().split(/\s+/); }

export default async function handler(req){
  try{
    if (req.method && req.method !== "POST"){
      return new Response("Method Not Allowed", { status: 405 });
    }
    const { stage = "SVO", unit = "All", chapter = "All", direction = "ar2en" } = await req.json();

    const semester = await loadSemester(req);
    const all = normalizeVocab(semester);
    if (!all.length) throw new Response(JSON.stringify({ error: "No vocab found" }), { status: 400 });

    // naive sentence assembly from two random entries; in practice you'd have templates
    const a = all[Math.floor(Math.random()*all.length)];
    const b = all[Math.floor(Math.random()*all.length)];
    const ar = `${a.ar} ${b.ar}`.replace(/\s+/g, ' ').trim();
    const en = `${a.en} ${b.en}`.replace(/\s+/g, ' ').trim();

    let tokensAr = tokenizeAr(ar);
    let tokensEn = tokenizeEn(en);

    // If OpenAI key exists, try to produce better aligned tokens
    if (process.env.OPENAI_API_KEY){
      try{
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return JSON { ar:string, en:string, tokensAr:string[], tokensEn:string[] }. Use short, clean tokens for ordering practice." },
            { role: "user", content: JSON.stringify({ seed: { ar, en } }) }
          ]
        });
        const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
        if (Array.isArray(parsed?.tokensAr) && parsed.tokensAr.length) tokensAr = parsed.tokensAr;
        if (Array.isArray(parsed?.tokensEn) && parsed.tokensEn.length) tokensEn = parsed.tokensEn;
      } catch {}
    }

    const shuffledAr = tokensAr.slice().sort(()=>Math.random()-0.5);
    const shuffledEn = tokensEn.slice().sort(()=>Math.random()-0.5);

    return new Response(JSON.stringify({ ar, en, tokensAr, shuffledAr, tokensEn, shuffledEn }), {
      headers: { "Content-Type": "application/json" }
    });
  }catch(err){
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
