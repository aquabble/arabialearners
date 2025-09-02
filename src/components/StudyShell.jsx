// src/components/StudyShell.jsx
import { useEffect } from 'react'
import Header from './ui/Header.jsx'
import Tabs from './ui/Tabs.jsx'

export default function StudyShell({ user, mode, setMode, onSignIn, onLogout, children }){
  const items = [
    {label:'Home', value:'home'},
    {label:'Translate', value:'translate'},
    {label:'Word Order', value:'word-order'}
  ]

  const isGame = mode === 'translate' || mode === 'word-order'

  useEffect(() => {
    if (isGame) document.body.classList.add('game-mode')
    else document.body.classList.remove('game-mode')
    return () => document.body.classList.remove('game-mode')
  }, [isGame])

  return (
    <div className={isGame ? 'game-shell' : ''}>
      <Header
        user={user}
        compact={isGame}
        onSignIn={onSignIn}
        onLogout={onLogout}
        onNav={setMode}
        items={items}
        current={mode}     // ← pass current to highlight active row
        right={isGame ? null : <div className="badge ok">Beta</div>}
      />

      <div className={isGame ? 'container game-container' : 'container'}>
        {!isGame && (
          <div className="hero">
            <h1>{user ? 'Keep your streak. Learn smarter.' : 'Welcome to Arabic Learner'}</h1>
            <p>{user ? 'Daily Arabic practice with spaced repetition, clean UI, and instant feedback.' : 'Sign in to save progress, track streaks, and unlock your personalized plan.'}</p>
            <div className="mt-16"><Tabs value={mode} onChange={setMode} items={items} /></div>
          </div>
        )}

        <div className={isGame ? 'game-frame' : 'mt-16 cards'}>
          {children}
        </div>
      </div>
    </div>
  )
}
