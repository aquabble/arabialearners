import { json } from "./_json.js";

export const config = { runtime: "edge" };

function clamp(n, min, max) { return Math.max(min, Math.min(max, Math.floor(n || 0))); }
function safe(v) { return (v ?? "").toString().trim(); }

function timeoutAbort(ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort("timeout"), ms);
  return { controller, cancel: () => clearTimeout(t) };
}

export default async function handler(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const difficulty   = safe(body?.difficulty || "medium");
    const unit         = safe(body?.unit || "All");
    const chapter      = safe(body?.chapter || "All");
    const direction    = safe(body?.direction || "ar2en");
    const timeMode     = safe(body?.timeMode || "");
    const timeText     = safe(body?.timeText || "");
    const requested    = clamp(body?.size, 1, 8);

    // Keep total well under 8s on the client:
    const size = Math.min(requested || 3, 3);   // max 3 items per bundle
    const perReqTimeoutMs = 2300;               // 2.3s * 3 ≈ 6.9s worst case

    const items = [];
    const url = new URL(req.url);
    url.pathname = url.pathname.replace(/\/[^\/]+$/, "/sentence-fast");

    for (let i = 0; i < size; i++) {
      const { controller, cancel } = timeoutAbort(perReqTimeoutMs);
      try {
        const r = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ difficulty, unit, chapter, direction, timeMode, timeText }),
          signal: controller.signal,
        });
        cancel();
        if (r.ok) {
          const one = await r.json().catch(() => null);
          if (one) items.push(one);
        }
      } catch {
        cancel(); // swallow timeout/abort and continue
      }
    }
    return json({ items, sizeRequested: requested, sizeReturned: items.length });
  } catch (err) {
    return json({ items: [], error: String(err?.message || err) }, 200);
  }
}
