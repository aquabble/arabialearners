// Shared helpers (Pages Router)
import fs from "fs";
import path from "path";

export function tryJson(p) {
  try {
    const abs = p.startsWith("/") ? p : path.join(process.cwd(), p);
    if (fs.existsSync(abs)) {
      const raw = fs.readFileSync(abs, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function findGlossary() {
  const tried = [];
  const env = process.env.GLOSSARY_FILE;
  if (env) { tried.push(env); const j = tryJson(env); if (j) return { data: j, path: env, tried }; }

  const candidates = [
    "src/lib/Glossary.json",
    "src/lib/glossary.json",
    "data/Glossary.json",
    "data/glossary.json",
    "Glossary.json",
    "glossary.json"
  ];
  for (const p of candidates) { tried.push(p); const j = tryJson(p); if (j) return { data: j, path: p, tried }; }
  return { data: null, path: null, tried };
}

export function normalizeGlossaryForUI(data) {
  const sections = Array.isArray(data) ? data : [data];
  let glossary = null, semesters = null;
  for (const sec of sections) {
    if (!sec || typeof sec !== "object") continue;
    const t = (sec.type || "").toLowerCase();
    if (t === "glossary") glossary = sec;
    if (t === "semesters") semesters = sec;
  }
  if (glossary?.semesters) return glossary.semesters.map(s => ({
    id: s.id, name: s.name,
    units: (s.units||[]).map(u => ({
      id: u.id, name: u.name,
      chapters: (u.chapters||[]).map(c => ({ id: c.id, name: c.name }))
    }))
  }));
  if (semesters?.items) return semesters.items.map(s => ({
    id: s.id, name: s.name,
    units: (s.units||[]).map(u => ({
      id: u.id, name: u.name,
      chapters: (u.chapters||[]).map(c => ({ id: c.id, name: c.name }))
    }))
  }));
  return [];
}

function norm(s) { return (String(s||"").toLowerCase().replace(/[^a-z0-9]/g, "")); }
function endsDigits(a, b) {
  const da = norm(a).replace(/\D+/g, ""); const db = norm(b).replace(/\D+/g, "");
  return !!da && da === db;
}

function collectStringsFromAny(x, out) {
  if (!x) return;
  if (typeof x === "string") { out.push(x); return; }
  if (Array.isArray(x)) { for (const y of x) collectStringsFromAny(y, out); return; }
  if (typeof x === "object") {
    if (typeof x.ar === "string") out.push(x.ar);
    if (typeof x.en === "string") out.push(x.en);
    for (const k of Object.keys(x)) {
      const v = x[k];
      if (typeof v === "string") out.push(v);
      else if (Array.isArray(v)) collectStringsFromAny(v, out);
    }
  }
}

export function extractLexiconFromGlossary(data, semester, unit, chapter) {
  const sections = Array.isArray(data) ? data : [data];
  let semesters = null;
  for (const sec of sections) if ((sec?.type||"").toLowerCase() === "semesters") { semesters = sec.items; break; }
  if (!Array.isArray(semesters)) return [];

  const sem = semesters.find(s => norm(s.id)===norm(semester) || norm(s.name)===norm(semester) || endsDigits(s.id, semester) || endsDigits(s.name, semester)) || semesters[0];
  if (!sem) return [];
  const units = sem.units || [];
  const u = units.find(x => norm(x.id)===norm(unit) || norm(x.name)===norm(unit) || endsDigits(x.id, unit) || endsDigits(x.name, unit)) || units[0];
  if (!u) return [];
  const chapters = u.chapters || [];
  const ch = chapters.find(c => norm(c.id)===norm(chapter) || norm(c.name)===norm(chapter) || endsDigits(c.id, chapter) || endsDigits(c.name, chapter));
  const out = [];
  if (ch && ch.vocab) collectStringsFromAny(ch.vocab, out);
  if (!out.length) for (const c of chapters) collectStringsFromAny(c.vocab, out);
  return Array.from(new Set(out));
}
