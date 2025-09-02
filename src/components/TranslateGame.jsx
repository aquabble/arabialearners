import { useEffect, useRef, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import { API_BASE } from '../lib/apiBase.js'

export default function TranslateGame({ user }){
  const [stage, setStage] = useState('SVO')
  const [unit, setUnit] = useState('All')
  const [chapter, setChapter] = useState('All')
  const [direction, setDirection] = useState('ar2en')

  const [unitOptions, setUnitOptions] = useState(['All'])
  const [chaptersByUnit, setChaptersByUnit] = useState({})

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [ar, setAr] = useState('')
  const [en, setEn] = useState('')
  const [tokens, setTokens] = useState([])

  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)

  // queues per (stage,unit,chapter)
  const queuesRef = useRef(new Map())
  const inflightRef = useRef(null)
  const scopeKey = (s=stage,u=unit,c=chapter) => `${s}__${u}__${c}`

  async function fetchUnitChapterOptions(){
    try {
      const res = await fetch('/semester1.json', { cache: 'no-store' })
      const data = await res.json()
      const units = ['All']
      const byUnit = {}
      const arr = Array.isArray(data?.units) ? data.units : []
      for (const u of arr) {
        const U = u?.unit
        if (!U) continue
        const unitName = U.name || U.id
        if (!unitName) continue
        if (!units.includes(unitName)) units.push(unitName)
        const chs = Array.isArray(U.chapters) ? U.chapters : []
        byUnit[unitName] = ['All', ...chs.map(ch => ch?.name || ch?.id).filter(Boolean)]
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
        // FIX: the API expects `size`, not `count`
        body: JSON.stringify({ stage, unit, chapter, size, scopeKey: key }),
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`bundle ${res.status}: ${await res.text()}`)
      const data = await res.json()
      // FIX: only compare when server sends scopeKey (current endpoint doesn't)
      if (data.scopeKey && data.scopeKey !== key) return
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
      // already guarded; AbortError won’t surface
      prefetch(size).catch(()=>{})
    }
  }

  async function showNext(){
    setLoading(true); setErr(null); setFeedback(null); setGuess('')
    const key = scopeKey()
    let q = queuesRef.current.get(key) || []
    if (q.length === 0){
      // FIX: guard against AbortError / timeout so console stays clean
      try {
        await prefetch(3)
      } catch (e) {
        if (e?.name !== 'AbortError') {
          // Non-abort errors can show as a note to user
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
      setErr('No sentences available for this unit/chapter right now.')
      setLoading(false)
    }
  }

  // reset on scope change
  useEffect(() => {
    abortInflight()
    const key = scopeKey()
    queuesRef.current.set(key, [])
    // we intentionally don't await; showNext handles its own errors
    showNext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, unit, chapter])

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
          <div>Stage: <select className="input" value={stage} onChange={e=>setStage(e.target.value)}>
            <option value="SV">SV</option>
            <option value="SVO">SVO</option>
            <option value="SVO+Time">SVO+Time</option>
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
