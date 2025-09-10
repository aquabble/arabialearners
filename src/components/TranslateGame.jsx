import React, { useEffect, useState } from 'react'

const API_BASE = '' // same origin

export default function TranslateGame(){
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bundle, setBundle] = useState(null)
  const [guess, setGuess] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [direction, setDirection] = useState('ar2en')
  const [scope, setScope] = useState({ semester:'S1', unit:'U1', chapter:'C1' })
  const [result, setResult] = useState(null)

  async function getBundle(){
    setLoading(true); setError(''); setResult(null)
    try{
      const r = await fetch(`${API_BASE}/api/sentence-bundle`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ difficulty, direction, scope })
      })
      const j = await r.json()
      if(!j.ok) throw new Error(j.error||'Failed to fetch bundle')
      setBundle(j)
    }catch(e){ setError(String(e.message||e)) }
    finally{ setLoading(false) }
  }

  async function grade(){
    setLoading(true); setError(''); setResult(null)
    try{
      const r = await fetch(`${API_BASE}/api/grade`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ guess, reference: bundle?.answer, direction })
      })
      const j = await r.json()
      if(!j.ok) throw new Error(j.error||'Failed to grade')
      setResult(j)
    }catch(e){ setError(String(e.message||e)) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ getBundle() }, [])

  return (
    <div className="card">
      <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(3, minmax(0,1fr))' }}>
        <label>Difficulty
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
            <option value="short">short</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </label>
        <label>Direction
          <select value={direction} onChange={e=>setDirection(e.target.value)}>
            <option value="ar2en">ar → en</option>
            <option value="en2ar">en → ar</option>
          </select>
        </label>
        <button onClick={getBundle} disabled={loading}>New Sentence</button>
      </div>

      {error && <p style={{color:'crimson'}}>{error}</p>}
      {bundle && (
        <div style={{ marginTop:12 }}>
          <div><strong>Prompt:</strong> {bundle.prompt}</div>
          <div><small>direction: {bundle.direction} • difficulty: {bundle.difficulty}</small></div>
        </div>
      )}

      <div style={{ marginTop:12 }}>
        <input value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Your translation..." style={{ width:'100%' }} />
        <button onClick={grade} disabled={loading || !bundle}>Check</button>
      </div>

      {result && (
        <div style={{ marginTop:12 }}>
          <div><strong>Correct answer:</strong> {bundle?.answer}</div>
          <div><strong>Score:</strong> {result.score}</div>
          <div><strong>Feedback:</strong> {result.feedback}</div>
        </div>
      )}
    </div>
  )
}
