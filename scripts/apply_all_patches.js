// scripts/apply_all_patches.js
// Run automatically via npm "predev"/"prebuild" hooks.
// Combines: Words tab + lemmatized stats + nav wiring.
const fs = require('fs');
const path = require('path');
function read(p){ return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(p, txt){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt, 'utf8'); }
const ROOT = process.cwd();

// ---------- Core file writers (Words tab + lemmatized stats) ----------
const WORD_STATS_JS = `// src/lib/wordStats.js
// Tracks per-word stats with light lemmatization to avoid clutter.
const HARKAT_REGEX = /[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]/g;
const TATWEEL = /\\u0640/g;
const PUNCT_REGEX = /[.,!?؛،:()" '\\[\\]{}\\-–—/\\\\]+/g;
const STOPWORDS = new Set(["و","ف","في","على","من","إلى","عن","أن","إن","قد","لن","لم","لا","ما","هل","ثم","بل","لكن","أو","أما","إذا","كل","أي","هذا","هذه","ذلك"]);
export const stripDiacritics = (s='') => s.normalize('NFC').replace(HARKAT_REGEX, '').replace(TATWEEL, '');
function normalizeLetters(s=''){ return s.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه'); }
function stripCommonPrefixes(s){ const patterns = ["وال","فال","بال","كال","ولل","فلل","لل","ال","و","ف","ب","ك","ل","س"]; for(const p of patterns){ if(s.startsWith(p) && s.length - p.length >= 3) { s = s.slice(p.length); break; } } return s; }
function stripCommonSuffixes(s){ const suff = ["كما","هما","تما","ون","ين","ان","تم","تن","وا","ها","هم","هن","كم","كن","ني","تي","تا","ته","ه","ت","ن","ا"]; for(const p of suff){ if(s.endsWith(p) && s.length - p.length >= 3) { s = s.slice(0, -p.length); break; } } return s; }
function lightStem(ar=''){ let s = normalizeLetters(stripDiacritics(ar.trim())); if (!s || s.length <= 1 || STOPWORDS.has(s)) return s; s = stripCommonPrefixes(s); s = stripCommonSuffixes(s); if (s.length < 2) s = normalizeLetters(stripDiacritics(ar.trim())); return s; }
function normalizeToken(ar=''){ return lightStem(ar); }
const LS_KEY = 'word_stats_v2';
export async function loadVocabMap(){
  try{
    const res = await fetch('/api/glossary', { cache: 'force-cache' });
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
          if(key) map.set(key, { ar: arRaw, en, def: en });
        }
      }
    }
    return map;
  }catch{ return new Map(); }
}
export function getStats(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }catch{ return {}; } }
export function saveStats(s){ try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch{} }
export function recordResult({ arSentence='', tokens=[], verdict='wrong' }){
  const rawWords = Array.isArray(tokens) && tokens.length && typeof tokens[0] === 'string' ? tokens : String(arSentence).replace(PUNCT_REGEX, ' ').split(/\\s+/).filter(Boolean);
  const stats = getStats(); const ts = Date.now(); const isCorrect = verdict === 'correct' || verdict === 'minor';
  for(const raw of rawWords){
    const base = normalizeToken(raw);
    if(!base || STOPWORDS.has(base)) continue;
    const prev = stats[base] || { ar: base, correct:0, incorrect:0, total:0, lastSeen:0, forms:[] };
    const forms = Array.isArray(prev.forms) ? prev.forms.slice(0, 12) : [];
    const formClean = normalizeLetters(stripDiacritics(String(raw)));
    if(formClean && !forms.includes(formClean)) forms.push(formClean);
    stats[base] = { ar: base, correct: prev.correct + (isCorrect ? 1 : 0), incorrect: prev.incorrect + (isCorrect ? 0 : 1), total: prev.total + 1, lastSeen: ts, forms };
  }
  saveStats(stats);
}
export function mergeStatsWithVocab(statsObj, vocabMap){
  const items = [];
  for(const [lemma, s] of Object.entries(statsObj || {})){
    const meta = vocabMap.get(lemma) || { ar: lemma, en: '[AI word]', def: '[no definition yet]' };
    items.push({ ar: meta.ar || lemma, lemma, en: meta.en || '', def: meta.def || meta.en || '', forms: Array.isArray(s.forms) ? s.forms : [], correct: s.correct || 0, incorrect: s.incorrect || 0, total: s.total || 0, lastSeen: s.lastSeen || 0 });
  }
  items.sort((a,b)=> (b.lastSeen - a.lastSeen) || (b.total - a.total));
  return items;
}
`;
const WORDS_JSX = `// src/components/Words.jsx
import { useEffect, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import { loadVocabMap, getStats, mergeStatsWithVocab } from '../lib/wordStats.js'
function WordBubble({ item }){
  const { ar, en, def, correct=0, incorrect=0, total=0, forms=[] } = item
  const [open, setOpen] = useState(false)
  const variants = forms.slice(0, 6).join(' · ')
  return (
    <div className="word-bubble" style={{border:'1px solid var(--border)', borderRadius:16, padding:12}}>
      <button type="button" className="btn" onClick={()=>setOpen(o=>!o)} title={\`\${en || '—'}\`} style={{width:'100%', display:'flex', justifyContent:'space-between'}}>
        <span style={{fontWeight:700, fontSize:18}}>{ar}</span>
        <span className="small" style={{opacity:.8}}>{en || '—'}</span>
      </button>
      {open && (
        <div className="small" style={{marginTop:8}}>
          <div><b>English:</b> {en || '—'}</div>
          <div><b>Definition:</b> {def || en || '—'}</div>
          {variants && <div style={{marginTop:8}}><b>Variants:</b> {variants}</div>}
          <div style={{marginTop:8, display:'flex', gap:12}}>
            <span className="badge ok">Correct: {correct}</span>
            <span className="badge warn">Incorrect: {incorrect}</span>
            <span className="badge">{total} total</span>
          </div>
        </div>
      )}
    </div>
  )
}
export default function Words(){
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  useEffect(()=>{
    let mounted = true
    async function load(){
      const map = await loadVocabMap()
      const stats = getStats()
      const merged = mergeStatsWithVocab(stats, map)
      if(!mounted) return
      setItems(merged)
    }
    load()
    return ()=>{ mounted = false }
  }, [])
  const filtered = items.filter(it => {
    if (filter === 'all') return true
    if (filter === 'known') return it.correct >= 3 && it.correct >= (it.incorrect || 0)
    if (filter === 'trouble') return it.incorrect > it.correct
    return true
  })
  return (
    <Card>
      <CardBody>
        <CardTitle>Your Words</CardTitle>
        <CardSub>Collapses conjugations; shows accuracy per lemma.</CardSub>
        <div className="small" style={{margin:'12px 0', display:'flex', gap:12, flexWrap:'wrap'}}>
          <Button onClick={()=>setFilter('all')} className={filter==='all'?'brand':''}>All</Button>
          <Button onClick={()=>setFilter('known')} className={filter==='known'?'brand':''}>Known</Button>
          <Button onClick={()=>setFilter('trouble')} className={filter==='trouble'?'brand':''}>Trouble</Button>
          <span className="small" style={{opacity:.7}}>{filtered.length} / {items.length}</span>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12}}>
          {filtered.map(it => <WordBubble key={it.lemma} item={it} />)}
        </div>
      </CardBody>
    </Card>
  )
}
`;

