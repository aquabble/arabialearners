import { Redis } from "@upstash/redis";
import crypto from "crypto";

export const config = { runtime: "edge" };
const redis = Redis.fromEnv();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function getUserIdFromReq(req) {
  try {
    const ua = req.headers.get("x-user-id") || req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || req.headers.get("user-agent") || "anon";
    return crypto.createHash("sha256").update(String(ua)).digest("hex").slice(0, 16);
  } catch {
    return "anon";
  }
}

export default async function handler(req) {
  try {
    const userId = getUserIdFromReq(req);
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
