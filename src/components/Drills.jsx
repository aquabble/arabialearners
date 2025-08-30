import React, { useEffect, useState } from 'react'
import { userKey, recordActivity, awardBadge } from '../lib/persistence'
import { notifyChange } from '../lib/autoSync'
export default function Drills({ user }){
  const [wordStats, setWordStats] = useState(()=>JSON.parse(localStorage.getItem(userKey(user,'wordStats'))||"{}"));
  const [queue, setQueue] = useState([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(()=>{
    const items = Object.entries(wordStats).map(([ar,s])=>({ar,gloss:s.gloss||'', incorrect:s.incorrect||0, streak:s.correct_streak||0}));
    const pool = items.filter(w=>w.streak<15).sort((a,b)=> (b.incorrect - a.incorrect) || (a.streak - b.streak)).slice(0,20);
    const glosses = items.map(x=>x.gloss).filter(Boolean);
    function optionsFor(target){
      const decoys = glosses.filter(g=>g && g!==target.gloss).sort(()=>Math.random()-0.5).slice(0,3);
      return [target.gloss, ...decoys].sort(()=>Math.random()-0.5);
    }
    setQueue(pool.map(t=>({ ar:t.ar, gloss:t.gloss, options: optionsFor(t) })));
  },[]);

  function choose(opt){ setPicked(opt); }
  function next(){
    if(picked===null) return;
    const cur = queue[i];
    const correct = picked===cur.gloss;
    if(correct) setScore(s=>s+1);
    const ws = {...wordStats};
    ws[cur.ar] = ws[cur.ar] || {gloss:cur.gloss, appearances:0, incorrect:0, correct_streak:0};
    if(correct){ ws[cur.ar].correct_streak = (ws[cur.ar].correct_streak||0)+1; } else { ws[cur.ar].incorrect = (ws[cur.ar].incorrect||0)+1; ws[cur.ar].correct_streak = 0; }
    setWordStats(ws);
    localStorage.setItem(userKey(user,'wordStats'), JSON.stringify(ws)); notifyChange(user);
    if(i+1 >= queue.length){ setDone(true); recordActivity(user); if(score + (correct?1:0) >= 8) awardBadge(user,'drill_8','🎓 Drill Champ','Scored 8+ in a drill session'); notifyChange(user); } else { setI(i+1); setPicked(null); }
  }

  if(!queue.length) return (<div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 shadow"><div className="text-sm">No words need review right now. Come back after more practice!</div></div>);
  if(done) return (<div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 shadow"><div className="text-xl font-semibold mb-2">Drill Complete</div><div className="mb-4">Score: {score} / {queue.length}</div><div className="text-sm text-zinc-500">Your answers updated the Word Summary and will shape future sentences.</div></div>);
  const cur = queue[i];
  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 shadow space-y-4">
      <div className="text-sm text-zinc-500">Item {i+1} / {queue.length}</div>
      <div className="text-2xl" dir="rtl" style={{fontFamily:'Noto Naskh Arabic, Amiri, serif'}}>{cur.ar}</div>
      <div className="flex flex-wrap gap-2">
        {cur.options.map((o,idx)=> (<button key={idx} onClick={()=>choose(o)} className={`px-3 py-2 rounded-full border ${picked===o?'bg-emerald-500 text-white border-emerald-500':'bg-white hover:bg-gray-50'}`}>{o}</button>))}
      </div>
      <div className="flex gap-2">
        <button onClick={next} className="px-4 py-2 rounded-xl font-semibold bg-emerald-500 text-white">{i+1===queue.length?'Finish':'Next'}</button>
      </div>
    </div>
  );
}
