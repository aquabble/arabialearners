// Lightweight per-IP rate limit for Vercel Edge/Node
// Uses Upstash Redis if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
// Fallback: permissive (no-op) if not configured.

const WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || "60", 10); // seconds
const MAX_REQ = parseInt(process.env.RATE_LIMIT_MAX || "60", 10);   // requests per window

let client = null;
try {
  const { Redis } = await import("@upstash/redis");
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
  }
} catch {}

function getIp(req) {
  try {
    const h = req.headers;
    return (h.get("x-real-ip") || h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export async function checkLimit(req) {
  if (!client) return { success: true, info: { reason: "no-redis" } };
  const ip = getIp(req);
  const key = `rl:${ip}:${Math.floor(Date.now()/1000/WINDOW)}`;
  // atomic increment with TTL
  const n = await client.incr(key);
  if (n === 1) await client.expire(key, WINDOW);
  const success = n <= MAX_REQ;
  return { success, remaining: Math.max(0, MAX_REQ - n), limit: MAX_REQ, window: WINDOW };
}
