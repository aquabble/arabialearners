import { Redis } from "@upstash/redis";
import crypto from "crypto";
const redis = Redis.fromEnv();

export function hashKey(parts) {
  const h = crypto.createHash("sha256");
  h.update(JSON.stringify(parts));
  return h.digest("hex");
}

export async function getCached(cacheKey) {
  return await redis.get(cacheKey);
}

export async function setCached(cacheKey, value, ttlSeconds = 21600) { // 6h
  await redis.set(cacheKey, value, { ex: ttlSeconds });
}

/** Singleflight: only one worker does the job per key; others wait for the result. */
export async function withSingleflight(lockKey, ttlSeconds, workFn) {
  const locked = await redis.set(lockKey, "1", { nx: true, ex: ttlSeconds });
  if (locked) {
    try {
      const res = await workFn();
      await redis.set(`${lockKey}:result`, res, { ex: ttlSeconds });
      return res;
    } finally {
      setTimeout(() => redis.del(lockKey).catch(()=>{}), 100);
    }
  } else {
    const start = Date.now();
    const timeout = ttlSeconds * 1000;
    while (Date.now() - start < timeout) {
      const res = await redis.get(`${lockKey}:result`);
      if (res) return res;
      await new Promise(r => setTimeout(r, 250));
    }
    throw new Error("Singleflight timeout");
  }
}
