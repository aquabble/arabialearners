// api/sentence-bundle.js
export const config = { runtime: "edge" }; // ⚡ edge = faster cold starts

import { jsonResponse } from "./_utils.js";

// ---- tiny local fallback (fast & deterministic) ----
function rand(n){ return Math.floor(Math.random()*n) }
function choice(a){ return a[rand(a.length)] }
function localFallback({ direction="ar2en", difficulty="medium", vocab=[] }){
  const subj = choice([{ar:"الطالب",en:"the student"},{ar:"الطالبة",en:"the female student"},{ar:"أحمد",en:"Ahmed"},{ar:"سارة",en:"Sarah"}]);
  const toPlaces = [{ar:"إلى المدرسة",en:"to the school"},{ar:"إلى المكتبة",en:"to the library"},{ar:"إلى المتحف",en:"to the museum"}];
  const atPlaces = [{ar:"في البيت",en:"at home"},{ar:"في المطعم",en:"at the restaurant"},{ar:"في الصف",en:"in class"}];
  const times = [{ar:"اليوم",en:"today"},{ar:"صباحًا",en:"in the morning"},{ar:"مساءً",en:"in the evening"}];

  const useMotion = Math.random() < 0.5;
  let ar, en;
  if (useMotion){
    const p = choice(toPlaces), t = choice(times);
    ar = `${subj.ar} ذهب ${p.ar} ${t.ar}`.trim();
    en = `${subj.en[0].toUpperCase()+subj.en.slice(1)} went ${p.en} ${t.en}`.trim();
  } else {
    const p = choice(atPlaces), t = choice(times);
    ar = `${subj.ar} قرأ كتابًا ${p.ar} ${t.ar}`.trim();
    en = `${subj.en[0].toUpperCase()+subj.en.slice(1)} read a book ${p.en} ${t.en}`.trim();
  }

  // try to inject one vocab token if provided (kept simple & safe)
  if (vocab.length){
    const tok = vocab[0];
    if (!/كتاب/.test(ar)) {
      ar = ar.replace("قرأ", `قرأ ${tok.ar}`);
      en = en.replace("read a book", `read ${tok.en}`);
    }
  }
  return direction==="ar2en"
    ? { prompt: ar, answer: en, tokens: vocab.length ? [vocab[0].ar] : [] }
    : { prompt: en, answer: ar, tokens: vocab.length ? [vocab[0].en] : [] };
}

// ---- glossary loader (Edge compatible) ----
async function loadGlossary() {
  // We included src/lib/Glossary.json in vercel.json includeFiles
  // In Edge, fetch from the public path if needed:
  try {
    // attempt to load from bundled file path (works on Node), fallback to fetch
    // Edge runtime can't read fs, so use fetch to a static copy you host (optional).
    // If you serve a static mirror at /Glossary.json, uncomment this:
    // const r = await fetch(new URL("/Glossary.json", new URL(req.url).origin));
    // return await r.json();
    // Minimal: just return empty; the function still works in local mode.
    return { semesters: [] };
  } catch {
    return { semesters: [] };
  }
}

function resolveScope(gloss, scope={}){
  const sem = (gloss?.semesters||[]).find(s => !scope.semester || s.id===scope.semester) || (gloss?.semesters||[])[0];
  const unit = (sem?.units||[]).find(u => !scope.unit || u.id===scope.unit) || (sem?.units||[])[0];
  const chap = (unit?.chapters||[]).find(c => !scope.chapter || c.id===scope.chapter) || (unit?.chapters||[])[0];
  const vocab = (chap?.vocab||[]).filter(v=>v?.ar && v?.en);
  return { used: { semester: sem?.id, unit: unit?.id, chapter: chap?.id }, vocab };
}

// ---- OpenAI call via fetch (Edge safe) ----
async function generateViaOpenAI({ direction, difficulty, scopedVocab, signal }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("NO_OPENAI_KEY");

  const diff = {
    short:  { min:4, max:7,  minGloss:1, hint:"simple clause" },
    medium: { min:6, max:8,  minGloss:2, hint:"one informative clause" },
    hard:   { min:8, max:14, minGloss:3, hint:"two related clauses with ثم/ولكن" }
  }[difficulty] || { min:6, max:8, minGloss:2, hint:"one informative clause" };

  const arTokens = scopedVocab.map(v=>v.ar);
  const enTokens = scopedVocab.map(v=>v.en);

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.6,
    max_tokens: 160,
    response_format: { type: "json_object" },
    messages: [
      { role:"system", content:
        `Return ONLY JSON: {"prompt": string, "answer": string, "tokens": string[] }.
If direction="ar2en": prompt in Arabic, answer in English.
If direction="en2ar": prompt in English, answer in Arabic.
Use proper Arabic grammar: motion uses "إلى", stative uses "في". Avoid "ذهب في".
Target PROMPT length ${diff.min}-${diff.max} words. Include at least ${diff.minGloss} glossary tokens (from 'glossaryTokens') in the prompt language. ${diff.hint}.`
      },
      { role:"user", content: JSON.stringify({
          direction, difficulty,
          glossaryTokens: direction==="ar2en" ? arTokens : enTokens
      })}
    ]
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${key}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify(body),
    signal
  });

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  const obj = JSON.parse(content);
  const prompt = String(obj.prompt||"").trim();
  const answer = String(obj.answer||"").trim();
  const tokens = Array.isArray(obj.tokens) ? obj.tokens.slice(0,6) : [];
  if (!prompt || !answer) throw new Error("BAD_AI_OUTPUT");
  return { prompt, answer, tokens };
}

export default async (req) => {
  try {
    const { direction="ar2en", difficulty="medium", scope={}, provider="auto" } = await req.json().catch(()=>({}));

    // Always scope first (may be empty)
    const gloss = await loadGlossary();
    const { vocab, used } = resolveScope(gloss, scope);

    // Fast path: allow forcing local mode from client
    if (provider === "local") {
      const out = localFallback({ direction, difficulty, vocab });
      return jsonResponse({ ok:true, provider:"local", version:"sb-edge-1", direction, difficulty, scopeUsed: used, ...out });
    }

    // OpenAI path with hard timeout → fallback
    const ABORT_MS = 4500; // ~4.5s budget
    const ac = new AbortController();
    const timer = setTimeout(()=> ac.abort("timeout"), ABORT_MS);

    try {
      const out = await generateViaOpenAI({ direction, difficulty, scopedVocab: vocab, signal: ac.signal });
      clearTimeout(timer);
      return jsonResponse({ ok:true, provider:"openai", version:"sb-edge-1", direction, difficulty, scopeUsed: used, ...out });
    } catch (e) {
      clearTimeout(timer);
      // graceful fallback
      const out = localFallback({ direction, difficulty, vocab });
      return jsonResponse({ ok:true, provider:"local-fallback", version:"sb-edge-1", direction, difficulty, scopeUsed: used, ...out });
    }
  } catch (e) {
    return jsonResponse({ ok:false, error:String(e?.message||e) }, 500);
  }
};
