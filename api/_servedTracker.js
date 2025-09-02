import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

// Identify the user from header/cookie/IP
export function getUserIdFromReq(req) {
  try {
    // Prefer explicit header or cookie your app sets:
    // e.g., x-user-id or cookie "uid"
    const hdr = req.headers?.get?.("x-user-id");
    if (hdr) return `uid:${hdr}`;
    const cookie = req.headers?.get?.("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)uid=([^;]+)/);
    if (m) return `uid:${decodeURIComponent(m[1])}`;
  } catch {}
  // Fallback to IP (coarse but better than nothing)
  const ip = req.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  return `ip:${ip}`;
}

function recentKey(userId) { return `usr:recent:${userId}`; }

/**
 * Mark a sentence hash as served to user.
 * windowMs is informational; retention is controlled by maxRecent & ttl.
 */
export async function markServed(userId, hash, { ttlSeconds = 7*24*3600, maxRecent = 200 } = {}) {
  const key = recentKey(userId);
  const now = Date.now();
  // score by time so we can trim by rank
  await redis.zadd(key, { score: now, member: hash });
  await redis.expire(key, ttlSeconds);
  // trim oldest if above maxRecent
  const n = await redis.zcard(key);
  if (n > maxRecent) {
    const excess = n - maxRecent;
    // remove oldest (lowest score) first
    await redis.zremrangebyrank(key, 0, excess - 1);
  }
}

/** true if this hash was served to user within windowMs */
export async function isRecentlyServed(userId, hash, windowMs = 7*24*3600*1000) {
  const key = recentKey(userId);
  const score = await redis.zscore(key, hash);
  if (score === null) return false;
  return (Date.now() - Number(score)) < windowMs;
}

/** filter items (with .hash) to only those not recently served */
export async function filterNovel(userId, items, windowMs = 7*24*3600*1000) {
  const out = [];
  for (const it of (items || [])) {
    if (!it?.hash) { out.push(it); continue; }
    const seen = await isRecentlyServed(userId, it.hash, windowMs);
    if (!seen) out.push(it);
  }
  return out;
}
