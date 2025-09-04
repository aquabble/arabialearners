// Clean, validated _lib.cjs (CommonJS)
const fs = require("fs");
const path = require("path");
const https = require("https");

function exists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

function readJSON(abs) {
  try { return JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch { return null; }
}

function findFirstExisting(relPaths) {
  const tried = new Set();
  const bases = [
    process.cwd(),
    path.resolve(__dirname),
    path.resolve(__dirname, "..")
  ];
  for (const rel of relPaths) {
    for (const base of bases) {
      const abs = path.resolve(base, rel);
      if (tried.has(abs)) continue;
      tried.add(abs);
      if (exists(abs)) return abs;
    }
  }
  return null;
}

function loadGlossary() {
  const candidates = [
    "public/Glossary.json",
    "src/lib/Glossary.json",
    "api/Glossary.json",
    "../public/Glossary.json",
    "../src/lib/Glossary.json",
    "Glossary.json"
  ];
  const abs = findFirstExisting(candidates);
  if (!abs) return { data: null, source: null };
  const data = readJSON(abs);
  return { data, source: abs };
}

function getSemestersList(data){
  if (!data) return [];
  if (Array.isArray(data)) {
    const semSec = data.find(sec => (sec && String(sec.type||"").toLowerCase() === "semesters"));
    if (semSec && Array.isArray(semSec.items)) return semSec.items;
    const glossSec = data.find(sec => (sec && String(sec.type||"").toLowerCase() === "glossary"));
    if (glossSec && Array.isArray(glossSec.semesters)) return glossSec.semesters;
    return [];
  }
  if (data && String(data.type||"").toLowerCase() === "semesters" && Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.semesters)) return data.semesters;
  if (Array.isArray(data.units)) return [{ units: data.units }];
  return [];
}

function normalizeGlossaryForUI(data){
  const sems = getSemestersList(data) || [];
  return {
    semesters: sems.map(s => ({
      id: s && (s.id || null),
      name: s && (s.name || null),
      units: Array.isArray(s && s.units) ? s.units.map(u => ({
        id: u && (u.id || null),
        name: u && (u.name || null),
        chapters: Array.isArray(u && u.chapters) ? u.chapters.map(c => ({
          id: c && (c.id || null),
          name: c && (c.name || null)
        })) : []
      })) : []
    }))
  };
}

function __normKey(s){
  return String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‐‑‒–—―]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLexicon(obj, unitName="", chapterName=""){
  const uKey = __normKey(unitName);
  const cKey = __normKey(chapterName);
  const unitAll = !uKey || uKey === "all";
  const chapAll = !cKey || cKey === "all";

  const semesters = getSemestersList(obj);
  const out = [];
  for (const sem of (semesters || [])) {
    const units = (sem && Array.isArray(sem.units)) ? sem.units : [];
    for (const u of units) {
      const uName = (u && (u.name || u.id) || "").toString();
      const uNorm = __normKey(uName);
      if (!unitAll && uNorm !== uKey) continue;
      const chapters = (u && Array.isArray(u.chapters)) ? u.chapters : [];
      for (const ch of chapters) {
        const cName = (ch && (ch.name || ch.id) || "").toString();
        const cNorm = __normKey(cName);
        if (!chapAll && cNorm !== cKey) continue;
        const vocab = (ch && Array.isArray(ch.vocab)) ? ch.vocab : [];
        for (const v of vocab) {
          const ar = ((v && (v.ar || v.arabic || v.word)) || "").toString().trim();
          const en = ((v && (v.en || v.english || v.translation || v.gloss)) || "").toString().trim();
          if (ar) out.push({ ar, en });
        }
      }
    }
  }
  return out;
}

function pick(arr, n){
  const a = Array.isArray(arr) ? arr.slice() : [];
  const out = [];
  const target = Math.max(1, Math.min(Number(n)||5, 50));
  while (a.length && out.length < target) {
    out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]);
  }
  return out;
}

function makeSimpleSentences(lex, { size=5, direction="ar2en" }={}){
  const chosen = pick(lex||[], size);
  const items = [];
  for (const it of chosen) {
    const ar = String((it && it.ar) || "").trim();
    const en = String((it && it.en) || "").trim();
    if (!ar && !en) continue;
    if (direction === "en2ar") {
      items.push({ prompt: en || ar, answer: ar || en, ar, en });
    } else {
      items.push({ prompt: ar || en, answer: en || ar, ar, en });
    }
  }
  return items;
}

async function postJSON(url, body, headers={}){
  if (typeof fetch === "function") {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, json, text };
  }
  // Node https fallback
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const data = Buffer.from(JSON.stringify(body));
      const req = https.request({
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        port: u.port || 443,
        headers: { "Content-Type":"application/json", "Content-Length": data.length, ...headers }
      }, (res) => {
        let buf = "";
        res.on("data", (d) => buf += d);
        res.on("end", () => {
          let json = null; try { json = JSON.parse(buf); } catch {}
          resolve({ ok: res.statusCode>=200 && res.statusCode<300, status: res.statusCode, json, text: buf });
        });
      });
      req.on("error", reject);
      req.write(data);
      req.end();
    } catch (e) { reject(e); }
  });
}

module.exports = {
  loadGlossary,
  extractLexicon,
  makeSimpleSentences,
  postJSON,
  normalizeGlossaryForUI,
  getSemestersList
};
