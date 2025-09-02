import { useEffect, useState } from 'react'
import StudyShell from './components/StudyShell.jsx'
import Home from './components/Home.jsx'
import TranslateGame from './components/TranslateGame.jsx'
import WordOrderGame from './components/WordOrderGame.jsx'
import { signInWithGoogle, signOutUser, onAuthChanged, completeRedirectIfNeeded } from './lib/auth.js'

export default function App(){
  const [mode, setMode] = useState('home')
  const [user, setUser] = useState(null)

  useEffect(() => {
    completeRedirectIfNeeded()
    const unsub = onAuthChanged(u => setUser(u))
    return () => unsub && unsub()
  }, [])

  return (
    <StudyShell
      user={user}
      mode={mode}
      setMode={setMode}
      onSignIn={async () => { await signInWithGoogle() }}
      onLogout={async () => { await signOutUser() }}
    >
      {mode === 'home' && <Home onNav={setMode} user={user} />}
      {mode === 'translate' && <TranslateGame user={user} />}
      {mode === 'word-order' && <WordOrderGame user={user} />}
    </StudyShell>
  )
}
