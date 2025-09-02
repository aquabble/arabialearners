// src/lib/wordStats.js
// Tracks per-word stats with light lemmatization to avoid clutter.
// Collapses common Arabic verb conjugations/clitics into a base key.

const HARKAT_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g; // diacritics
const TATWEEL = /\u0640/g;

const PUNCT_REGEX = /[.,!?؛،:()" '\[\]{}\-–—/\\]+/g;
const STOPWORDS = new Set(["و","ف","في","على","من","إلى","عن","أن","إن","قد","لن","لم","لا","ما","هل","ثم","بل","لكن","أو","أما","إذا","كل","أي","هذا","هذه","ذلك"]);

export const stripDiacritics = (s='') =>
  s.normalize('NFC').replace(HARKAT_REGEX, '').replace(TATWEEL, '');

function normalizeLetters(s=''){
  // Unify letter variants to stabilize keys
  return s
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه'); // pick one
}

function stripCommonPrefixes(s){
  // Order matters: long → short
  const patterns = ["وال","فال","بال","كال","ولل","فلل","لل","ال","و","ف","ب","ك","ل","س"];
  for(const p of patterns){
    if(s.startsWith(p) && s.length - p.length >= 3) {
      s = s.slice(p.length);
      break;
    }
  }
  return s;
}

function stripCommonSuffixes(s){
  // Very light endings (verb/plural/object clitics); guard length>=3
  const suff = [
    "كما","هما","تما",
    "ون","ين","ان","تم","تن","وا","ها","هم","هن","كم","كن","ني","تي","تا","ته","ه",
    "ت","ن","ا"
  ];
  for(const p of suff){
    if(s.endsWith(p) && s.length - p.length >= 3) {
      s = s.slice(0, -p.length);
      break;
    }
  }
  return s;
}

function lightStem(ar=''){
  // 1) basic normalization
  let s = normalizeLetters(stripDiacritics(ar.trim()));
  if (!s || s.length <= 1 || STOPWORDS.has(s)) return s;
  // 2) strip definite article / particles / conjunctions
  s = stripCommonPrefixes(s);
  // 3) strip common verb/person/plural/object endings
  s = stripCommonSuffixes(s);
  if (s.length < 2) s = normalizeLetters(stripDiacritics(ar.trim()));
  return s;
}

function normalizeToken(ar=''){
  return lightStem(ar);
}

const LS_KEY = 'word_stats_v2'; // bumped version

export async function loadVocabMap(){
  try{
    const res = await fetch('/semester1.json', { cache: 'force-cache' });
    if(!res.ok) throw new Error('semester1.json missing');
    const data = await res.json();
    const map = new Map();
    const units = Array.isArray(data?.units) ? data.units : [];
    for(const u of units){
      const chs = u?.unit?.chapters || [];
      for(const ch of chs){
        const vocab = Array.isArray(ch?.vocab) ? ch.vocab : [];
        for(const item of vocab){
          const arRaw = String(item?.ar || '');
          const key = normalizeToken(arRaw);
          const en = String(item?.en || '').trim();
          if(key) {
            map.set(key, { ar: arRaw, en, def: en });
          }
        }
      }
    }
    return map;
  }catch{ return new Map(); }
}

export function getStats(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }catch{ return {}; }
}
export function saveStats(s){ try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch{} }

/**
 * Record a graded result.
 * - arSentence: the full Arabic sentence (string)
 * - tokens: optional token list (strings). If not strings, we'll parse arSentence.
 * - verdict: 'correct' | 'minor' | 'wrong'
 */
export function recordResult({ arSentence='', tokens=[], verdict='wrong' }){
  const rawWords = Array.isArray(tokens) && tokens.length && typeof tokens[0] === 'string'
    ? tokens
    : String(arSentence).replace(PUNCT_REGEX, ' ').split(/\s+/).filter(Boolean);

  const stats = getStats();
  const ts = Date.now();
  const isCorrect = verdict === 'correct' || verdict === 'minor';

  for(const raw of rawWords){
    const base = normalizeToken(raw);
    if(!base || STOPWORDS.has(base)) continue;

    const prev = stats[base] || { ar: base, correct:0, incorrect:0, total:0, lastSeen:0, forms:[] };
    const forms = Array.isArray(prev.forms) ? prev.forms.slice(0, 12) : [];
    const formClean = normalizeLetters(stripDiacritics(String(raw)));
    if(formClean && !forms.includes(formClean)) forms.push(formClean);

    stats[base] = {
      ar: base,
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
      total: prev.total + 1,
      lastSeen: ts,
      forms
    };
  }
  saveStats(stats);
}

export function mergeStatsWithVocab(statsObj, vocabMap){
  const items = [];
  for(const [lemma, s] of Object.entries(statsObj || {})){
    const meta = vocabMap.get(lemma) || { ar: lemma, en: '[AI word]', def: '[no definition yet]' };
    items.push({
      ar: meta.ar || lemma,
      lemma,
      en: meta.en || '',
      def: meta.def || meta.en || '',
      forms: Array.isArray(s.forms) ? s.forms : [],
      correct: s.correct || 0,
      incorrect: s.incorrect || 0,
      total: s.total || 0,
      lastSeen: s.lastSeen || 0
    });
  }
  items.sort((a,b)=> (b.lastSeen - a.lastSeen) || (b.total - a.total));
  return items;
}
