// Hotfix wrapper for /api/grade: concurrency cap + singleflight + timeout
import originalHandler from "./grade.inner.js";
import { acquireSemaphore, releaseSemaphore } from "./_semaphore.js";
import { hashKey, getCached, setCached, withSingleflight } from "./_cache.js";
import { withTimeout } from "./_withTimeout.js";

let checkLimit = null;
try { const mod = await import("./_ratelimit.js"); checkLimit = mod.checkLimit; } catch {}

function json(obj, status=200, extra={}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}
function jsonString(raw, status=200) {
  try {
    const parsed = JSON.parse(raw);
    return json(parsed, status);
  } catch {
    return new Response(raw, { status, headers: { "content-type":"application/json; charset=utf-8" } });
  }
}

export default async function handler(req, ...args) {
  // 1) Per-IP rate limit (fail-open)
  if (checkLimit) {
    try { const r = await checkLimit(req); if (!r.success) return json({ error:"Too many requests" }, 429); } catch {}
  }

  // 2) Build a stable key for de-dup/cache
  let body = {};
  try { if (req?.method === "POST") body = await req.clone().json(); } catch {}
  const method = req?.method || "GET";
  const url = (req?.url || "").replace(/\?.*$/, "");
  const partial = Object.fromEntries(Object.entries(body||{}).slice(0,20));
  const keyBase = hashKey(["grade", method, url, partial]);
  const cacheKey = `cache:grade:${keyBase}`;
  const flightKey = `inflight:grade:${keyBase}`;

  // 3) Serve from cache if available
  const cached = await getCached(cacheKey);
  if (cached) return jsonString(cached, 200);

  // 4) Global concurrency semaphore just for grading
  const sem = await acquireSemaphore("sem:grade:global", 8, 45000);
  if (!sem) return json({ error: "Busy, please retry shortly." }, 429, { "Retry-After": "3" });

  try {
    // 5) Coalesce identical requests; hard timeout at ~25s to avoid 504s
    const result = await withSingleflight(flightKey, 45, async () => {
      const resp = await withTimeout(
        originalHandler(req, ...args),
        25000,
        () => json({ error: "Timeout while grading" }, 504)
      );
      const status = resp?.status ?? 200;
      let text = "";
      try { text = await resp.text(); } catch {}
      if (status >= 200 && status < 300 && text) {
        try { await setCached(cacheKey, text, 60 * 60); } catch {}
      }
      // if original timed out and returned a Response above, bubble it up as text
      if (text) return text;
      return JSON.stringify({ ok:false, error:"Timeout while grading" });
    });

    return jsonString(result || "{}", 200);
  } finally {
    await releaseSemaphore(sem);
  }
}
