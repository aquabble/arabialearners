
import React, { useEffect, useRef, useState } from 'react'

const ARABIC_REGEX = /[\u0600-\u06FF]/
const clean = v => (typeof v === 'string' ? v.trim() : '')

async function fetchBundle(API_BASE, payload){
  // Try POST first (many APIs require POST), then fall back to GET
  const url = `${API_BASE}/api/sentence-bundle`
  try{
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    })
    if (r.status === 405) throw new Error('POST not allowed, try GET')
    if (!r.ok) throw new Error(`POST failed: ${r.status}`)
    return await r.json()
  }catch(_){
    const r2 = await fetch(url) // GET
    if (!r2.ok) throw new Error(`GET failed: ${r2.status}`)
    return await r2.json()
  }
}

function pickDisplayAndPair(item, direction){
  const f = {
    prompt: clean(item?.prompt),
    answer: clean(item?.answer),
    ar: clean(item?.ar),
    en: clean(item?.en),
    vocabAr: clean(item?.vocabAr),
    vocabEn: clean(item?.vocabEn),
    arSentence: clean(item?.arSentence || item?.sentenceAr || item?.fullAr || item?.text_ar),
    enSentence: clean(item?.enSentence || item?.sentenceEn || item?.fullEn || item?.text_en),
    promptAr: clean(item?.promptAr),
    promptEn: clean(item?.promptEn),
    answerAr: clean(item?.answerAr),
    answerEn: clean(item?.answerEn),
  }

  if (direction === 'ar2en'){
    const display =
      f.promptAr ||
      f.arSentence ||
      (ARABIC_REGEX.test(f.prompt) ? f.prompt : (ARABIC_REGEX.test(f.answer) ? f.answer : f.ar)) ||
      ''
    const expectedEn =
      f.answerEn ||
      f.enSentence ||
      (!ARABIC_REGEX.test(f.answer) ? f.answer :
        (!ARABIC_REGEX.test(f.prompt) ? f.prompt : (f.en || f.vocabEn))) ||
      ''
    const expectedAr = display
    return { display, expectedAr, expectedEn }
  } else {
    const display =
      f.promptEn ||
      f.enSentence ||
      (!ARABIC_REGEX.test(f.prompt) ? f.prompt : (!ARABIC_REGEX.test(f.answer) ? f.answer : f.en)) ||
      ''
    const expectedAr =
      f.answerAr ||
      f.arSentence ||
      (ARABIC_REGEX.test(f.answer) ? f.answer :
        (ARABIC_REGEX.test(f.prompt) ? f.prompt : (f.ar || f.vocabAr))) ||
      ''
    const expectedEn = display
    return { display, expectedAr, expectedEn }
  }
}

export default function TranslateGame({ API_BASE = '' , direction = 'ar2en', difficulty = 'medium' }){
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [diagnostic, setDiagnostic] = useState(null)
  const queuesRef = useRef(new Map())

  const [displayPrompt, setDisplayPrompt] = useState('')
  const [expectedAr, setExpectedAr] = useState('')
  const [expectedEn, setExpectedEn] = useState('')
  const [vocabAr, setVocabAr] = useState('')
  const [vocabEn, setVocabEn] = useState('')
  const [modifiers, setModifiers] = useState([])

  const placeholder = direction === 'ar2en' ? 'Type the English meaning…' : 'اكتب الجواب بالعربية…'

  async function loadQueue(key='default'){
    let q = queuesRef.current.get(key) || []
    if (q.length > 0) return q
    const data = await fetchBundle(API_BASE, { direction, difficulty, count: 12 })
    const items = Array.isArray(data?.items) ? data.items.slice() : []
    setDiagnostic({ count: items.length, method: data?.method || 'unknown' })
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
      const referenceAr = expectedAr
      const referenceEn = expectedEn
      if (!referenceAr && !referenceEn){
        setFeedback({ verdict:'wrong', hint:'No reference pair to grade.' })
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

  useEffect(()=>{ showNext() }, [direction, difficulty])

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
              {diagnostic?.method && <div><strong>API method:</strong> {diagnostic.method}</div>}
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
