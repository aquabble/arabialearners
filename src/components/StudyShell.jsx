import React, { useState } from 'react'
import TranslateGame from './TranslateGame'
import WordOrderGame from './WordOrderGame'
import GrammarHub from './GrammarHub'
import Drills from './Drills'
export default function StudyShell({ showDiacritics, user }){
  const [mode,setMode]=useState('translate')
  return (<div className="space-y-4"><div className="flex items-center gap-2 flex-wrap"><button onClick={()=>setMode('translate')} className={`px-3 py-1.5 rounded-full border ${mode==='translate'?'bg-emerald-500 text-white border-emerald-500':''}`}>Translate</button><button onClick={()=>setMode('wordorder')} className={`px-3 py-1.5 rounded-full border ${mode==='wordorder'?'bg-emerald-500 text-white border-emerald-500':''}`}>Word Order</button><button onClick={()=>setMode('grammar')} className={`px-3 py-1.5 rounded-full border ${mode==='grammar'?'bg-emerald-500 text-white border-emerald-500':''}`}>Grammar</button><button onClick={()=>setMode('drills')} className={`px-3 py-1.5 rounded-full border ${mode==='drills'?'bg-emerald-500 text-white border-emerald-500':''}`}>Drills</button></div>{mode==='translate'&&(<TranslateGame showDiacritics={showDiacritics} user={user}/>)}{mode==='wordorder'&&(<WordOrderGame showDiacritics={showDiacritics} user={user}/>)}{mode==='grammar'&&(<GrammarHub user={user}/>)}{mode==='drills'&&(<Drills user={user}/>)} </div>)
}
