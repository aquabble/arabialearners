import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };
const redis = Redis.fromEnv();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Edge-safe user id hashing using Web Crypto
async function getUserIdFromReq(req) {
  const raw = (
    req.headers.get("x-user-id") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("user-agent") ||
    "anon"
  ).toString();

  try {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(raw));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 16);
  } catch {
    try {
      const b64 = btoa(unescape(encodeURIComponent(raw))).replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
      return b64.slice(0, 16);
    } catch {
      return "anon";
    }
  }
}

export default async function handler(req) {
  try {
    const userId = await getUserIdFromReq(req);
    const prefix = `served:${userId}:`;
    const keys = await redis.keys(`${prefix}*`).catch(() => []);
    let cleared = 0;
    for (const k of keys || []) {
      try { await redis.del(k); cleared++; } catch {}
    }
    return json({ ok: true, userId, cleared });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}
