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
  const [mode, setMode] = useState('home')
  const [authUser, setAuthUser] = useState(null)

  // Keep authUser in sync with Firebase
  useEffect(() => {
    const unsub = onAuthChanged(setAuthUser)
    return () => unsub && unsub()
  }, [])

  return (
    <div className="app-root">
      <Header
        onNav={setMode}
        user={authUser}
        onSignIn={() => setMode('signin')}
        onSignOut={async () => {
          await signOutUser()
          setMode('home')
        }}
        items={[
          { value: 'home',       label: 'Home' },
          { value: 'translate',  label: 'Translate' },
          { value: 'words',      label: 'Words' },
          { value: 'word-order', label: 'Word Order' }
        ]}
        current={mode}
      />

      <main className="container" style={{ paddingTop: 16 }}>
        {mode === 'home' && <Home onNav={setMode} user={authUser} />}
        {mode === 'translate' && <TranslateGame user={authUser} />}
        {mode === 'word-order' && <WordOrderGame user={authUser} />}
        {mode === 'words' && <Words user={authUser} />}
        {mode === 'signin' && <SignIn onDone={() => setMode('home')} />}
      </main>
    </div>
  )
}
