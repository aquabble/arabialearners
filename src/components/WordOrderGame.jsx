import { useEffect, useRef, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import { API_BASE } from '../lib/apiBase.js'

function DraggableToken({ text, idx, onDragStart, onDragOver, onDrop }){
  return (
    <button
      className="btn"
      draggable
      onDragStart={(e)=>onDragStart(e, idx)}
      onDragOver={(e)=>onDragOver(e, idx)}
      onDrop={(e)=>onDrop(e, idx)}
      type="button"
      style={{minWidth: 36}}
    >
      {text}
    </button>
  )
}

export default function WordOrderGame({ user }){
  const [stage, setStage] = useState('SVO')
  const [unit, setUnit] = useState('All')
  const [chapter, setChapter] = useState('All')
  const [direction, setDirection] = useState('ar2en') // arrange Arabic by default

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [ar, setAr] = useState('')
  const [en, setEn] = useState('')

  const [target, setTarget] = useState([])  // correct order (array of strings)
  const [pool, setPool] = useState([])      // working array (shuffled)

  const dragSrc = useRef(null)

  function setupFromPayload(p){
    const t = direction === 'ar2en' ? p.tokensAr : p.tokensEn
    const s = direction === 'ar2en' ? p.shuffledAr : p.shuffledEn
    setTarget(t)
    setPool(s)
    setAr(p.ar); setEn(p.en)
  }

  async function load(){
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`${API_BASE}/api/wordorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, unit, chapter, direction })
      })
      if (!res.ok) throw new Error(`wordorder ${res.status}: ${await res.text()}`)
      const data = await res.json()
      setupFromPayload(data)
    } catch (e) {
      setErr(String(e))
      // fallback demo sentence
      const demo = {
        ar: 'الطالب يقرأ الكتاب الآن',
        en: 'The student reads the book now',
        tokensAr: ['الطالب','يقرأ','الكتاب','الآن'],
        shuffledAr: ['الآن','الطالب','الكتاب','يقرأ'],
        tokensEn: ['The','student','reads','the','book','now'],
        shuffledEn: ['now','the','book','reads','The','student']
      }
      setupFromPayload(demo)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [stage, unit, chapter, direction])

  // HTML5 DnD handlers
  function onDragStart(e, idx){
    dragSrc.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e, idx){
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function onDrop(e, idx){
    e.preventDefault()
    const src = dragSrc.current
    if (src == null || src === idx) return
    const arr = pool.slice()
    const [moved] = arr.splice(src, 1)
    arr.splice(idx, 0, moved)
    dragSrc.current = idx
    setPool(arr)
  }

  function isCorrect(){
    if (pool.length !== target.length) return false
    for (let i=0;i<pool.length;i++){
      if (pool[i] !== target[i]) return false
    }
    return true
  }

  async function check(){
    // optional: call AI grader with assembled string vs reference
    const guess = pool.join(' ')
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
      const data = await res.json()
      alert(isCorrect() ? '✅ Perfect order!' : (data?.hint || 'Keep trying!'))
    }catch{
      alert(isCorrect() ? '✅ Perfect order!' : 'Keep trying!')
    }
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>Word Order</CardTitle>
        <CardSub>Arrange the words to form a correct sentence</CardSub>

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
              <option value="ar2en">Arrange Arabic (hint in English)</option>
              <option value="en2ar">Arrange English (hint in Arabic)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="small">Loading…</div>
        ) : (
          <>
            <div className="title mb-16">
              {direction === 'ar2en'
                ? <>Hint (English): <strong>{en}</strong></>
                : <>Hint (Arabic): <strong>{ar}</strong></>}
            </div>

            <div className="flex gap-16" style={{flexWrap:'wrap'}}>
              {pool.map((t,i)=>(
                <DraggableToken
                  key={i}
                  text={t}
                  idx={i}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                />
              ))}
            </div>

            <div className="mt-16 flex items-center gap-16">
              <Button variant="brand" onClick={check}>Check</Button>
              <Button className="ghost" onClick={load}>Next</Button>
              <span className={`badge ${isCorrect()?'ok':''}`}>{isCorrect() ? 'Looks correct!' : 'Not yet'}</span>
            </div>

            <div className="small mt-16">
              <details><summary>Show solution</summary>
                <div style={{marginTop:8}}>
                  {target.join(' ')}
                </div>
              </details>
            </div>
          </>
        )}

        {err && <div className="small mt-16">Note: {String(err)}</div>}
      </CardBody>
    </Card>
  )
}
