import Header from './ui/Header.jsx';
import { Tabs } from './ui/Tabs.jsx';
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx';

export default function StudyShell({ user, mode, setMode, onSignIn, onLogout, children }){
  const items = [
    {label:'Home', value:'home'},
    {label:'Translate', value:'translate'},
    {label:'Word Order', value:'word-order'},
    {label:'Drills', value:'drills'},
    {label:'Grammar', value:'grammar'}
  ];

  return (
    <div>
      <Header user={user} onSignIn={onSignIn} onLogout={onLogout} right={<div className="badge ok">Beta</div>} />
      <div className="container">
        <div className="hero">
          <h1>{user ? 'Keep your streak. Learn smarter.' : 'Welcome to Arabic Learner'}</h1>
          <p>{user ? 'Daily Arabic practice with spaced repetition, clean UI, and instant feedback.' : 'Sign in to save progress, track streaks, and unlock your personalized plan.'}</p>
          <div className="mt-16">
            <Tabs value={mode} onChange={setMode} items={items} />
          </div>
        </div>

        <div className="mt-16 grid cols-3">
          {user ? (
            <>
              <Card><CardBody><CardTitle>Today</CardTitle><CardSub>Your plan</CardSub>
                <div className="small">10 translations • 6 word-order cards • 1 grammar path</div>
              </CardBody></Card>
              <Card><CardBody><CardTitle>Mastery</CardTitle><CardSub>Progress</CardSub>
                <div className="small">Coverage up 12% this week. Keep going!</div>
              </CardBody></Card>
              <Card><CardBody><CardTitle>Streak</CardTitle><CardSub>🔥 6 days</CardSub>
                <div className="small">Two more for a new badge.</div>
              </CardBody></Card>
            </>
          ) : (
            <>
              <Card><CardBody><CardTitle>Get started</CardTitle><CardSub>No account yet</CardSub>
                <div className="small">Sign in to sync progress across devices.</div>
              </CardBody></Card>
              <Card><CardBody><CardTitle>Personalized plan</CardTitle><CardSub>Locked</CardSub>
                <div className="small">We’ll build a daily plan based on your strengths.</div>
              </CardBody></Card>
              <Card><CardBody><CardTitle>Streaks</CardTitle><CardSub>Locked</CardSub>
                <div className="small">Keep a streak to earn badges and bonuses.</div>
              </CardBody></Card>
            </>
          )}
        </div>

        <div className="mt-16">
          {children}
        </div>
      </div>
    </div>
  )
}
