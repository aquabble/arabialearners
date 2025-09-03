// Rate limiter without top-level await or dynamic import.
// Uses Upstash REST API directly; fails open if not configured.
export async function checkLimit(req) {
  const urlBase = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || "60", 10);
  const MAX = parseInt(process.env.RATE_LIMIT_MAX || "60", 10);

  if (!urlBase || !token) {
    return { success: true, info: { reason: "no-redis" } };
  }

  function getIp(r) {
    try {
      const h = r.headers;
      return (h.get("x-real-ip") || h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    } catch {
      return "unknown";
    }
  }

  const ip = getIp(req);
  const bucket = Math.floor(Date.now() / 1000 / WINDOW);
  const key = `rl:${ip}:${bucket}`;

  // Upstash pipeline: INCR + EXPIRE
  const body = JSON.stringify([["INCR", key], ["EXPIRE", key, WINDOW]]);
  const r = await fetch(`${urlBase}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body
  });
  if (!r.ok) return { success: true, info: { reason: "redis-error" } };
  const data = await r.json().catch(()=>null);
  const count = Array.isArray(data) ? (data[0] ?? 0) : (data?.result?.[0] ?? 0);
  const success = count <= MAX;
  return { success, remaining: Math.max(0, MAX - count), limit: MAX, window: WINDOW };
}
