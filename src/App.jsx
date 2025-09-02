// src/App.jsx
import { useState } from 'react'
import Home from './components/Home.jsx'
import TranslateGame from './components/TranslateGame.jsx'
import WordOrderGame from './components/WordOrderGame.jsx'
import Words from './components/Words.jsx'

export default function App(){
  const [mode, setMode] = useState('home')
  const user = null

  return (
    <div className="container">
      {mode === 'home' && <Home onNav={setMode} user={user} />}
      {mode === 'translate' && <TranslateGame user={user} />}
      {mode === 'word-order' && <WordOrderGame user={user} />}
      {mode === 'words' && <Words user={user} />}
    </div>
  )
}
