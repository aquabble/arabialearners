const fs = require("fs");
const path = require("path");
const https = require("https");

function exists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

function readJSON(abs) {
  try { return JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch (e) { return null; }
}


function findFirstExisting(relPaths) {
  const tried = new Set();
  const bases = [process.cwd(), path.resolve(__dirname), path.resolve(__dirname, "..")];
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
    const semSec = data.find(sec => (sec?.type||'').toLowerCase() === 'semesters');
    if (semSec?.items) return semSec.items;
    const glossSec = data.find(sec => (sec?.type||'').toLowerCase() === 'glossary');
    if (glossSec?.semesters) return glossSec.semesters;
    return [];
  }
  if ((data?.type||'').toLowerCase() === 'semesters' && Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.semesters)) return data.semesters;
  if (Array.isArray(data.units)) return [{ units: data.units }];
  return [];
}

function normalizeGlossaryForUI(data){
  const sems = getSemestersList(data) || [];
  return {
    semesters: sems.map(s => ({
      id: s.id, name: s.name,
      units: (s.units||[]).map(u => ({
        id: u.id, name: u.name,
        chapters: (u.chapters||[]).map(c => ({ id: c.id, name: c.name }))
      }))
    }))
  };
}

function extractLexicon(obj, unitName="", chapterName=""){ /* patched */
  const uKey = __normKey(unitName);
  const cKey = __normKey(chapterName);
  const unitAll = !uKey || uKey === "all";
  const chapAll = !cKey || cKey === "all";
  const semesters = getSemestersList(obj);
  const out = [];
  for (const sem of (semesters||[])) {
    for (const u of (sem.units||[])) {
      const uName = (u?.name || u?.id || "").toString();
      const uNorm = __normKey(uName);
      if (!unitAll && uNorm !== uKey) continue;
      for (const ch of (u.chapters||[])) {
        const cName = (ch?.name || ch?.id || "").toString();
        const cNorm = __normKey(cName);
        if (!chapAll && cNorm !== cKey) continue;
        for (const v of (ch.vocab||[])) {
          const ar = (v.ar || v.arabic || v.word || "").toString().trim();
          const en = (v.en || v.english || v.translation || v.gloss || "").toString().trim();
          if (ar) out.push({ ar, en });
        }
      }
    }
  }
  return out;
}
  const semesters = getSemestersList(obj);
  const out = [];
  for (const sem of (semesters||[])) {
    for (const u of (sem.units||[])) {
      const uName = (u?.name || u?.id || "").toString();
      if (unitName && uName !== unitName) continue;
      for (const ch of (u.chapters||[])) {
        const cName = (ch?.name || ch?.id || "").toString();
        if (chapterName && cName !== chapterName) continue;
        for (const v of (ch.vocab||[])) {
          const ar = (v.ar || v.arabic || v.word || "").toString().trim();
          const en = (v.en || v.english || v.translation || v.gloss || "").toString().trim();
          if (ar) out.push({ ar, en });
        }
      }
    }
  }
  return out;
}

function pick(arr, n){
  const a = Array.from(arr);
  const out = [];
  while (a.length && out.length < n) {
    out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]);
  }
  return out;
}

function makeSimpleSentences(lex, { size=5, direction="ar2en" }={}){
  const chosen = pick(lex||[], Math.max(1, Math.min(Number(size)||5, 50)));
  const items = [];
  for (const it of chosen) {
    const ar = String(it.ar||"").trim();
    const en = String(it.en||"").trim();
    if (!ar && !en) continue;
    if (direction === "en2ar") {
      items.push({ prompt: en || ar, answer: ar || en, ar, en });
    } else {
      items.push({ prompt: ar || en, answer: en || ar, ar, en });
    }
  }
  return items;
}

async async function postJSON(url, body, headers={}){
  if (typeof fetch === "function") {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, json, text };
  }
  // Node without fetch fallback
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


// Robust matching for unit/chapter + 'All' wildcard
function __normKey(s){
  return String(s || "")
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]+/g, '-')   // unify dashes
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports.normalizeGlossaryForUI = normalizeGlossaryForUI;

module.exports.getSemestersList = getSemestersList;
