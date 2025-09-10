
import React, { useEffect, useRef, useState, useMemo } from 'react'

// Detect Arabic script to auto-pick which side is AR vs EN if the API doesn't label it.
const ARABIC_REGEX = /[\u0600-\u06FF]/

function pickDisplayAndPair(item, direction){
  // Normalize a bunch of possible field names coming from the backend
  const c = (v)=> (typeof v === 'string' ? v.trim() : '')
  const f = {
    prompt: c(item?.prompt),
    answer: c(item?.answer),
    ar: c(item?.ar),
    en: c(item?.en),
    vocabAr: c(item?.vocabAr),
    vocabEn: c(item?.vocabEn),
    arSentence: c(item?.arSentence || item?.sentenceAr || item?.fullAr || item?.text_ar),
    enSentence: c(item?.enSentence || item?.sentenceEn || item?.fullEn || item?.text_en),
    promptAr: c(item?.promptAr),
    promptEn: c(item?.promptEn),
    answerAr: c(item?.answerAr),
    answerEn: c(item?.answerEn),
  }

  // Choose the AR and EN sides of the SAME pair.
  // Priority 1: explicit pairs (promptAr/promptEn + answerAr/answerEn)
  if (direction === 'ar2en'){
    // We need: display Arabic sentence, expected English
    const disp = c(f.promptAr) || c(f.arSentence) || (ARABIC_REGEX.test(f.prompt) ? f.prompt : (ARABIC_REGEX.test(f.answer) ? f.answer : f.prompt))
    // Expected EN: answerEn | enSentence | the non-Arabic of (prompt/answer)
    let exp = c(f.answerEn) || c(f.enSentence)
    if (!exp){
      const p = f.prompt, a = f.answer
      if (!ARABIC_REGEX.test(p) && !ARABIC_REGEX.test(a)) {
        # neither is Arabic; fallback to non-Arabic among ar/en or enSentence
        
      exp = (!ARABIC_REGEX.test(a) ? a : (!ARABIC_REGEX.test(p) ? p : ''))
    }
    return { display: disp, expectedAr: disp, expectedEn: exp }
  } else {
    // en2ar: display English sentence, expected Arabic
    const disp = c(f.promptEn) || c(f.enSentence) || (!ARABIC_REGEX.test(f.prompt) ? f.prompt : (!ARABIC_REGEX.test(f.answer) ? f.answer : f.prompt))
    let exp = c(f.answerAr) || c(f.arSentence)
    if (!exp){
      const p = f.prompt, a = f.answer
      exp = (ARABIC_REGEX.test(a) ? a : (ARABIC_REGEX.test(p) ? p : ''))
    }
    return { display: disp, expectedAr: exp, expectedEn: disp }
  }
}

export default function TranslateGame({ API_BASE = '' , direction = 'ar2en' }){
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [diagnostic, setDiagnostic] = useState(null)

  const queuesRef = useRef(new Map())

  // The actual sentence pair for the current card
  const [displayPrompt, setDisplayPrompt] = useState('')  // what the user sees and must translate
  const [expectedAr, setExpectedAr] = useState('')        // normalized Arabic sentence for grading
  const [expectedEn, setExpectedEn] = useState('')        // normalized English sentence for grading

  // Lexemes / modifiers
  const [vocabAr, setVocabAr] = useState('')
  const [vocabEn, setVocabEn] = useState('')
  const [modifiers, setModifiers] = useState([])    // modifiers/tokens/tags shown under prompt

  const placeholder = direction === 'ar2en' ? 'Type the English meaning…' : 'اكتب الجواب بالعربية…'

  async function loadQueue(key='default'){
    let q = queuesRef.current.get(key) || []
    if (q.length > 0) return q
    const res = await fetch(`${API_BASE}/api/sentence-bundle`)
    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items.slice() : []
    setDiagnostic({ count: items.length })
    queuesRef.current.set(key, items)
    return items
  }

  async function showNext(){
    setLoading(true); setErr(null); setFeedback(null); setGuess('')
    try{
      const key = 'default'
      let q = await loadQueue(key)
      if (!Array.isArray(q) || q.length === 0){
        setLoading(false)
        if (!err) setErr('No sentences returned from /api/sentence-bundle.')
        return
      }
      const item = q.shift()
      queuesRef.current.set(key, q)

      const { display, expectedAr, expectedEn } = pickDisplayAndPair(item, direction)

      setDisplayPrompt(display || '')
      setExpectedAr(expectedAr || '')
      setExpectedEn(expectedEn || '')

      setVocabAr(item?.vocabAr || item?.ar || '')
      setVocabEn(item?.vocabEn || item?.en || '')
      const mods = Array.isArray(item?.modifiers) ? item.modifiers
                  : Array.isArray(item?.tokens) ? item.tokens
                  : Array.isArray(item?.tags) ? item.tags
                  : []
      setModifiers(mods)
      setLoading(false)
    }catch(e){
      setErr('Failed to load sentences: ' + String(e))
      setLoading(false)
    }
  }

  async function check(){
    setFeedback(null)
    try{
      const referenceAr = (direction === 'ar2en') ? expectedAr : expectedAr   // always Arabic
      const referenceEn = (direction === 'ar2en') ? expectedEn : expectedEn   // always English

      if (!referenceAr && !referenceEn){
        setFeedback({ verdict:'wrong', hint:'No reference pair available to grade. Check API fields.' })
        return
      }

      const res = await fetch(`${API_BASE}/api/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, guess, referenceAr, referenceEn })
      })
      const data = await res.json()
      setFeedback(data || { verdict:'unknown' })
    }catch(e){
      setFeedback({ verdict:'wrong', hint:'Could not reach grader. ' + String(e) })
    }
  }

  // Reload a card when direction changes
  useEffect(()=>{ showNext() }, [direction])

  return (
    <div className="translate-game">
      {loading && <div>Loading…</div>}
      {err && <div className="error">{String(err)}</div>}

      {!loading && !err && (
        <>
          <h2 className="prompt">{displayPrompt || '—'}</h2>

          {Array.isArray(modifiers) && modifiers.length > 0 && (
            <div className="modifiers" style={{margin:'0.5rem 0', opacity:0.9, fontSize:'0.95em'}}>
              <strong>Modifiers:</strong> {modifiers.join(' • ')}
            </div>
          )}

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

          <details style={{marginTop:'0.75rem'}}>
            <summary>Reference</summary>
            <div style={{opacity:0.9, fontSize:'0.95em', marginTop:'0.5rem'}}>
              <div><strong>Arabic (expected):</strong> {expectedAr || '—'}</div>
              <div><strong>English (expected):</strong> {expectedEn || '—'}</div>
              <div><strong>Arabic vocab:</strong> {vocabAr || '—'}</div>
              <div><strong>English gloss:</strong> {vocabEn || '—'}</div>
            </div>
          </details>

          <details style={{marginTop:'0.5rem'}}>
            <summary>Diagnostics</summary>
            <div style={{opacity:0.85, fontSize:'0.9em', marginTop:'0.5rem'}}>
              <div>Queue size: {(() => {
                const key='default'; 
                const q = queuesRef.current.get(key);
                return Array.isArray(q) ? q.length : 0;
              })()}</div>
              <div>Bundle items: {diagnostic?.count ?? 'unknown'}</div>
            </div>
          </details>

          {feedback && (
            <div className="feedback" style={{marginTop:'0.75rem'}}>
              <div><strong>Verdict:</strong> {String(feedback?.verdict || '')}</div>
              {feedback?.hint && <div><strong>Hint:</strong> {feedback.hint}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
