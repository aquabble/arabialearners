import { json } from "./_json.js";

export const config = { runtime: "edge" };

function clamp(n, min, max) { return Math.max(min, Math.min(max, Math.floor(n || 0))); }
function safe(v) { return (v ?? "").toString().trim(); }

export default async function handler(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const difficulty = safe(body?.difficulty || "medium");
    const unit = safe(body?.unit || "All");
    const chapter = safe(body?.chapter || "All");
    const direction = safe(body?.direction || "ar2en");
    const size = clamp(body?.size, 1, 8);

    const items = [];
    const baseUrl = new URL(req.url);
    baseUrl.pathname = baseUrl.pathname.replace(/\/[^\/]+$/, "/sentence");

    // Try to fill the bundle by calling /api/sentence multiple times.
    for (let i = 0; i < size; i++) {
      try {
        const r = await fetch(baseUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ difficulty, unit, chapter, direction }),
        });
        if (r.ok) {
          const one = await r.json().catch(() => null);
          if (one) items.push(one);
        }
      } catch {}
    }
    return json({ items });
  } catch (err) {
    return json({ items: [], error: String(err?.message || err) }, 200);
  }
}
