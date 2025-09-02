import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";
const redis = Redis.fromEnv();

/** Redis ZSET semaphore: caps concurrent jobs across all instances. */
export async function acquireSemaphore(key, max = 6, ttlMs = 45000) {
  const now = Date.now();
  await redis.zremrangebyscore(key, 0, now - ttlMs);   // GC expired holders
  const holders = await redis.zcard(key);
  if (holders >= max) return null;

  const member = randomUUID();
  await redis.zadd(key, { score: now, member });

  const newCount = await redis.zcard(key);
  if (newCount > max) { await redis.zrem(key, member); return null; }

  await redis.pexpire(key, ttlMs);
  return { key, member, ttlMs };
}

export async function refreshSemaphore({ key, member, ttlMs }) {
  const now = Date.now();
  const exists = await redis.zscore(key, member);
  if (exists === null) return false;
  await redis.zadd(key, { score: now, member });
  await redis.pexpire(key, ttlMs);
  return true;
}

export async function releaseSemaphore({ key, member }) {
  try { await redis.zrem(key, member); } catch {}
}
