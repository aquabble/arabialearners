import React, { useEffect, useState } from 'react'
import { getPreferredArabicVoice, speakText, stopSpeaking } from '../lib/tts'
import { userKey, recordActivity, awardBadge, learnedCount } from '../lib/persistence'
import { WORD_BANK, stripDiacritics, generateSentence } from '../lib/generator'
import { notifyChange } from '../lib/autoSync'

export default function TranslateGame({ showDiacritics, user }){
  const [mistakes, setMistakes] = useState(()=>JSON.parse(localStorage.getItem(userKey(user,'mistakes'))||"{}"));
  const [mastery, setMastery] = useState(()=>JSON.parse(localStorage.getItem(userKey(user,'mastery'))||"{}"));
  const [wordStats, setWordStats] = useState(()=>JSON.parse(localStorage.getItem(userKey(user,'wordStats'))||"{}"));
  const [progress, setProgress] = useState(()=>Number(localStorage.getItem(userKey(user,'translate_progress'))||0));
  const [stage, setStage] = useState(()=>Number(localStorage.getItem(userKey(user,'translate_stage'))||1));
  const [reviewMode, setReviewMode] = useState(false);
  const [ttsVoice, setTtsVoice] = useState(null); const [isSpeaking, setIsSpeaking]=useState(false);
  const [sentence, setSentence] = useState(()=>generateSentence(WORD_BANK, mistakes, mastery, stage, reviewMode));
  const [revealed, setRevealed] = useState({}); const [guess, setGuess] = useState(""); const [checked, setChecked] = useState(false);
  const [recentResults, setRecentResults] = useState([]);

  useEffect(()=>{ if (!window.speechSynthesis) return; function pick(){ const v=getPreferredArabicVoice(); if(v) setTtsVoice(v); } pick(); window.speechSynthesis.onvoiceschanged = () => pick(); return () => { window.speechSynthesis.onvoiceschanged = null; stopSpeaking(); }; }, []);
  useEffect(()=>{ localStorage.setItem(userKey(user,'mistakes'), JSON.stringify(mistakes)); notifyChange(user); },[mistakes,user]);
  useEffect(()=>{ localStorage.setItem(userKey(user,'mastery'), JSON.stringify(mastery)); notifyChange(user); },[mastery,user]);
  useEffect(()=>{ localStorage.setItem(userKey(user,'wordStats'), JSON.stringify(wordStats)); notifyChange(user); },[wordStats,user]);
  useEffect(()=>{ localStorage.setItem(userKey(user,'translate_progress'), String(progress)); notifyChange(user); },[progress,user]);
  useEffect(()=>{ localStorage.setItem(userKey(user,'translate_stage'), String(stage)); notifyChange(user); },[stage,user]);

  function bumpAppearances(tokens){
    setWordStats(p=>{ const n={...p}; tokens.forEach(t=>{ if(!n[t.ar]) n[t.ar] = { gloss: t.gloss, appearances: 0, incorrect: 0, correct_streak: 0 }; n[t.ar].appearances+=1; }); return n; });
  }
  function markIncorrect(ar, gloss){
    setWordStats(p=>{ const n={...p}; if(!n[ar]) n[ar] = { gloss: gloss||"", appearances:0, incorrect:0, correct_streak:0 }; n[ar].incorrect+=1; n[ar].correct_streak=0; return n; });
  }
  function markCorrect(ar, gloss){
    setWordStats(p=>{ const n={...p}; if(!n[ar]) n[ar] = { gloss: gloss||"", appearances:0, incorrect:0, correct_streak:0 }; n[ar].correct_streak+=1; return n; });
  }

  useEffect(()=>{ if(sentence?.tokens) bumpAppearances(sentence.tokens); },[]);

  function playSentence(rate=1){ if(!sentence?.tokens?.length) return; const text = sentence.tokens.map(t => (showDiacritics ? t.ar : stripDiacritics(t.ar))).join(" "); const ok = speakText(text, ttsVoice, { rate }); setIsSpeaking(!!ok); }
  function stopSentence(){ stopSpeaking(); setIsSpeaking(false); }

  function newSentence(){
    stopSentence();
    setProgress(p => { const np = Math.min(100, p+10); if(np >= 30 && stage < 2) setStage(2); if(np >= 60 && stage < 3) setStage(3); return np; });
    const next = generateSentence(WORD_BANK, mistakes, mastery, stage, reviewMode);
    setSentence(next); bumpAppearances(next.tokens);
    setRevealed({}); setGuess(""); setChecked(false);
    notifyChange(user);
  }

  function toggle(i){
    setRevealed(r => {
      const updated = { ...r, [i]: !r[i] };
      if (!r[i]) { const word = sentence.tokens[i]; setMistakes(m => ({ ...m, [word.ar]: (m[word.ar] || 0) + 1 })); markIncorrect(word.ar, word.gloss); }
      return updated;
    });
  }

  function handleCheck(){
    setChecked(true);
    const hitUpdates = {};
    sentence.tokens.forEach((t,i)=>{ if(!revealed[i]){ hitUpdates[t.ar] = (hitUpdates[t.ar]||0)+1; markCorrect(t.ar, t.gloss); } });
    setMastery(prev=>{ const next={...prev}; for(const [w,n] of Object.entries(hitUpdates)) next[w]=(next[w]||0)+n; return next; });
    const revealsCount = Object.values(revealed).filter(Boolean).length;
    const s = Math.max(0,100-revealsCount*10);
    setRecentResults(prev => { const arr = [...prev, { score: s, reveals: revealsCount }].slice(-10); const avg = Math.round(arr.reduce((a,r)=>a+r.score,0)/arr.length); localStorage.setItem(userKey(user,'translate_avgScore'), String(avg)); localStorage.setItem(userKey(user,'translate_checks'), String(arr.length)); return arr; });
    recordActivity(user);
    if(revealsCount===0 && s>=95) awardBadge(user,'flawless_translate','🎯 Flawless','Checked a sentence with no reveals');
    const learned = learnedCount(wordStats);
    if(learned>=20) awardBadge(user,'learned_20','🏅 20 Learned Words','Built strong streaks on 20 words');
    notifyChange(user);
  }

  function score(){ const penalties = Object.values(revealed).filter(Boolean).length*10; return Math.max(0,100-penalties); }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📝 Translate Challenge</h2>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={reviewMode} onChange={e=>setReviewMode(e.target.checked)} /> Review Mode</label>
      </div>
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-emerald-50 to-amber-50" dir="rtl" style={{fontFamily:'Noto Naskh Arabic, Amiri, serif'}}>
        <div className="flex flex-wrap gap-3 text-2xl md:text-3xl leading-loose">
          {sentence.tokens.map((t,i)=>(
            <div key={i} className="relative">
              <button onClick={()=>toggle(i)} className="px-3 py-2 rounded-2xl font-bold bg-emerald-100 hover:bg-emerald-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition">
                {showDiacritics?t.ar:stripDiacritics(t.ar)}
              </button>
              {revealed[i] && <div className="absolute left-1/2 -translate-x-1/2 mt-1 text-xs whitespace-nowrap bg-amber-200 dark:bg-zinc-700 rounded px-2 py-1 shadow">{t.gloss}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 -mt-2">
        <button onClick={() => playSentence(1)} className="px-3 py-1.5 rounded-xl border">▶️ Play</button>
        <button onClick={() => playSentence(0.8)} className="px-3 py-1.5 rounded-xl border">🐢 Slow</button>
        <button onClick={stopSentence} className="px-3 py-1.5 rounded-xl border" disabled={!isSpeaking}>⏹ Stop</button>
      </div>
      <textarea value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Type your translation..." className="w-full min-h-[100px] p-4 rounded-2xl border" />
      <div className="flex gap-3">
        <button onClick={handleCheck} className="flex-1 py-3 rounded-2xl font-semibold bg-emerald-500 text-white hover:bg-emerald-600">Check</button>
        <button onClick={newSentence} className="flex-1 py-3 rounded-2xl font-semibold border hover:bg-gray-100">Next</button>
      </div>
      <div className="p-4 rounded-2xl border bg-emerald-50 dark:bg-zinc-800">
        <div className="font-medium">Score: {score()}</div>
        <div className="text-sm text-gray-600 dark:text-gray-300">Reference: {sentence.en}</div>
      </div>
    </div>
  );
}
