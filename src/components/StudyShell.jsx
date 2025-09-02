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

  // Toggle a body class for global game-mode styling (safe-area, padding, etc.)
  useEffect(() => {
    if (isGame) document.body.classList.add('game-mode')
    else document.body.classList.remove('game-mode')
    return () => document.body.classList.remove('game-mode')
  }, [isGame])

  return (
    <div className={isGame ? 'game-shell' : ''}>
      <Header
        user={user}
        compact={isGame}          // ← compact header in games (no tabs in header)
        onSignIn={onSignIn}
        onLogout={onLogout}
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

        {/* Game frame gets edge-to-edge focus with less chrome */}
        <div className={isGame ? 'game-frame' : 'mt-16 cards'}>
          {children}
        </div>
      </div>
    </div>
  )
}
