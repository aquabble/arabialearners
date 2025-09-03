// Stronger sentence-fast: robust archive, longer timeouts, randomized ultimate, and source header.
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

async function tryProxyOriginal(req, body, timeoutMs=4000) {
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

async function tryOpenAI(body, timeoutMs=5000) {
  try {
    if (!process.env.OPENAI_API_KEY) return null;
    const sys = "You generate short bilingual sentence pairs. Output compact, natural text.";
    const content = `Generate a JSON object with keys \"ar\", \"en\". Direction: ${body?.direction||"ar2en"}. Difficulty: ${body?.difficulty||"medium"}. Keep it short.`;
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: [{ type: "text", text: content }] }
      ],
      temperature: 0.6,
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

function extractWords(data) {
  const out = new Set();
  const push = (v) => { const s = String(v || "").trim(); if (s) out.add(s); };
  const visit = (x) => {
    if (!x) return;
    if (typeof x === "string") return push(x);
    if (Array.isArray(x)) return x.forEach(visit);
    if (typeof x === "object") {
      push(x.ar); push(x.arabic); push(x.word); push(x.text);
      for (const v of Object.values(x)) visit(v);
    }
  };
  visit(data);
  return Array.from(out);
}

const BUILTIN_WORDS = ["مرحبا","دقيقة","تمرين","سهل","مباشر","اليوم","كتاب","درس","وقت","ماء","قلم","بيت","مدرسة"];

function randomSentenceFrom(words) {
  const pool = words && words.length ? words : BUILTIN_WORDS;
  const n = Math.max(3, Math.min(8, Math.floor(Math.random()*6)+3));
  const bag = [];
  for (let i=0; i<n; i++) bag.push(pool[Math.floor(Math.random()*pool.length)]);
  return bag.join(" ");
}

async function tryArchiveFallback(req, body, timeoutMs=2500) {
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
    const ar = randomSentenceFrom(words);
    const en = "Practice sentence from archive words.";
    return shape({ ar, en }, body, "archive");
  } catch {
    return null;
  }
}

function ultimateFallback(body) {
  const candidates = [
    { ar: "تدريب سهل ومباشر", en: "A simple, direct practice sentence." },
    { ar: "تمرين قصير قبل الدرس", en: "A short practice before the lesson." },
    { ar: "نكتب جملة ثم نراجعها", en: "We write a sentence then review it." }
  ];
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  return shape(pick, body, "ultimate");
}

export default async function handler(req) {
  try {
    const body = await req.json().catch(()=> ({}));

    const v1 = await tryProxyOriginal(req, body);
    if (v1) {
      const res = json(v1);
      return withHeader(res, "proxy");
    }

    const v2 = await tryOpenAI(body);
    if (v2) {
      const res = json(v2);
      return withHeader(res, "openai");
    }

    const v3 = await tryArchiveFallback(req, body);
    if (v3) {
      const res = json(v3);
      return withHeader(res, "archive");
    }

    const v4 = ultimateFallback(body);
    const res = json(v4);
    return withHeader(res, "ultimate");
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