// ---------- Patches ----------
function ensureWordsFiles(){
  const wordsPath = path.join(ROOT, 'src', 'components', 'Words.jsx');
  const statsPath = path.join(ROOT, 'src', 'lib', 'wordStats.js');
  if (!fs.existsSync(wordsPath)){ write(wordsPath, WORDS_JSX); console.log('[create] src/components/Words.jsx'); }
  if (!fs.existsSync(statsPath)){ write(statsPath, WORD_STATS_JS); console.log('[create] src/lib/wordStats.js'); }
}
function patchTranslateGame(){
  const p = path.join(ROOT, 'src', 'components', 'TranslateGame.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] TranslateGame.jsx not found'); return; }
  if (!/from '..\/lib\/wordStats\.js'/.test(txt)){
    txt = txt.replace("import { API_BASE } from '../lib/apiBase.js'","import { API_BASE } from '../lib/apiBase.js'\nimport { recordResult } from '../lib/wordStats.js'");
    console.log('[ok] TranslateGame: import recordResult');
  }
  txt = txt.replace(/"count:/g, '"size:');
  if (!/recordResult\(\{/.test(txt)){
    txt = txt.replace(/setFeedback\(data\)\s*\}/,"setFeedback(data);\n      try { recordResult({ arSentence: ar, tokens, verdict: data?.verdict }); } catch {}\n    }");
    console.log('[ok] TranslateGame: recordResult() wired');
  }
  write(p, txt);
  console.log('[done] TranslateGame.jsx patched');
}
function patchStudyShell(){
  const p = path.join(ROOT, 'src', 'components', 'StudyShell.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] StudyShell.jsx not found'); return; }
  if (/value:'words'/.test(txt)) { console.log('[skip] StudyShell already has Words tab'); return; }
  const newTxt = txt.replace("{label:'Word Order', value:'word-order'}","{label:'Word Order', value:'word-order'},\n    {label:'Words', value:'words'}");
  if (newTxt !== txt) { write(p, newTxt); console.log('[done] StudyShell.jsx patched (Words tab)'); }
  else { console.log('[warn] Could not find tab items to patch in StudyShell.jsx'); }
}
function patchApp(){
  const p = path.join(ROOT, 'src', 'App.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] App.jsx not found'); return; }
  if (!/from '\.\/components\/Words\.jsx'/.test(txt)){
    txt = txt.replace("import WordOrderGame from './components/WordOrderGame.jsx'","import WordOrderGame from './components/WordOrderGame.jsx'\nimport Words from './components/Words.jsx'");
    console.log('[ok] App.jsx: import Words');
  }
  if (!/mode === 'words'/.test(txt)){
    txt = txt.replace("{mode === 'word-order' && <WordOrderGame user={user} />}","{mode === 'word-order' && <WordOrderGame user={user} />}\n      {mode === 'words' && <Words user={user} />}");
    console.log('[ok] App.jsx: render Words route');
  }
  write(p, txt);
  console.log('[done] App.jsx patched');
}
function patchHeader(){
  const p = path.join(ROOT, 'src', 'components', 'ui', 'Header.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] ui/Header.jsx not found'); return; }
  if (/onClick=\{\(\)=>onNav\('words'\)\}/.test(txt)) { console.log('[skip] Header already has Words menu'); return; }
  let replaced = false;
  txt = txt.replace(/(onClick=\{\(\)=>onNav\('translate'\)\}[^>]*>[^<]*<\/[^>]+>)/,(m)=>{ replaced = true; return m + `\n            <a role=\"menuitem\" className=\"menu-item\" onClick={()=>onNav('words')}>Words</a>`; });
  if (!replaced) {
    txt = txt.replace(/(onClick=\{\(\)=>onNav\('word-order'\)\}[^>]*>[^<]*<\/[^>]+>)/,(m)=>{ replaced = true; return m + `\n            <a role=\"menuitem\" className=\"menu-item\" onClick={()=>onNav('words')}>Words</a>`; });
  }
  if (!replaced) {
    txt = txt.replace(/(<\/div>\s*<\/div>\s*<\/header>)/, `\n            <a role=\"menuitem\" className=\"menu-item\" onClick={()=>onNav('words')}>Words</a>\n        $1`);
  }
  write(p, txt);
  console.log('[done] Header.jsx patched (Words menu item)');
}
function patchHome(){
  const p = path.join(ROOT, 'src', 'components', 'Home.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] Home.jsx not found'); return; }
  if (/onClick=\{\(\)=>onNav\('words'\)\}/.test(txt)) { console.log('[skip] Home already has Words button'); return; }
  let replaced = false;
  txt = txt.replace(/(<Button[^>]*onClick=\{\(\)=>onNav\('translate'\)\}[\s\S]*?<\/Button>)/,(m)=>{ replaced = true; return m + `\n        <Button className=\"ghost\" onClick={()=>onNav('words')}>Words</Button>`; });
  if (!replaced) {
    txt = txt.replace(/(<\/CardBody>\s*<\/Card>)/, `\n        <div className=\"mt-16\"><Button className=\"ghost\" onClick={()=>onNav('words')}>Words</Button></div>\n      $1`);
  }
  write(p, txt);
  console.log('[done] Home.jsx patched (Words button)');
}

// ---------- Run all ----------
(function main(){
  console.log('Applying all patches (words + nav)...');
  ensureWordsFiles();
  patchTranslateGame();
  patchStudyShell();
  patchApp();
  patchHeader();
  patchHome();
  console.log('All set.');
})();
