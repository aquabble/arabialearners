import React, { useState } from 'react'
import StudyShell from './components/StudyShell.jsx'
import Home from './components/Home.jsx'
import TranslateGame from './components/TranslateGame.jsx'
import WordOrderGame from './components/WordOrderGame.jsx'
import Drills from './components/Drills.jsx'
import GrammarHub from './components/GrammarHub.jsx'

export default function App(){
  const [mode, setMode] = useState('home')
  const [showDiacritics, setShowDiacritics] = useState(true)
  const [user, setUser] = useState(null)

  return (
    <StudyShell user={user} mode={mode} setMode={setMode}>
      {mode === 'home' && <Home onNav={setMode} />}
      {mode === 'translate' && <TranslateGame showDiacritics={showDiacritics} user={user} />}
      {mode === 'word-order' && <WordOrderGame user={user} />}
      {mode === 'drills' && <Drills user={user} />}
      {mode === 'grammar' && <GrammarHub />}
    </StudyShell>
  )
}
