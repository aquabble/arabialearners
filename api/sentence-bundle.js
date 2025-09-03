// Wrapper with optional rate limit + singleflight + caching.
// Kept intentionally small and dependency-light.
import originalHandler from "./sentence-bundle.inner.js";

let checkLimit = null;
try { const mod = await import("./_ratelimit.js"); checkLimit = mod.checkLimit; } catch {}

export const config = { runtime: "edge" };

// Minimal singleflight keyed by body hash (in-memory Map for edge runtime)
const inflight = new Map();

function toJson(obj, status=200, extra={}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}

async function readBody(req) {
  try { return await req.json(); } catch { return {}; }
}

function hashBody(obj) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 64); }
  catch { return "x"; }
}

export default async function handler(req) {
  // Per-IP limit (best-effort, fail-open on errors)
  if (checkLimit) {
    try {
      const res = await checkLimit(req);
      if (!res.success) return toJson({ error: "Too many requests" }, 429);
    } catch {}
  }

  // Singleflight: dedupe concurrent identical requests
  const body = await readBody(req);
  const key = hashBody(body);
  if (inflight.has(key)) {
    try { return await inflight.get(key); }
    catch { /* fallthrough to new execution */ }
  }
  const exec = (async () => {
    // Recreate a Request with the same URL and JSON body for the inner handler
    const r2 = new Request(req.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    try {
      const res = await originalHandler(r2);
      return res;
    } catch (err) {
      return toJson({ error: String(err?.message || err) }, 500);
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, exec);
  return exec;
}
