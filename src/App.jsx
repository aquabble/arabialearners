// src/App.jsx
import { useEffect, useState } from 'react'
import Header from './components/ui/Header.jsx'
import Home from './components/Home.jsx'
import TranslateGame from './components/TranslateGame.jsx'
import WordOrderGame from './components/WordOrderGame.jsx'
import Words from './components/Words.jsx'
import SignIn from './components/SignIn.jsx'
import { onAuthChanged, signOutUser } from './lib/auth.js'

export default function App(){
  const [authUser, setAuthUser] = useState(null)
  useEffect(()=>{ const unsub = onAuthChanged(setAuthUser); return () => unsub && unsub(); },[])
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
        {mode === 'signin' && <SignIn onDone={()=>setMode('home')} />}
      </main>
    </div>
  )
}
