// src/components/TranslateGame.jsx
import { useEffect, useRef, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import { API_BASE } from '../lib/apiBase.js'
import { recordResult } from '../lib/wordStats.js'

export default function TranslateGame({ user }){
  const [difficulty, setDifficulty] = useState('medium')  // short | medium | long
  const [unit, setUnit] = useState('All')
  const [chapter, setChapter] = useState('All')
  const [direction, setDirection] = useState('ar2en')

  const [timeMode, setTimeMode] = useState('none') // none | custom
  const [timeText, setTimeText] = useState('')

  const [unitOptions, setUnitOptions] = useState(['All'])
  const [chaptersByUnit, setChaptersByUnit] = useState({})

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [ar, setAr] = useState('')
  const [en, setEn] = useState('')
  const [tokens, setTokens] = useState([])

  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)

  // queues per (difficulty,unit,chapter,timeMode,timeText)
  const queuesRef = useRef(new Map())
  const inflightRef = useRef(null)
  const scopeKey = (d=difficulty,u=unit,c=chapter,t=timeMode,tt=timeText.trim()) => `${d}__${u}__${c}__${t}__${tt}`

  async function fetchUnitChapterOptions(){
    try {
      const res = await fetch('/api/glossary', { cache: 'no-store' })
      const data = await res.json()
      const units = ['All']
      const byUnit = {}
      const sems = Array.isArray(data?.semesters) ? data.semesters : []
      for (const sem of sems) {
        const ulist = Array.isArray(sem?.units) ? sem.units : []
        for (const U of ulist) {
          const unitName = U?.name || U?.id
          if (!unitName) continue
          if (!units.includes(unitName)) units.push(unitName)
          const chs = Array.isArray(U?.chapters) ? U.chapters : []
          byUnit[unitName] = ['All', ...chs.map(ch => ch?.name || ch?.id).filter(Boolean)]
        }
      }
      setUnitOptions(units)
      setChaptersByUnit(byUnit)
    } catch {
      setUnitOptions(['All'])
      setChaptersByUnit({})
    }
  }
  useEffect(() => { fetchUnitChapterOptions() }, [])
  useEffect(() => { setChapter('All') }, [unit])

  function abortInflight(){
    if (inflightRef.current?.controller){
      try { inflightRef.current.controller.abort('scope-changed') } catch {}
    }
    inflightRef.current = null
  }

  async function prefetch(size=5, timeoutMs=8000){
    const key = scopeKey()
    if (!queuesRef.current.has(key)) queuesRef.current.set(key, [])
    const controller = new AbortController()
    inflightRef.current = { controller, scopeKey: key }

    const id = setTimeout(() => controller.abort('timeout'), timeoutMs)
    try {
      const res = await fetch(`${API_BASE}/api/sentence-bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, unit, chapter, size, timeMode, timeText, direction }),
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`bundle ${res.status}: ${await res.text()}`)
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : []
      const q = queuesRef.current.get(key) || []
      q.push(...items)
      queuesRef.current.set(key, q)
    } finally {
      clearTimeout(id)
      inflightRef.current = null
    }
  }

  async function ensureWarm(min=2){
    const key = scopeKey()
    const q = queuesRef.current.get(key) || []
    if (q.length < min && !inflightRef.current){
      const size = q.length === 0 ? 3 : 5
      prefetch(size).catch(()=>{})
    }
  }

  async function showNext(){
    setLoading(true); setErr(null); setFeedback(null); setGuess('')
    const key = scopeKey()
    let q = queuesRef.current.get(key) || []
    if (q.length === 0){
      try {
        await prefetch(3)
      } catch (e) {
        if (e?.name !== 'AbortError') {
          setErr(`Prefetch error: ${String(e)}`)
        }
      }
      q = queuesRef.current.get(key) || []
    }
    const item = q.shift()
    queuesRef.current.set(key, q)
    if (item){
      setAr(item.ar); setEn(item.en); setTokens(item.tokens || [])
      setLoading(false)
      ensureWarm(2)
    }else{
      setErr('No sentences available for this selection right now.')
      setLoading(false)
    }
  }

  // reset on scope change
  useEffect(() => {
    abortInflight()
    const key = scopeKey()
    queuesRef.current.set(key, [])
    showNext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, unit, chapter, timeMode, timeText])

  async function check(){
    setFeedback(null)
    try{
      const res = await fetch(`${API_BASE}/api/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, guess, referenceAr: ar, referenceEn: en })
      })
      const data = await res.json()
      setFeedback(data)
      try { recordResult({ arSentence: ar, tokens, verdict: data?.verdict }); } catch {}
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
        <CardSub>AI sentences • AI grading</CardSub>

        {/* controls */}
        <div className="small mb-16" style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <div>Difficulty: <select className="input" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select></div>
          <div>Direction: <select className="input" value={direction} onChange={e=>setDirection(e.target.value)}>
            <option value="ar2en">Arabic → English</option>
            <option value="en2ar">English → Arabic</option>
          </select></div>
          <div>Unit: <select className="input" value={unit} onChange={e=>setUnit(e.target.value)}>
            {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
          </select></div>
          <div>Chapter: <select className="input" value={chapter} onChange={e=>setChapter(e.target.value)}>
            {(chaptersByUnit[unit] || ['All']).map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>

          {/* time sub-tab */}
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span>Time:</span>
            <div className="btn-group" role="tablist" style={{display:'inline-flex', gap:6}}>
              <button type="button" className={`btn ${timeMode==='none'?'brand':''}`} onClick={()=>setTimeMode('none')}>None</button>
              <button type="button" className={`btn ${timeMode==='custom'?'brand':''}`} onClick={()=>setTimeMode('custom')}>Add</button>
            </div>
            {timeMode==='custom' && (
              <input className="input" style={{minWidth:220}} placeholder="e.g., yesterday morning / at 5pm / on Friday"
                value={timeText} onChange={e=>setTimeText(e.target.value)} />
            )}
          </div>
        </div>

        {loading ? <div className="small">Getting a sentence…</div> : (
          <>
            <div className="title mb-16">
              {direction === 'ar2en' ? <>Arabic: <span>{prompt}</span></> : <>English: <span>{prompt}</span></>}
            </div>
            <Input placeholder={placeholder} value={guess} onChange={e=>setGuess(e.target.value)} />
            <div className="mt-16 flex gap-16">
              <Button variant="brand" onClick={check}>Check</Button>
              <Button className="ghost" onClick={showNext}>Next</Button>
              {feedback && (
                <span className={`badge ${feedback.verdict==='correct'?'ok': feedback.verdict==='minor'?'warn':''}`}>
                  {feedback.verdict==='correct'?'Correct':feedback.verdict==='minor'?'Almost':'Try again'}
                </span>
              )}
            </div>
            {feedback?.hint && <div className="small mt-16">{feedback.hint}</div>}
            <div className="small mt-16">Reference:
              <details><summary>Show</summary>
                <div><b>Arabic:</b> {ar}</div>
                <div><b>English:</b> {en}</div>
              </details>
            </div>
          </>
        )}
        {err && <div className="small mt-16">Note: {String(err)}</div>}
      </CardBody>
    </Card>
  )
}
