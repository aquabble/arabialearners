// src/components/Home.jsx
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Progress from './ui/Progress.jsx'
import Button from './ui/Button.jsx'

export default function Home({ mastery=62, woAcc=84, onNav = ()=>{}, user = null }){
  return (
    <div className="cards">
      <div className="card"><div className="card-body">
        <CardTitle>{user ? 'Placement' : 'Welcome'}</CardTitle>
        <CardSub>{user ? 'Overall Mastery' : 'Sign in to start'}</CardSub>
        {user ? (
          <>
            <Progress value={mastery} />
            <div className="small mt-16">You're outperforming 78% of learners this week.</div>
          </>
        ) : (
          <div className="small">Track mastery once you’re signed in.</div>
        )}
      </div></div>

      <div className="card"><div className="card-body">
        <CardTitle>Quick Start</CardTitle>
        <CardSub>{user ? 'Jump back in' : 'Try a mode (progress won’t save)'}</CardSub>
        <div className="mt-16">
          <div className="flex gap-16">
            <Button className="w-full" variant="brand" onClick={()=>onNav('translate')}>Translate</Button>
            <Button className="w-full" onClick={()=>onNav('word-order')}>Word Order</Button>
          </div>
        </div>
      </div></div>

      <div className="card"><div className="card-body">
        <CardTitle>Accuracy</CardTitle>
        <CardSub>Word Order</CardSub>
        {user ? (
          <>
            <div className="title">{woAcc}%</div>
            <div className="small">Keep above 80% to unlock Speed Mode.</div>
          </>
        ) : (
          <div className="small">Sign in to see your accuracy over time.</div>
        )}
      </div></div>
    </div>
  )
}
