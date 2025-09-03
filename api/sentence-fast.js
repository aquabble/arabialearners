// Enhanced sentence-fast with robust fallbacks and a last-resort pair.
// Tries: proxy -> OpenAI -> archive (/semester1.json) -> ultimate fallback.
// Edge-friendly (no top-level await).
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

async function tryProxyOriginal(req, body, timeoutMs=2000) {
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

async function tryOpenAI(body, timeoutMs=2500) {
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

function extractWordsFromUnknownShape(data) {
  const out = [];
  if (!data) return out;
  const pushWord = (v) => {
    const s = String(v || "").trim();
    if (s) out.push(s);
  };
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === "string") pushWord(item);
      else if (item && typeof item === "object") pushWord(item.ar || item.arabic || item.word || item.text);
    }
  } else if (typeof data === "object") {
    for (const v of Object.values(data)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string") pushWord(item);
          else if (item && typeof item === "object") pushWord(item.ar || item.arabic || item.word || item.text);
        }
      } else if (typeof v === "string") {
        pushWord(v);
      }
    }
  }
  return out;
}

async function tryArchiveFallback(req, body, timeoutMs=1200) {
  try {
    const base = new URL(req.url);
    base.pathname = "/semester1.json";
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort("timeout"), timeoutMs);
    const r = await fetch(base.toString(), { method: "GET", signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json().catch(()=>null);
    const words = extractWordsFromUnknownShape(data);
    if (!words.length) return null;
    const n = Math.max(3, Math.min(8, Math.floor(Math.random()*6)+3));
    const bag = [];
    for (let i=0; i<n; i++) {
      const idx = Math.floor(Math.random() * words.length);
      bag.push(words[idx]);
    }
    const ar = bag.join(" ");
    const en = "Practice sentence from archive words.";
    return shape({ ar, en }, body, "archive");
  } catch {
    return null;
  }
}

function ultimateFallback(body) {
  // Last resort to avoid empty UI (simple deterministic pair)
  const pair = { ar: "تدريب سهل ومباشر", en: "A simple, direct practice sentence." };
  return shape(pair, body, "ultimate");
}

export default async function handler(req) {
  try {
    const body = await req.json().catch(()=> ({}));

    const v1 = await tryProxyOriginal(req, body);
    if (v1) return json(v1);

    const v2 = await tryOpenAI(body);
    if (v2) return json(v2);

    const v3 = await tryArchiveFallback(req, body);
    if (v3) return json(v3);

    // Never return empty
    return json(ultimateFallback(body));
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
