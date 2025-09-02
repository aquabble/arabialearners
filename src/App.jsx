// src/App.jsx
import { useState } from 'react'
import Header from './components/ui/Header.jsx'
import Home from './components/Home.jsx'
import TranslateGame from './components/TranslateGame.jsx'
import WordOrderGame from './components/WordOrderGame.jsx'
import Words from './components/Words.jsx'

export default function App(){
  const [mode, setMode] = useState('home')
  const user = null

  return (
    <div className="app-root">
      <Header onNav={setMode} user={user} onSignIn={()=>setMode('signin')} onSignOut={()=>setMode('home')} />
      <main className="container" style={{paddingTop:16}}>
        {mode === 'home' && <Home onNav={setMode} user={user} />}
        {mode === 'translate' && <TranslateGame user={user} />}
        {mode === 'word-order' && <WordOrderGame user={user} />}
        {mode === 'words' && <Words user={user} />}
        {mode === 'signin' && (
          <div className="card" style={{padding:24, border:'1px solid var(--border)', borderRadius:12}}>
            <h3>Sign in</h3>
            <p className="small" style={{opacity:.8}}>Wire this to your auth flow.</p>
          </div>
        )}
      </main>
    </div>
  )
}
