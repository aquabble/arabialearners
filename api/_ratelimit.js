// Upstash REST-based rate limiter (no top-level await).
// - Skips OPTIONS/HEAD
// - Keys by IP + path to avoid cross-route collisions
// - Tries multiple IP headers (x-vercel-forwarded-for, x-forwarded-for, x-real-ip, cf-connecting-ip)
// - Higher defaults: 180 req / 60s
export async function checkLimit(req) {
  const urlBase = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || "60", 10);
  const MAX = parseInt(process.env.RATE_LIMIT_MAX || "180", 10);
  const DEBUG = String(process.env.RATE_LIMIT_DEBUG || "false").toLowerCase() === "true";

  // Skip non-mutating or preflight
  const m = (req.method || "GET").toUpperCase();
  if (m === "OPTIONS" || m === "HEAD") return { success: true, info: { reason: "skip-preflight" } };

  // If not configured, allow
  if (!urlBase || !token) return { success: true, info: { reason: "no-redis" } };

  function getIp(r) {
    try {
      const h = r.headers;
      const xvf = h.get("x-vercel-forwarded-for");
      if (xvf) return xvf.split(",")[0].trim();
      const xff = h.get("x-forwarded-for");
      if (xff) return xff.split(",")[0].trim();
      const xri = h.get("x-real-ip");
      if (xri) return xri.trim();
      const cfi = h.get("cf-connecting-ip");
      if (cfi) return cfi.trim();
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  const ip = getIp(req);
  const path = (() => { try { return new URL(req.url).pathname; } catch { return "/"; } })();
  const bucket = Math.floor(Date.now() / 1000 / WINDOW);
  const key = `rl:${ip}:${path}:${bucket}`;

  // Upstash pipeline: INCR + EXPIRE
  const body = JSON.stringify([["INCR", key], ["EXPIRE", key, WINDOW]]);
  const r = await fetch(`${urlBase}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body
  }).catch(() => null);
  if (!r || !r.ok) return { success: true, info: { reason: "redis-error" } };
  const data = await r.json().catch(()=>null);
  const count = Array.isArray(data) ? (data[0] ?? 0) : (data?.result?.[0] ?? 0);
  const success = count <= MAX;
  const info = DEBUG ? { ip, path, bucket, count, limit: MAX, window: WINDOW } : undefined;
  return { success, remaining: Math.max(0, MAX - count), limit: MAX, window: WINDOW, ...(info ? {info} : {}) };
}
