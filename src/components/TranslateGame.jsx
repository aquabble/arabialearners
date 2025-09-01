import { useEffect, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import { API_BASE } from '../lib/apiBase.js'

function normAr(s=''){
  return s.normalize('NFKC')
    .replace(/[\u064B-\u0652]/g,'') // strip diacritics
    .replace(/\s+/g,' ')
    .trim()
}
function normEn(s=''){
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()
}

export default function TranslateGame({ user }){
  const [stage, setStage] = useState('SVO')         // SV | SVO | SVO+Time
  const [unit, setUnit] = useState('All')           // if you implemented unit filter
  const [direction, setDirection] = useState('ar2en') // 'ar2en' (default) or 'en2ar'

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
      const res = await fetch(`${API_BASE}/api/sentence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, unit })
      })
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`sentence ${res.status}: ${text}`);
      }
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

  useEffect(()=>{ loadSentence() }, [stage, unit])

  async function check(){
    setFeedback(null)
    try{
      const res = await fetch(`${API_BASE}/api/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          guess,
          referenceAr: ar,
          referenceEn: en
        })
      })
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`grade ${res.status}: ${text}`);
      }
      const data = await res.json()
      setFeedback(data)
    }catch(e){
      setFeedback({ verdict:'wrong', hint:'Could not reach grader. ' + String(e) })
    }
  }

  const prompt = direction === 'ar2en' ? ar : en
  const placeholder = direction === 'ar2en' ? 'Type the English meaning…' : 'اكتب الجواب بالعربية…'

  return (
    <Card>
      <CardBody>
        <CardTitle>Translate</CardTitle>
        <CardSub>AI‑generated sentences • AI grading with hints</CardSub>

        <div className="small mb-16" style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <div>
            Stage:&nbsp;
            <select className="input" style={{width:180, display:'inline-block'}} value={stage} onChange={e=>setStage(e.target.value)}>
              <option value="SV">SV</option>
              <option value="SVO">SVO</option>
              <option value="SVO+Time">SVO+Time</option>
            </select>
          </div>
          <div>
            Direction:&nbsp;
            <select className="input" style={{width:180, display:'inline-block'}} value={direction} onChange={e=>setDirection(e.target.value)}>
              <option value="ar2en">Arabic → English</option>
              <option value="en2ar">English → Arabic</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="small">Generating…</div>
        ) : (
          <>
            <div className="title mb-16">
              {direction === 'ar2en' ? <>Arabic:&nbsp;<span>{prompt}</span></> : <>English:&nbsp;<span>{prompt}</span></>}
            </div>
            <Input placeholder={placeholder} value={guess} onChange={e=>setGuess(e.target.value)} />
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
            <div className="small mt-16">Reference (tap to reveal):
              <details><summary>Show both</summary>
                <div style={{marginTop:8}}><strong>Arabic:</strong> {ar}</div>
                <div><strong>English:</strong> {en}</div>
              </details>
            </div>
          </>
        )}

        {err && <div className="small mt-16">Note: {String(err)}</div>}
      </CardBody>
    </Card>
  )
}
