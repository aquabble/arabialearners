// api/_normalizeSentenceBundleBody.js
// Normalizes and validates incoming POST body for /api/sentence-bundle
// - Converts "All" -> null for unit/chapter
// - Clamps size into [1..10]
// - Whitelists enums to avoid unexpected values

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const DIRECTIONS   = new Set(["ar2en", "en2ar"]);
const TIMEMODES    = new Set(["none", "relative", "absolute"]);

function toNullIfAll(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim().toLowerCase() === "all") return null;
  return v;
}

function clamp(n, lo, hi) {
  if (isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function normalizeSentenceBundleBody(input = {}) {
  const body = typeof input === "object" && input !== null ? input : {};

  const difficulty = DIFFICULTIES.has(String(body.difficulty || "").toLowerCase())
    ? String(body.difficulty).toLowerCase() : "medium";

  const direction = DIRECTIONS.has(String(body.direction || "").toLowerCase())
    ? String(body.direction).toLowerCase() : "ar2en";

  const timeMode = TIMEMODES.has(String(body.timeMode || "").toLowerCase())
    ? String(body.timeMode).toLowerCase() : "none";

  const unit    = toNullIfAll(body.unit);
  const chapter = toNullIfAll(body.chapter);

  const sizeRaw = typeof body.size === "number" ? body.size : parseInt(body.size, 10);
  const size    = clamp(sizeRaw, 1, 10);

  const timeText = typeof body.timeText === "string" ? body.timeText : "";

  return { difficulty, unit, chapter, size, timeMode, timeText, direction };
}

module.exports = { normalizeSentenceBundleBody };
