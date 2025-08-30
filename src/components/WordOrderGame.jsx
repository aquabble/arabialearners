import React, { useEffect, useState } from 'react'
import { getPreferredArabicVoice, speakText, stopSpeaking } from '../lib/tts'
import { userKey, recordActivity, awardBadge } from '../lib/persistence'
import { WORD_BANK, stripDiacritics, generateSentence } from '../lib/generator'
import { notifyChange } from '../lib/autoSync'

export default function WordOrderGame({ showDiacritics, user }){
  const [mistakes, setMistakes] = useState(()=>JSON.parse(localStorage.getItem(userKey(user,'mistakes'))||"{}"));
  const [mastery, setMastery] = useState(()=>JSON.parse(localStorage.getItem(userKey(user,'mastery'))||"{}"));
  const [wordStats, setWordStats] = useState(()=>JSON.parse(localStorage.getItem(userKey(user,'wordStats'))||"{}"));
  const [stage] = useState(1); const [reviewMode] = useState(false);
  const [ttsVoice, setTtsVoice] = useState(null); const [isSpeaking,setIsSpeaking]=useState(false);
  const [sentence, setSentence] = useState(()=>generateSentence(WORD_BANK, mistakes, mastery, stage, reviewMode));
  const [shuffled, setShuffled] = useState(()=>Array.from({length: sentence.tokens.length}, (_,i)=>i).sort(()=>Math.random()-0.5));
  const [selected, setSelected] = useState([]);
  const [checked, setChecked] = useState(false); const [isCorrect, setIsCorrect] = useState(null);

  useEffect(()=>{ if(sentence?.tokens) bumpAppearances(sentence.tokens); },[]);
  function bumpAppearances(tokens){ setWordStats(p=>{ const n={...p}; tokens.forEach(t=>{ if(!n[t.ar]) n[t.ar]={ gloss: t.gloss, appearances:0, incorrect:0, correct_streak:0 }; n[t.ar].appearances+=1; }); return n; }); }
  function markIncorrect(ar,gloss){ setWordStats(p=>{ const n={...p}; if(!n[ar]) n[ar]={ gloss: gloss||"", appearances:0, incorrect:0, correct_streak:0 }; n[ar].incorrect+=1; n[ar].correct_streak=0; return n; }); }
  function markCorrect(ar,gloss){ setWordStats(p=>{ const n={...p}; if(!n[ar]) n[ar]={ gloss: gloss||"", appearances:0, incorrect:0, correct_streak:0 }; n[ar].correct_streak+=1; return n; }); }

  useEffect(()=>{ if (!window.speechSynthesis) return; function pick(){ const v=getPreferredArabicVoice(); if(v) setTtsVoice(v); } pick(); window.speechSynthesis.onvoiceschanged = () => pick(); return () => { window.speechSynthesis.onvoiceschanged = null; stopSpeaking(); }; }, []);
  useEffect(()=>{ localStorage.setItem(userKey(user,'mistakes'), JSON.stringify(mistakes)); notifyChange(user); }, [mistakes,user]);
  useEffect(()=>{ localStorage.setItem(userKey(user,'mastery'), JSON.stringify(mastery)); notifyChange(user); }, [mastery,user]);
  useEffect(()=>{ localStorage.setItem(userKey(user,'wordStats'), JSON.stringify(wordStats)); notifyChange(user); }, [wordStats,user]);

  function playSentence(rate=1){ if(!sentence?.tokens?.length) return; const text = sentence.tokens.map(t=>t.ar).join(' '); const ok = speakText(text, ttsVoice, {rate}); setIsSpeaking(!!ok); }
  function stopSentence(){ stopSpeaking(); setIsSpeaking(false); }

  function choose(idx){ if(selected.includes(idx)) return; setSelected([...selected, idx]); }
  function undo(){ setSelected(prev=>prev.slice(0,-1)); }
  function clearSel(){ setSelected([]); }

  function handleCheck(){
    const order = selected.map(i=>shuffled[i]);
    const correct = order.length===sentence.tokens.length && order.every((o,i)=>o===i);
    setChecked(true); setIsCorrect(correct);
    if(correct){ sentence.tokens.forEach(t=>markCorrect(t.ar, t.gloss)); setMastery(prev=>{ const n={...prev}; sentence.tokens.forEach(t=>{ n[t.ar]=(n[t.ar]||0)+1; }); return n; }); }
    else{ sentence.tokens.forEach(t=>{ setMistakes(m=>({ ...m, [t.ar]:(m[t.ar]||0)+1 })); markIncorrect(t.ar, t.gloss); }); }
    const key = k => user ? `${user.email}_${k}` : k;
    const rounds = Number(localStorage.getItem(key('wordorder_rounds'))||0)+1;
    const correctCnt = Number(localStorage.getItem(key('wordorder_correct'))||0) + (correct?1:0);
    localStorage.setItem(key('wordorder_rounds'), String(rounds)); notifyChange(user);
    localStorage.setItem(key('wordorder_correct'), String(correctCnt)); notifyChange(user);
    recordActivity(user);
    if(correct && rounds>=10 && Math.round((correctCnt/rounds)*100) >= 90) awardBadge(user,'wo_ace','🧩 Word Order Ace','≥90% accuracy over 10+ rounds');
    notifyChange(user);
  }

  function nextRound(){
    const next = generateSentence(WORD_BANK, mistakes, mastery, stage, reviewMode);
    setSentence(next);
    setShuffled(Array.from({length: next.tokens.length}, (_,i)=>i).sort(()=>Math.random()-0.5));
    setSelected([]); setChecked(false); setIsCorrect(null);
    if(next?.tokens) bumpAppearances(next.tokens);
    notifyChange(user);
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center justify-between"><h2 className="text-2xl font-bold">🔀 Word Order</h2></div>
      <div className="p-5 rounded-2xl border bg-gradient-to-br from-emerald-50 to-amber-50" dir="rtl" style={{fontFamily:'Noto Naskh Arabic, Amiri, serif'}}>
        <div className="flex flex-wrap gap-3 text-2xl md:text-3xl leading-loose">
          {shuffled.map((origIdx, i)=> (
            <button key={i} onClick={()=>choose(i)} disabled={selected.includes(i)} className={`px-3 py-2 rounded-2xl font-bold transition ${selected.includes(i)?'bg-zinc-300':'bg-emerald-100 hover:bg-emerald-200'}`}>
              {showDiacritics ? sentence.tokens[origIdx].ar : stripDiacritics(sentence.tokens[origIdx].ar)}
            </button>
          ))}
        </div>
      </div>
      <div><div className="text-sm mb-2">Your order:</div>
        <div className="flex flex-wrap gap-2" dir="rtl" style={{fontFamily:'Noto Naskh Arabic, Amiri, serif'}}>
          {selected.map((idx, i)=> (<span key={i} className="px-3 py-2 rounded-2xl bg-sky-100">{showDiacritics ? sentence.tokens[shuffled[idx]].ar : stripDiacritics(sentence.tokens[shuffled[idx]].ar)}</span>))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={undo} className="px-3 py-2 rounded-xl border">Undo</button>
        <button onClick={clearSel} className="px-3 py-2 rounded-xl border">Clear</button>
        <button onClick={()=>playSentence(1)} className="ml-auto px-3 py-2 rounded-xl border">▶️ Play</button>
        <button onClick={()=>playSentence(0.8)} className="px-3 py-2 rounded-xl border">🐢 Slow</button>
        <button onClick={stopSentence} disabled={!isSpeaking} className="px-3 py-2 rounded-xl border">⏹ Stop</button>
      </div>
      <div className="flex gap-3">
        <button onClick={handleCheck} className="flex-1 py-3 rounded-2xl font-semibold bg-emerald-500 text-white hover:bg-emerald-600">Check</button>
        <button onClick={nextRound} className="flex-1 py-3 rounded-2xl font-semibold border hover:bg-gray-100">Next</button>
      </div>
      {checked && (<div className={`p-4 rounded-2xl border ${isCorrect?'bg-emerald-50 border-emerald-200':'bg-rose-50 border-rose-200'}`}><div className="font-medium">{isCorrect ? 'Nice! Correct order.' : 'Not quite. Try the next one!'}</div></div>)}
    </div>
  );
}
