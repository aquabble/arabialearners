import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Progress from './ui/Progress.jsx'
import Button from './ui/Button.jsx'

export default function Home({ mastery=62, woAcc=84 }){
  return (
    <div className="grid cols-3">
      <div className="card"><div className="card-body">
        <CardTitle>Placement</CardTitle>
        <CardSub>Overall Mastery</CardSub>
        <Progress value={mastery} />
        <div className="small mt-16">You're outperforming 78% of learners this week.</div>
      </div></div>

      <div className="card"><div className="card-body">
        <CardTitle>Quick Start</CardTitle>
        <CardSub>Jump back in</CardSub>
        <div className="grid cols-2 mt-16">
          <Button className="w-full" variant="brand" onClick={()=>window.dispatchEvent(new CustomEvent('nav',{detail:'translate'}))}>Translate</Button>
          <Button className="w-full" onClick={()=>window.dispatchEvent(new CustomEvent('nav',{detail:'word-order'}))}>Word Order</Button>
        </div>
        <div className="grid cols-2 mt-16">
          <Button className="w-full" onClick={()=>window.dispatchEvent(new CustomEvent('nav',{detail:'drills'}))}>Drills</Button>
          <Button className="w-full" onClick={()=>window.dispatchEvent(new CustomEvent('nav',{detail:'grammar'}))}>Grammar Hub</Button>
        </div>
      </div></div>

      <div className="card"><div className="card-body">
        <CardTitle>Accuracy</CardTitle>
        <CardSub>Word Order</CardSub>
        <div className="title">{woAcc}%</div>
        <div className="small">Try to keep above 80% to unlock Speed Mode.</div>
      </div></div>
    </div>
  )
}