import React, { useState } from 'react'
import TranslateGame from './components/TranslateGame.jsx'
import WordOrderGame from './components/WordOrderGame.jsx'

export default function App(){
  const [tab, setTab] = useState('translate')
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>ArabiaLearners</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={()=>setTab('translate')}>Translate Game</button>
        <button onClick={()=>setTab('wordorder')}>Word Order</button>
      </div>
      {tab==='translate' ? <TranslateGame /> : <WordOrderGame />}
    </div>
  )
}
