const fs = require("fs");
const path = require("path");
const https = require("https");

function exists(p) { try { fs.statSync(p); return true; } catch { return false; } }
function readJSON(abs) { try { return JSON.parse(fs.readFileSync(abs, "utf8")); } catch { return null; } }

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
  while (out.length < target) {
    if (!a.length) break;
    out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]);
  }
  while (out.length < target && arr && arr.length) out.push(arr[Math.floor(Math.random()*arr.length)]);
  return out;
}

// ====== Difficulty-aware template generator (PERSON OPTIONAL) ======
const NAMES_AR = ["ليلى","عمر","سارة","أحمد","نور","كريم","مريم","يوسف","فاطمة","علي"];
const NAMES_EN = ["Layla","Omar","Sara","Ahmed","Noor","Karim","Mariam","Youssef","Fatima","Ali"];
const SUBJECTS_AR = ["أنا","نحن","هو","هي","الطالب","المعلم","العائلة","الصديق"];
const SUBJECTS_EN = ["I","we","he","she","the student","the teacher","the family","the friend"];

function maybePerson(i){
  const usePerson = (i % 2) === 0; // ~50%
  if (usePerson) {
    return { ar: NAMES_AR[i % NAMES_AR.length], en: NAMES_EN[i % NAMES_EN.length] };
  }
  return { ar: SUBJECTS_AR[i % SUBJECTS_AR.length], en: SUBJECTS_EN[i % SUBJECTS_EN.length] };
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function clampToRange(text, minW, maxW, lang) {
  let t = String(text || "").trim();
  let wc = wordCount(t);
  const fillersAr = ["الآن.", "اليوم.", "من فضلك.", "حقًا.", "قريبًا."];
  const fillersEn = ["now.", "today.", "please.", "really.", "soon."];
  const fillers = (lang === "ar") ? fillersAr : fillersEn;
  while (wc < minW) {
    t = t.replace(/[.؟!?]*\s*$/, " ") + fillers[(wc) % fillers.length];
    wc = wordCount(t);
  }
  if (wc > maxW) {
    const parts = t.split(/\s+/).slice(0, maxW);
    if (!/[.؟!?]$/.test(parts[parts.length-1])) parts[parts.length-1] += (lang === "ar" ? "." : ".");
    t = parts.join(" ");
  }
  return t;
}

function ensureLex(lex, needed){
  const L = Array.isArray(lex) ? lex.slice() : [];
  if (L.length >= needed) return pick(L, needed);
  const out = L.slice();
  while (out.length < needed && L.length) out.push(L[Math.floor(Math.random()*L.length)]);
  while (out.length < needed) out.push({ ar:"شيء", en:"something" });
  return out;
}

function buildShort(i, lex) {
  // 4–7 words, ≥1 vocab
  const subj = maybePerson(i);
  const [w1] = ensureLex(lex, 1);
  const ar = clampToRange(`${subj.ar} يستخدم ${w1.ar} اليوم.`, 4, 7, "ar");
  const en = clampToRange(`${subj.en} uses the ${w1.en} today.`, 4, 7, "en");
  return { promptAr: ar, promptEn: en, used: [w1] };
}

function buildMedium(i, lex) {
  // 6–8 words, ≥2 vocab
  const subj = maybePerson(i);
  const [w1, w2] = ensureLex(lex, 2);
  const ar = clampToRange(`${subj.ar} يحمل ${w1.ar} ثم يشتري ${w2.ar} الآن.`, 6, 8, "ar");
  const en = clampToRange(`${subj.en} carries the ${w1.en} then buys the ${w2.en} now.`, 6, 8, "en");
  return { promptAr: ar, promptEn: en, used: [w1, w2] };
}

function buildHard(i, lex) {
  // 8–14 words, complex, ≥2 vocab
  const subj = maybePerson(i);
  const [w1, w2] = ensureLex(lex, 2);
  const ar = clampToRange(`عندما وصل ${subj.ar} متأخرًا، وضع ${w1.ar} قرب ${w2.ar} لأنه كان مشغولًا جدًا.`, 8, 14, "ar");
  const en = clampToRange(`When ${subj.en} arrived late, they placed the ${w1.en} near the ${w2.en} because they were very busy.`, 8, 14, "en");
  return { promptAr: ar, promptEn: en, used: [w1, w2] };
}

function makeDifficultySentences(lex, { size=5, direction="ar2en", difficulty="medium" }={}){
  const out = [];
  const S = Math.max(1, Math.min(50, Number(size)||5));
  for (let i=0; i<S; i++){
    const d = String(difficulty||"").toLowerCase();
    const pair = (d === "short" || d === "easy") ? buildShort(i, lex) : (d === "hard" ? buildHard(i, lex) : buildMedium(i, lex));
    const ar = pair.promptAr, en = pair.promptEn;
    const main = pair.used && pair.used[0] ? pair.used[0] : { ar:"", en:"" };
    if (direction === "en2ar") out.push({ prompt: en, answer: ar, ar: main.ar, en: main.en });
    else out.push({ prompt: ar, answer: en, ar: main.ar, en: main.en });
  }
  return out;
}

function makeSimpleSentences(lex, opts){ return makeDifficultySentences(lex, opts); }

async function postJSON(url, body, headers={}){
  if (typeof fetch === "function") {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, json, text };
  }
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const data = Buffer.from(JSON.stringify(body));
      const req = https.request({
        method: "POST", hostname: u.hostname,
        path: u.pathname + (u.search || ""), port: u.port || 443,
        headers: { "Content-Type":"application/json", "Content-Length": data.length, ...headers }
      }, (res) => {
        let buf = ""; res.on("data", (d) => buf += d);
        res.on("end", () => { let json=null; try{ json=JSON.parse(buf);}catch{}; resolve({ ok: res.statusCode>=200&&res.statusCode<300, status: res.statusCode, json, text: buf }); });
      });
      req.on("error", reject); req.write(data); req.end();
    } catch (e) { reject(e); }
  });
}

module.exports = {
  loadGlossary,
  extractLexicon,
  makeSimpleSentences,
  makeDifficultySentences,
  postJSON,
  normalizeGlossaryForUI,
  getSemestersList
};
