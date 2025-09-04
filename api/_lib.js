
const fs = require("fs");
const path = require("path");

function exists(p) { try { return fs.existsSync(p); } catch { return false; } }

function readJSONIfExists(abs) {
  if (!exists(abs)) return null;
  try { return JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch (e) { console.error("JSON parse error for", abs, e); return null; }
}

function findFirstExisting(relPaths) {
  for (const rel of relPaths) {
    const abs = path.resolve(process.cwd(), rel);
    if (exists(abs)) return abs;
  }
  return null;
}

// Try common locations for glossary/semester data.
function loadGlossary() {
  const candidates = [
    "api/Glossary.json",
    "src/lib/Glossary.json",
    "public/Glossary.json",
    "src/lib/semester1.json",
    "public/semester1.json"
  ];
  const abs = findFirstExisting(candidates);
  if (!abs) return { data: null, source: null };
  const data = readJSONIfExists(abs);
  return { data, source: abs };
}

// Try to collect vocab entries as [{ar, en}, ...] within a subtree if provided
function collectVocabAnywhere(node, out) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectVocabAnywhere(item, out);
    return;
  }
  if (typeof node === "object") {
    const keys = Object.keys(node);
    const kAr = keys.find(k => /^ar(abic)?$/i.test(k));
    const kEn = keys.find(k => /^en(glish)?$/i.test(k));
    if (kAr && kEn && typeof node[kAr] === "string" && typeof node[kEn] === "string") {
      out.push({ ar: node[kAr], en: node[kEn] });
    }
    for (const k of ["vocab", "lexicon", "words", "entries", "items"]) {
      if (Array.isArray(node[k])) collectVocabAnywhere(node[k], out);
    }
    for (const k of keys) {
      const v = node[k];
      if (v && typeof v === "object") collectVocabAnywhere(v, out);
    }
  }
}

// Find a unit by id/name (loose match), chapter by id/name, then collect vocab
function extractLexicon(obj, unitWanted, chapterWanted) {
  const all = [];
  if (!obj) return all;

  let subtree = obj;
  function looseEq(a, b) {
    if (!a || !b) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  const semesters = obj.semesters || (Array.isArray(obj.units) ? [{ units: obj.units }] : []);
  if (Array.isArray(semesters) && unitWanted) {
    for (const sem of semesters) {
      for (const u of (sem.units || [])) {
        if (looseEq(u.id, unitWanted) || looseEq(u.name, unitWanted)) {
          subtree = u;
          if (chapterWanted) {
            for (const c of (u.chapters || [])) {
              if (looseEq(c.id, chapterWanted) || looseEq(c.name, chapterWanted)) {
                subtree = c;
                break;
              }
            }
          }
          break;
        }
      }
    }
  }

  collectVocabAnywhere(subtree, all);
  if (all.length) return all;
  collectVocabAnywhere(obj, all);
  return all;
}

// Simple local fallback
function makeSimpleSentences(lex, opts = {}) {
  const { size = 5, direction = "ar2en" } = opts;
  const items = [];
  const pool = lex && lex.length ? lex : [
    { ar: "أنا أحب القهوة", en: "I like coffee" },
    { ar: "هو يدرس العربية", en: "He studies Arabic" },
    { ar: "أين المكتبة؟", en: "Where is the library?" },
    { ar: "الطقس جميل اليوم", en: "The weather is nice today" },
    { ar: "نذهب إلى الشاطئ", en: "We go to the beach" }
  ];

  for (let i = 0; i < size; i++) {
    const pair = pool[i % pool.length];
    const item = direction === "en2ar"
      ? { prompt: pair.en, answer: pair.ar, ar: pair.ar, en: pair.en }
      : { prompt: pair.ar, answer: pair.en, ar: pair.ar, en: pair.en };
    items.push(item);
  }
  return items;
}

module.exports = {
  loadGlossary,
  extractLexicon,
  makeSimpleSentences
};
