const fs = require('fs');
const path = require('path');

function projectRoot(){
  return process.cwd();
}

function loadJSONSync(p){
  const txt = fs.readFileSync(p, 'utf8');
  return JSON.parse(txt);
}

// Single Source of Truth: src/lib/Glossary.json
function loadGlossary(){
  const root = projectRoot();
  const p = path.join(root, 'src', 'lib', 'Glossary.json');
  if (!fs.existsSync(p)) {
    throw new Error('Glossary not found at ' + p);
  }
  return loadJSONSync(p);
}

const HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g; // Arabic diacritics
function stripDiacritics(s){ return String(s||'').normalize('NFC').replace(HARAKAT, ''); }
function normalizeArabic(s){
  return stripDiacritics(s)
    .replace(/[\u061B\u061F\u060C]/g, ' ') // ؛ ؟ ،
    .replace(/[\.\!\?\,\;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function tokenize(s){ return normalizeArabic(s).split(/\s+/).filter(Boolean); }

function getSemestersList(data){
  const src = data || loadGlossary();
  const semesters = (src?.semesters||[]).map(s => ({
    id: s?.id, name: s?.name,
    units: (s?.units||[]).map(u => ({
      id: u?.id, name: u?.name,
      chapters: (u?.chapters||[]).map(c => ({ id: c?.id, name: c?.name }))
    }))
  }));
  return semesters;
}

function normalizeGlossaryForUI(data){
  return { semesters: getSemestersList(data) };
}

module.exports = {
  loadGlossary,
  getSemestersList,
  normalizeGlossaryForUI,
  stripDiacritics,
  normalizeArabic,
  tokenize,
};
