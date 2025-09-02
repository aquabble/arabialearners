export const config = { runtime: "edge" };

function json(data, status=200){ return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }

async function loadSemester(req) {
  const { origin } = new URL(req.url);
  const urls = ["/semester1.json", "/data/semester1.json"].map(p => new URL(p, origin).href);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (res.ok) return await res.json();
    } catch {}
  }
  throw new Response(JSON.stringify({ error: "semester1.json not found in known paths", tried: urls }), { status: 400 });
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function tokenizeAR(s){ return String(s||"").trim().split(/\s+/).filter(Boolean); }
function tokenizeEN(s){ return String(s||"").trim().split(/\s+/).filter(Boolean); }
function shuffle(a){ const b = a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]] } return b; }

function normalizeVocab(raw){
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

export default async function handler(req){
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const { stage="SVO", unit="All", chapter="All", direction="ar2en" } = body || {};

  try {
    const data = await loadSemester(req);
    const vocab = normalizeVocab(data);
    const pool = vocab.filter(v => (unit==="All"||v.unit===unit) && (chapter==="All"||v.chapter===chapter));
    if (!pool.length) throw new Error("No vocab found for the selected filters");
    const item = pick(pool);
    const ar = item.ar;
    const en = item.en || "—";

    const tokensAr = tokenizeAR(ar);
    const tokensEn = tokenizeEN(en);
    const shuffledAr = shuffle(tokensAr);
    const shuffledEn = shuffle(tokensEn);

    return json({ ar, en, tokensAr, tokensEn, shuffledAr, shuffledEn });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e?.message || e) }, 500);
  }
}
