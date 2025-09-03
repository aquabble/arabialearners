// Robust bundle builder that guarantees at least one item.
// Calls /api/sentence-fast repeatedly with a per-call nonce.
// Edge-friendly (no top-level await).

import { json } from "./_json.js";

export const config = { runtime: "edge" };

function clamp(n, lo, hi) { n = Number(n||0) || 0; return Math.max(lo, Math.min(hi, n)); }
function pick(v, alt) { return (v === undefined || v === null || v === "" || v === "All") ? alt : v; }

async function readInput(req) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const body = await req.json().catch(() => ({}));
  return {
    difficulty: body.difficulty ?? q.get("difficulty") ?? "medium",
    unit: pick(body.unit ?? q.get("unit"), null),
    chapter: pick(body.chapter ?? q.get("chapter"), null),
    size: clamp(body.size ?? q.get("size") ?? 3, 1, 5),
    timeMode: body.timeMode ?? q.get("timeMode") ?? "none",
    timeText: body.timeText ?? q.get("timeText") ?? "",
    direction: body.direction ?? q.get("direction") ?? "ar2en"
  };
}

function randid() {
  try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2); }
}

async function callFast(origin, payload, timeoutMs=6000) {
  const url = `${origin}/api/sentence-fast`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Per-call nonce to avoid caches and encourage variety
        "x-client-id": randid(),
        "x-nonce": randid()
      },
      body: JSON.stringify(payload),
      signal: ac.signal
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json().catch(()=>null);
    if (!j || !(j.ar && j.en)) return null;
    return j;
  } catch {
    clearTimeout(t);
    return null;
  }
}

export default async function handler(req) {
  try {
    const input = await readInput(req);
    const origin = new URL(req.url).origin;

    const total = input.size || 3;
    const items = [];
    const sources = [];
    const maxAttempts = Math.max(total * 3, 6); // plenty of chances

    for (let attempt = 0; attempt < maxAttempts && items.length < total; attempt++) {
      const one = await callFast(origin, input);
      if (one && one.ar && one.en) {
        // prevent dupes by Arabic text
        if (!items.find(x => x.ar === one.ar && x.en === one.en)) {
          items.push(one);
          if (one.source) sources.push(one.source);
        }
      }
    }

    // Guarantee at least one
    if (items.length === 0) {
      const fallback = { id: randid(), difficulty: input.difficulty, unit: input.unit, chapter: input.chapter, direction: input.direction, ar: "اختبار قصير", en: "Short test sentence.", source: "bundle-ultimate" };
      items.push(fallback);
      sources.push("bundle-ultimate");
    }

    return json({
      ok: true,
      sizeRequested: total,
      sizeReturned: items.length,
      items,
      sources
    });
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
