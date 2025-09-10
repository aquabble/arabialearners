import React, { useEffect, useRef, useState } from 'react'

export default function TranslateGame({ API_BASE = '' , direction = 'ar2en' }){
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)
  const queuesRef = useRef(new Map())

  // The actual sentence pair
  const [prompt, setPrompt] = useState('')  // what the user sees and must translate
  const [answer, setAnswer] = useState('')  // the expected translation

  // Lexemes / vocab for reference
  const [ar, setAr] = useState('')
  const [en, setEn] = useState('')
  const [vocabAr, setVocabAr] = useState('')
  const [vocabEn, setVocabEn] = useState('')
  const [tokens, setTokens] = useState([])

  async function showNext(){
    setLoading(true); setErr(null); setFeedback(null); setGuess('')
    try{
      const key = 'default'
      let q = queuesRef.current.get(key) || []
      if (q.length === 0){
        const res = await fetch(`${API_BASE}/api/sentence-bundle`)
        const data = await res.json()
        q = Array.isArray(data?.items) ? data.items.slice() : []
      }
      const item = q.shift()
      queuesRef.current.set(key, q)
      if (item){
        // Use full sentence fields for UI & grading
        setPrompt(item.prompt || '')
        setAnswer(item.answer || '')

        // Keep lexemes for reference section
        setAr(item.ar || '')
        setEn(item.en || '')
        setTokens(item.tokens || [])
        setVocabAr(item.vocabAr || item.ar || '')
        setVocabEn(item.vocabEn || item.en || '')
        setLoading(false)
      } else {
        setLoading(false)
      }
    }catch(e){
      setErr('Failed to load sentences: ' + String(e))
      setLoading(false)
    }
  }

  async function check(){
    setFeedback(null)
    try{
      // Determine the correct reference pair based on direction
      const referenceAr = (direction === 'ar2en') ? prompt : answer
      const referenceEn = (direction === 'ar2en') ? answer : prompt

      const res = await fetch(`${API_BASE}/api/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, guess, referenceAr, referenceEn })
      })
      const data = await res.json()
      setFeedback(data)
      try {
        const arSentence = (direction === 'ar2en') ? prompt : answer
        recordResult({ arSentence, tokens, verdict: data?.verdict })
      } catch {}
    }catch(e){
      setFeedback({ verdict:'wrong', hint:'Could not reach grader. ' + String(e) })
    }
  }

  const placeholder = direction === 'ar2en' ? 'Type the English meaning…' : 'اكتب الجواب بالعربية…'

  useEffect(()=>{ showNext() }, [])

  return (
    <div className="translate-game">
      {loading && <div>Loading…</div>}
      {err && <div className="error">{String(err)}</div>}
      {!loading && !err && (
        <>
          <h2 className="prompt">{prompt}</h2>
          <div className="input-row">
            <input
              value={guess}
              onChange={e=>setGuess(e.target.value)}
              placeholder={placeholder}
              onKeyDown={e=>{ if(e.key==='Enter'){ check() } }}
            />
            <button onClick={check}>Check</button>
            <button onClick={showNext}>Skip</button>
          </div>

          <details style={{marginTop:'1rem'}}>
            <summary>Reference (vocab used)</summary>
            <div style={{opacity:0.9, fontSize:'0.95em', marginTop:'0.5rem'}}>
              <div><strong>Arabic vocab:</strong> {vocabAr}</div>
              <div><strong>English gloss:</strong> {vocabEn}</div>
            </div>
          </details>

          {feedback && (
            <div className="feedback" style={{marginTop:'1rem'}}>
              <div><strong>Verdict:</strong> {String(feedback?.verdict || '')}</div>
              {feedback?.hint && <div><strong>Hint:</strong> {feedback.hint}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
