import { useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'

export default function TranslateGame({ showDiacritics=true, user }){
  const [q, setQ] = useState('Translate: "the beautiful garden"');
  const [a, setA] = useState('');
  const [feedback, setFeedback] = useState(null);

  function check(){
    setFeedback(a.trim() ? 'Looks good!' : 'Try again');
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>Translate</CardTitle>
        <CardSub>Instant feedback</CardSub>
        <div className="title mb-16">{q}</div>
        <Input placeholder="اكتب الجواب هنا…" value={a} onChange={e=>setA(e.target.value)} />
        <div className="mt-16 flex items-center gap-16">
          <Button variant="brand" onClick={check}>Check</Button>
          {feedback && <span className="badge ok">{feedback}</span>}
          <span className="small">Diacritics: {showDiacritics ? 'ON' : 'OFF'}</span>
        </div>
      </CardBody>
    </Card>
  )
}