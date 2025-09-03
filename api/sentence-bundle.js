// Wrapper with optional rate limit + singleflight, no top-level await.
import originalHandler from "./sentence-bundle.inner.js";

export const config = { runtime: "edge" };

// Minimal singleflight keyed by body hash (in-memory Map)
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

let checkLimitPromise = null;
async function getCheckLimit() {
  if (checkLimitPromise) return checkLimitPromise;
  try {
    checkLimitPromise = import("./_ratelimit.js").then(m => m.checkLimit).catch(() => null);
    return await checkLimitPromise;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  // Per-IP rate limit (best-effort, fail-open)
  const checkLimit = await getCheckLimit();
  if (checkLimit) {
    try {
      const res = await checkLimit(req);
      if (!res.success) return toJson({ error: "Too many requests" }, 429);
    } catch {}
  }

  // Singleflight
  const body = await readBody(req);
  const key = hashBody(body);
  if (inflight.has(key)) {
    try { return await inflight.get(key); }
    catch { /* fallthrough */ }
  }
  const exec = (async () => {
    const r2 = new Request(req.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    try {
      return await originalHandler(r2);
    } catch (err) {
      return toJson({ error: String(err?.message || err) }, 500);
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, exec);
  return exec;
}
