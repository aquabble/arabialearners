// src/components/StudyShell.jsx
import Header from './ui/Header.jsx'
import Tabs from './ui/Tabs.jsx'

export default function StudyShell({ user, mode, setMode, onSignIn, onLogout, children }){
  const items = [
    {label:'Home', value:'home'},
    {label:'Translate', value:'translate'},
    {label:'Word Order', value:'word-order'}
  ]
  return (
    <div>
      <Header user={user} onSignIn={onSignIn} onLogout={onLogout} right={<div className="badge ok">Beta</div>} />
      <div className="container">
        <div className="hero">
          <h1>{user ? 'Keep your streak. Learn smarter.' : 'Welcome to Arabic Learner'}</h1>
          <p>{user ? 'Daily Arabic practice with spaced repetition, clean UI, and instant feedback.' : 'Sign in to save progress, track streaks, and unlock your personalized plan.'}</p>
          <div className="mt-16"><Tabs value={mode} onChange={setMode} items={items} /></div>
        </div>

        <div className="mt-16 cards">
          {children}
        </div>
      </div>
    </div>
  )
}
