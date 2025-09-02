// Auto-generated hotfix wrapper: concurrency cap + cache + singleflight
import originalHandler from "./sentence-bundle.inner.js";
import { acquireSemaphore, releaseSemaphore } from "./_semaphore.js";
import { hashKey, getCached, setCached, withSingleflight } from "./_cache.js";
let checkLimit = null;
try { const mod = await import("./_ratelimit.js"); checkLimit = mod.checkLimit; } catch {}

export default async function handler(req, ...args) {
  // Per-IP rate limit if available (fail-open)
  if (checkLimit) {
    try {
      const res = await checkLimit(req);
      if (!res.success) return json({ error: "Too many requests" }, 429);
    } catch {}
  }

  // Read minimal body and build stable key
  let body = {};
  try {
    if (req?.method === "POST" || req?.method === "PUT") {
      body = await req.json();
    }
  } catch {}
  const url = (req?.url) || "";
  const method = (req?.method) || "GET";
  const partial = Object.fromEntries(Object.entries(body || {}).slice(0, 20));
  const keyBase = hashKey(["sentence-endpoint", method, url.replace(/\?.*$/, ""), partial]);

  // Serve from cache
  const cacheKey = `cache:bundle:${keyBase}`;
  const cached = await getCached(cacheKey);
  if (cached) return jsonString(cached, 200, true);

  // Global concurrency cap
  const sem = await acquireSemaphore("sem:sentence:global", 6, 45000);
  if (!sem) return json({ error: "Busy, please retry shortly." }, 429, { "Retry-After": "3" });

  try {
    // Singleflight: only one identical request hits the model
    const flightKey = `inflight:bundle:${keyBase}`;
    const serialized = await withSingleflight(flightKey, 45, async () => {
      const resp = await originalHandler(req, ...args);
      const status = resp?.status ?? 200;
      let text = "";
      try { text = await resp.text(); } catch {}
      if (status >= 200 && status < 300 && text) {
        try { await setCached(cacheKey, text, 6 * 60 * 60); } catch {}
      }
      return text || "{}";
    });

    return jsonString(serialized || "{}", 200, false);
  } finally {
    await releaseSemaphore(sem);
  }
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}
function jsonString(raw, status = 200, cached = false) {
  const headers = { "content-type": "application/json; charset=utf-8" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parsed.cached = cached || parsed.cached;
      return new Response(JSON.stringify(parsed), { status, headers });
    }
  } catch {}
  return new Response(raw, { status, headers });
}
