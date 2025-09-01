import { useEffect, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'

function normalize(s=''){
  return s.normalize('NFKC')
    .replace(/[\u064B-\u0652]/g,'') // strip diacritics
    .replace(/\s+/g,' ')
    .trim()
}

export default function TranslateGame({ showDiacritics=true, user }){
  const [stage, setStage] = useState('SVO')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [ar, setAr] = useState('')
  const [en, setEn] = useState('')
  const [tokens, setTokens] = useState([])

  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)

  async function loadSentence(){
    setLoading(true); setErr(null); setFeedback(null); setGuess('')
    try{
      const res = await fetch('/api/sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }) // server picks focus words from semester1.json
      })
      const data = await res.json()
      if(data.error) throw new Error(data.error)
      setAr(data.ar); setEn(data.en); setTokens(data.tokens || [])
    }catch(e){
      setErr(String(e))
      setAr('الولد يقرأ الكتاب.'); setEn('The boy reads the book.'); setTokens(['S','V','O'])
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ loadSentence() }, [stage])

  async function check(){
    const fastMatch = normalize(guess) === normalize(ar)
    if(fastMatch){ setFeedback({ verdict:'correct', hint:'✅ Perfect match' }); return; }

    try{
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess, referenceAr: ar, referenceEn: en })
      })
      const data = await res.json()
      setFeedback(data)
    }catch(e){
      setFeedback({ verdict:'wrong', hint:'Could not reach grader. Try again.' })
    }
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>Translate</CardTitle>
        <CardSub>AI-driven using Semester 1 vocabulary</CardSub>

        <div className="small mb-16">
          Stage:&nbsp;
          <select className="input" style={{width:180, display:'inline-block'}} value={stage} onChange={e=>setStage(e.target.value)}>
            <option value="SV">SV</option>
            <option value="SVO">SVO</option>
            <option value="SVO+Time">SVO+Time</option>
          </select>
        </div>

        {loading ? (
          <div className="small">Generating from Semester 1 vocab…</div>
        ) : (
          <>
            <div className="title mb-16">English: {en}</div>
            <Input placeholder="اكتب الجواب هنا…" value={guess} onChange={e=>setGuess(e.target.value)} />
            <div className="mt-16 flex items-center gap-16">
              <Button variant="brand" onClick={check}>Check</Button>
              <Button className="ghost" onClick={loadSentence}>Next</Button>
              {feedback && (
                <span className={`badge ${feedback.verdict==='correct'?'ok': feedback.verdict==='minor'?'warn':''}`}>
                  {feedback.verdict === 'correct' ? 'Correct' : feedback.verdict === 'minor' ? 'Almost' : 'Try again'}
                </span>
              )}
            </div>
            {feedback && feedback.hint && <div className="small mt-16">{feedback.hint}</div>}
            <div className="small mt-16">Reference (tap to reveal): <details><summary>Show Arabic</summary><div style={{marginTop:8}}>{ar}</div></details></div>
          </>
        )}

        {err && <div className="small mt-16">Note: {String(err)}</div>}
      </CardBody>
    </Card>
  )
}