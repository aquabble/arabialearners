import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

/** Basic Arabic normalizer for dedupe purposes */
export function normalizeArabic(str="") {
  if (!str) return "";
  return str
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g, "")     // strip diacritics & tatweel
    .replace(/[\u0640]/g, "")                                       // tatweel
    .replace(/[ـ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Key helpers */
function listKey(sem, unit, chap) {
  return `buf:list:sem:${sem||"0"}:unit:${unit||"0"}:chap:${chap||"0"}`;
}
function setKey(sem, unit, chap) {
  return `buf:set:sem:${sem||"0"}:unit:${unit||"0"}:chap:${chap||"0"}`;
}
function docKey(hash) {
  return `buf:item:${hash}`;
}

/**
 * Put sentence into buffer if not duplicate. Returns true if inserted, false if duplicate.
 * item: { ar: string, en: string, semester?: string|number, unit?: string|number, chapter?: string|number }
 */
export async function bufferPut(item, { ttlSeconds = 7 * 24 * 3600 } = {}) {
  const ar = (item?.ar ?? "").trim();
  const en = (item?.en ?? "").trim();
  if (!ar || !en) return false;

  const sem = String(item?.semester ?? "0");
  const unit = String(item?.unit ?? "0");
  const chap = String(item?.chapter ?? "0");

  const norm = normalizeArabic(ar);
  const hash = await cryptoHash(norm);
  const sKey = setKey(sem, unit, chap);
  const lKey = listKey(sem, unit, chap);
  const dKey = docKey(hash);

  // fast duplicate check
  const isNew = await redis.sadd(sKey, hash);   // 1 if added, 0 if existed
  if (!isNew) return false;

  const payload = {
    ar, en,
    semester: sem, unit, chapter: chap,
    norm, hash,
    createdAt: Date.now()
  };
  await redis.set(dKey, payload, { ex: ttlSeconds });
  // push to list (queue)
  await redis.lpush(lKey, hash);
  // set housekeeping TTLs on set and list (optional rolling)
  await redis.expire(sKey, ttlSeconds);
  await redis.expire(lKey, ttlSeconds);
  return true;
}

/** Pop one sentence (FIFO-ish: use rpop to serve oldest first) */
export async function bufferPop({ semester="0", unit="0", chapter="0" } = {}) {
  const lKey = listKey(String(semester), String(unit), String(chapter));
  const hash = await redis.rpop(lKey);
  if (!hash) return null;
  const dKey = docKey(hash);
  const data = await redis.get(dKey);
  // keep the doc in case we want to re-serve or for auditing; delete if you prefer
  return data || null;
}

/** Get list size */
export async function bufferSize({ semester="0", unit="0", chapter="0" } = {}) {
  const lKey = listKey(String(semester), String(unit), String(chapter));
  return await redis.llen(lKey);
}

/** Bulk insert unique items; returns { inserted, skipped } counts */
export async function bufferPutMany(items, meta = {}, opts = {}) {
  let inserted = 0, skipped = 0;
  for (const it of items || []) {
    const ok = await bufferPut({ ...it, ...meta }, opts);
    if (ok) inserted++; else skipped++;
  }
  return { inserted, skipped };
}

async function cryptoHash(text) {
  const { createHash } = await import("crypto");
  const h = createHash("sha256");
  h.update(text);
  return h.digest("hex");
}


/** Low-level helpers for smarter popping/requeue */
function listKey(sem, unit, chap) { return `buf:list:sem:${sem||"0"}:unit:${unit||"0"}:chap:${chap||"0"}`; }
function setKey(sem, unit, chap) { return `buf:set:sem:${sem||"0"}:unit:${unit||"0"}:chap:${chap||"0"}`; }
function docKey(hash) { return `buf:item:${hash}`; }

export async function bufferGetByHash(hash) {
  if (!hash) return null;
  const dKey = docKey(hash);
  return await redis.get(dKey);
}

/** Requeue a hash to the FRONT (fresh for others) */
export async function bufferRequeueFront({ semester="0", unit="0", chapter="0" }={}, hash) {
  if (!hash) return;
  const lKey = listKey(String(semester), String(unit), String(chapter));
  await redis.lpush(lKey, hash);
}

/**
 * Pop a non-recent item for a given user by trying up to N attempts.
 * "isRecent" is a predicate that accepts (hash) => Promise<boolean>.
 * If only recent items exist, returns the oldest recent (last tried).
 */
export async function bufferPopNovel({ semester="0", unit="0", chapter="0" }={}, isRecent, attempts=10) {
  const lKey = listKey(String(semester), String(unit), String(chapter));
  let lastCandidate = null;

  for (let i=0; i<attempts; i++) {
    const hash = await redis.rpop(lKey);
    if (!hash) return null;
    lastCandidate = hash;
    if (isRecent && await isRecent(hash)) {
      // put it back to the FRONT so others may still get it later
      await redis.lpush(lKey, hash);
      continue;
    }
    const data = await bufferGetByHash(hash);
    if (!data) { continue; } // stale doc, try next
    return data;
  }
  // fallback: return the last candidate if exists, even if recent
  if (lastCandidate) {
    const data = await bufferGetByHash(lastCandidate);
    if (data) return data;
  }
  return null;
}
