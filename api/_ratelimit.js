// Sliding-window + burst rate limiter using Upstash REST.
// - Works on Edge/Node, no top-level await.
// - Keys by SALT + (clientId || ip) + path.
// - Skips OPTIONS/HEAD. Supports admin bypass. Adds Retry-After hints.
// - Debug mode exposes counters.

function getHeader(h, name) { try { return h.get(name) || ""; } catch { return ""; } }
function getIp(req) {
  const h = req.headers;
  return (
    getHeader(h, "x-vercel-forwarded-for") ||
    getHeader(h, "x-forwarded-for") ||
    getHeader(h, "x-real-ip") ||
    getHeader(h, "cf-connecting-ip") ||
    "unknown"
  ).split(",")[0].trim();
}

export async function checkLimit(req, opts = {}) {
  const urlBase = process.env.UPSTASH_REDIS_REST_URL;
  const token   = process.env.UPSTASH_REDIS_REST_TOKEN;

  const WINDOW  = Number(opts.window  ?? (process.env.RATE_LIMIT_WINDOW ?? 60));
  const LIMIT   = Number(opts.limit   ?? (process.env.RATE_LIMIT_MAX    ?? 600));
  const BURST   = Number(opts.burst   ?? (process.env.RATE_LIMIT_BURST  ?? 120));
  const DEBUG   = String(process.env.RATE_LIMIT_DEBUG || "false").toLowerCase() === "true";
  const SALT    = process.env.RATE_LIMIT_SALT || "0";

  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS" || method === "HEAD") return { success: true, info: { reason: "skip-preflight" } };

  const bypass = getHeader(req.headers, "x-bypass-rl");
  if (bypass && process.env.BYPASS_KEY && bypass === process.env.BYPASS_KEY) {
    return { success: true, info: { reason: "bypass" } };
  }

  if (!urlBase || !token) return { success: true, info: { reason: "no-redis" } };

  const nowMs   = Date.now();
  const windowMs = WINDOW * 1000;
  const path    = (() => { try { return new URL(req.url).pathname; } catch { return "/"; } })();
  const clientId = getHeader(req.headers, "x-client-id").trim();
  const actor   = clientId || getIp(req) || "unknown";
  const zkey    = `rl:sw:${SALT}:${actor}:${path}`;

  const pipeline = JSON.stringify([
    ["ZREMRANGEBYSCORE", zkey, 0, nowMs - windowMs],
    ["ZADD", zkey, nowMs, String(nowMs)],
    ["ZCARD", zkey],
    ["ZRANGE", zkey, 0, 0],
    ["EXPIRE", zkey, WINDOW]
  ]);

  let res;
  try {
    res = await fetch(`${urlBase}/pipeline`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: pipeline
    });
  } catch {
    return { success: true, info: { reason: "redis-error" } };
  }
  if (!res.ok) return { success: true, info: { reason: "redis-error" } };

  const data = await res.json().catch(() => null) || [];
  const count = Number(Array.isArray(data) ? data[2] : (data?.[2] ?? 0)) || 0;

  const allowed = count <= (LIMIT + BURST);

  let retryAfter = 1;
  if (!allowed) {
    const oldest = Number(
      Array.isArray(data) && Array.isArray(data[3]) && data[3].length ? data[3][0] : nowMs
    ) || nowMs;
    const ms = Math.max(1, (oldest + windowMs) - nowMs);
    retryAfter = Math.ceil(ms / 1000);
  }

  const payload = {
    success: allowed,
    remaining: Math.max(0, (LIMIT + BURST) - count),
    limit: LIMIT,
    window: WINDOW,
    retryAfter
  };
  if (DEBUG) payload.info = { actor, path, count, limit: LIMIT, burst: BURST, window: WINDOW, nowMs };
  return payload;
}
