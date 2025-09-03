// sentence-fast: archive cleanup so fallbacks look natural (Arabic-only), plus existing logic.
import { json } from "./_json.js";

export const config = { runtime: "edge" };

function shape(pair, body, source="proxy") {
  const id = (typeof crypto?.randomUUID === "function") ? crypto.randomUUID() : String(Date.now());
  const difficulty = body?.difficulty ?? "medium";
  const unit = body?.unit ?? null;
  const chapter = body?.chapter ?? null;
  const direction = body?.direction ?? "ar2en";
  return {
    id, difficulty, unit, chapter, direction,
    ar: String(pair?.ar ?? "").trim(),
    en: String(pair?.en ?? "").trim(),
    source
  };
}

function withHeader(res, source) {
  const headers = new Headers(res.headers);
  headers.set("x-sf-source", source);
  return new Response(res.body, { status: res.status, headers });
}

async function tryProxyOriginal(req, body, timeoutMs=5000) {
  try {
    const base = new URL(req.url);
    base.pathname = "/api/sentence";
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort("timeout"), timeoutMs);
    const r = await fetch(base.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    if (!data || !(data.ar && data.en)) return null;
    return shape({ ar: data.ar, en: data.en }, body, "proxy");
  } catch {
    return null;
  }
}

async function tryOpenAI(body, timeoutMs=15000) {
  try {
    if (!process.env.OPENAI_API_KEY) return null;
    const nonce = Math.random().toString(36).slice(2, 8);
    const sys = "You generate short bilingual sentence pairs. Output compact, natural text.";
    const content = `Return ONLY JSON with keys \"ar\", \"en\".
Direction: ${body?.direction||"ar2en"}; difficulty: ${body?.difficulty||"medium"}.
Keep it brief and natural. Variation tag: ${nonce}.`;
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: [{ type: "text", text: content }] }
      ],
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 80
    };
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort("timeout"), timeoutMs);
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: ac.signal
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json().catch(()=>null);
    const txt = j?.choices?.[0]?.message?.content || "";
    const m = txt.match(/\{[\s\S]*\}/);
    const obj = m ? JSON.parse(m[0]) : null;
    if (!obj || !(obj.ar && obj.en)) return null;
    return shape({ ar: obj.ar, en: obj.en }, body, "openai");
  } catch {
    return null;
  }
}

// --- Archive helpers (Arabic-only clean output) ---
const AR_LETTER = /[\u0600-\u06FF]/;
const AR_WORD_RE = /^[\u0600-\u06FF]+$/;
function cleanToArabicTokens(s) {
  if (!s) return [];
  return s.split(/[^\u0600-\u06FF]+/).filter(Boolean);
}

function extractWords(data) {
  const out = new Set();
  const push = (v) => {
    if (typeof v !== "string") return;
    if (!AR_LETTER.test(v)) return;
    const parts = cleanToArabicTokens(v);
    parts.forEach(p => { if (AR_WORD_RE.test(p)) out.add(p); });
  };
  const visit = (x) => {
    if (!x) return;
    if (typeof x === "string") return push(x);
    if (Array.isArray(x)) return x.forEach(visit);
    if (typeof x === "object") {
      push(x.ar); push(x.arabic); push(x.word); push(x.text); push(x.root);
      for (const v of Object.values(x)) visit(v);
    }
  };
  visit(data);
  return Array.from(out);
}

function formatArchiveSentence(words) {
  const pool = words && words.length ? words : ["تمرين","سهل","قصير"];
  const pick = (n) => {
    const arr = [];
    for (let i=0;i<n;i++) arr.push(pool[Math.floor(Math.random()*pool.length)]);
    return arr;
  };
  const [w1,w2] = pick(2);
  const ar = `هذا ${w1} ${w2}.`;
  const en = "Practice sentence from archive.";
  return { ar, en };
}

async function tryArchiveFallback(req, body, timeoutMs=4000) {
  try {
    const origin = new URL(req.url).origin;
    const url = `${origin}/semester1.json`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort("timeout"), timeoutMs);
    const r = await fetch(url, { method: "GET", signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json().catch(()=>null);
    const words = extractWords(data);
    const pair = formatArchiveSentence(words);
    return shape(pair, body, "archive");
  } catch {
    return null;
  }
}

function ultimateFallback(body) {
  const candidates = [
    { ar: "تمرين قصير قبل الدرس.", en: "A short practice before the lesson." },
    { ar: "جملة بسيطة للتدريب.", en: "A simple sentence for practice." },
    { ar: "نكتب جملة ثم نراجعها.", en: "We write a sentence then review it." }
  ];
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  return shape(pick, body, "ultimate");
}

export default async function handler(req) {
  try {
    const body = await req.json().catch(()=> ({}));

    const v1 = await tryProxyOriginal(req, body);
    if (v1) return withHeader(json(v1), "proxy");

    const v2 = await tryOpenAI(body);
    if (v2) return withHeader(json(v2), "openai");

    const v3 = await tryArchiveFallback(req, body);
    if (v3) return withHeader(json(v3), "archive");

    return withHeader(json(ultimateFallback(body)), "ultimate");
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
