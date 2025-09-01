import React, { useState } from 'react'
import Home from './components/Home'
import StudyShell from './components/StudyShell'
import ProfileFirebase from './components/ProfileFirebase'
export default function AppFirebase(){
  const [showDiacritics,setShowDiacritics]=useState(true)
  const [user,setUser]=useState(null)
  const [screen,setScreen]=useState('home')
  return (<div className="min-h-screen bg-gradient-to-br from-emerald-200 via-sky-100 to-amber-200 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 flex items-center justify-center p-6"><div className="max-w-4xl w-full">{!user ? (<ProfileFirebase onLogin={setUser} />) : (<><div className="mb-4 flex items-center justify-between"><div className="text-xl font-bold">📚 Arabic Learner</div><div className="flex items-center gap-2"><button onClick={()=>setScreen('home')} className={`px-3 py-1.5 rounded-full border ${screen==='home'?'bg-white/80 border-white shadow':'border-zinc-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50'}`}>Home</button><button onClick={()=>setScreen('study')} className={`px-3 py-1.5 rounded-full border ${screen==='study'?'bg-white/80 border-white shadow':'border-zinc-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50'}`}>Study</button><label className="ml-2 text-xs flex items-center gap-1"><input type="checkbox" checked={showDiacritics} onChange={e=>setShowDiacritics(e.target.checked)} /> Show diacritics</label></div></div>{screen==='home' ? (<Home user={user} />) : (<StudyShell showDiacritics={showDiacritics} user={user} />)}</>)}</div></div>)
}
