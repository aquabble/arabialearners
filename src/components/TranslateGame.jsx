import { useEffect, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import { API_BASE } from '../lib/apiBase.js'

export default function TranslateGame({ user }){
  const [stage, setStage] = useState('SVO')
  const [unit, setUnit] = useState('All')
  const [chapter, setChapter] = useState('All')
  const [direction, setDirection] = useState('ar2en') // default Arabic → English

  const [unitOptions, setUnitOptions] = useState(['All'])
  const [chaptersByUnit, setChaptersByUnit] = useState({})

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [ar, setAr] = useState('')
  const [en, setEn] = useState('')
  const [tokens, setTokens] = useState([])

  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)

  // discover Unit + Chapter options from semester1.json
  async function fetchUnitChapterOptions(){
    try {
      const res = await fetch('/semester1.json', { cache: 'no-store' });
      const data = await res.json();
      const units = ['All'];
      const byUnit = {};

      const arr = Array.isArray(data?.units) ? data.units : [];
      for (const u of arr) {
        const U = u?.unit;
        if (!U) continue;
        const unitName = U.name || U.id;
        if (!unitName) continue;
        if (!units.includes(unitName)) units.push(unitName);

        const chs = Array.isArray(U.chapters) ? U.chapters : [];
        byUnit[unitName] = ['All', ...chs.map(ch => ch?.name || ch?.id).filter(Boolean)];
      }

      setUnitOptions(units);
      setChaptersByUnit(byUnit);
    } catch (e) {
      // fallback
      setUnitOptions(['All']);
      setChaptersByUnit({});
    }
  }

  useEffect(() => { fetchUnitChapterOptions(); }, []);
  useEffect(() => { setChapter('All'); }, [unit]); // reset chapter when unit changes

  async function loadSentence(){
    setLoading(true); setErr(null); setFeedback(null); setGuess('')
    try{
      const res = await fetch(`${API_BASE}/api/sentence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, unit, chapter })
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

  useEffect(()=>{ loadSentence() }, [stage, unit, chapter])

  async function check(){
    setFeedback(null)
    try{
      const res = await fetch(`${API_BASE}/api/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, guess, referenceAr: ar, referenceEn: en })
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
            <select className="input" style={{width:160}} value={stage} onChange={e=>setStage(e.target.value)}>
              <option value="SV">SV</option>
              <option value="SVO">SVO</option>
              <option value="SVO+Time">SVO+Time</option>
            </select>
          </div>
          <div>
            Direction:&nbsp;
            <select className="input" style={{width:180}} value={direction} onChange={e=>setDirection(e.target.value)}>
              <option value="ar2en">Arabic → English</option>
              <option value="en2ar">English → Arabic</option>
            </select>
          </div>
          <div>
            Unit:&nbsp;
            <select className="input" style={{width:220}} value={unit} onChange={e=>setUnit(e.target.value)}>
              {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            Chapter:&nbsp;
            <select className="input" style={{width:240}} value={chapter} onChange={e=>setChapter(e.target.value)}>
              {(chaptersByUnit[unit] || ['All']).map(c => <option key={c} value={c}>{c}</option>)}
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
