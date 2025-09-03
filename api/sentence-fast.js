import { json } from "./_json.js";

export const config = { runtime: "edge" };

function safe(v) { return (v ?? "").toString().trim(); }

function timeoutAbort(ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort("timeout"), ms);
  return { controller, cancel: () => clearTimeout(t) };
}

async function tryProxyOriginal(req, body, ms = 1800) {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/\/[^\/]+$/, "/sentence");
  const { controller, cancel } = timeoutAbort(ms);
  try {
    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    cancel();
    if (!r.ok) throw new Error("original sentence route failed");
    return await r.json();
  } catch {
    cancel();
    return null;
  }
}

async function tryOpenAI(body, ms = 1800) {
  if (!process.env.OPENAI_API_KEY) return null;
  const { difficulty, unit, chapter, direction, timeMode, timeText } = body;
  const sys = `You are a careful Arabic <-> English tutor. Return a SINGLE JSON object only.`;
  const content = `Generate one short practice sentence with translation.

Constraints:
- difficulty: ${difficulty}
- unit: ${unit}
- chapter: ${chapter}
- direction: ${direction}  (ar2en => Arabic prompt, English answer; en2ar => English prompt, Arabic answer)
- timeMode: ${timeMode}
- timeText: ${timeText}

Return ONLY a JSON object with keys:
- "ar": Arabic sentence (<= 14 words)
- "en": English translation (<= 14 words)`;

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: [{ type: "text", text: content }] }
    ],
    temperature: 0.7,
    max_tokens: 120
  };

  const { controller, cancel } = timeoutAbort(ms);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    cancel();
    if (!r.ok) return null;
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content || "";
    const match = txt.match(/\{[\s\S]*\}/);
    const obj = match ? JSON.parse(match[0]) : JSON.parse(txt);
    if (obj && (obj.ar || obj.en)) return shape(obj, body, "ai");
    return null;
  } catch {
    cancel();
    return null;
  }
}

async function tryArchiveFallback(req, body) {
  try {
    const base = new URL(req.url);
    base.pathname = "/semester1.json";
    const r = await fetch(base.toString(), { method: "GET" });
    if (!r.ok) return null;
    const data = await r.json();
    const words = Object.values(data || {})
      .flat()
      .map(w => (w?.ar || w?.arabic || w?.word || "").toString())
      .filter(Boolean);
    const n = Math.max(3, Math.min(6, Math.floor(Math.random()*6)+3));
    const bag = [];
    for (let i=0; i<n && words.length; i++) {
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

function shape(pair, body, source="proxy") {
  const id = (typeof crypto?.randomUUID === "function") ? crypto.randomUUID() : String(Date.now());
  const ar = safe(pair.ar || "");
  const en = safe(pair.en || "");
  const direction = safe(body.direction || "ar2en");
  const unit = safe(body.unit || "All");
  const chapter = safe(body.chapter || "All");
  const difficulty = safe(body.difficulty || "medium");
  const timeMode = safe(body.timeMode || "");
  const timeText = safe(body.timeText || "");

  const prompt = direction === "ar2en" ? ar : en;
  const answer = direction === "ar2en" ? en : ar;

  return {
    id, ar, en,
    prompt, answer,
    direction, unit, chapter, difficulty, timeMode, timeText,
    source
  };
}

export default async function handler(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const shaped = {
      difficulty: safe(body?.difficulty || "medium"),
      unit:       safe(body?.unit || "All"),
      chapter:    safe(body?.chapter || "All"),
      direction:  safe(body?.direction || "ar2en"),
      timeMode:   safe(body?.timeMode || ""),
      timeText:   safe(body?.timeText || "")
    };

    const v1 = await tryProxyOriginal(req, shaped, 1800);
    if (v1) return json(v1);

    const v2 = await tryOpenAI(shaped, 1800);
    if (v2) return json(v2);

    const v3 = await tryArchiveFallback(req, shaped);
    if (v3) return json(v3);

    return json({ error: "unable to generate sentence" }, 500);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
