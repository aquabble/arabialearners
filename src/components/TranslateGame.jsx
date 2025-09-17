// src/components/TranslateGame.jsx
import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = ''; // same origin

export default function TranslateGame(){
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bundle, setBundle] = useState(null);
  const [guess, setGuess] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [direction, setDirection] = useState('ar2en');
  const [provider, setProvider] = useState('auto'); // 'auto' | 'local'
  const [glossary, setGlossary] = useState({ semesters: [] });

  // scope state
  const [semester, setSemester] = useState('');
  const [unit, setUnit] = useState('');
  const [chapter, setChapter] = useState('');

  // Load glossary once
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/glossary');
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'Glossary failed');
        setGlossary(j);
        // seed selects
        const s0 = j.semesters?.[0]; if (s0) setSemester(s0.id);
        const u0 = s0?.units?.[0];   if (u0) setUnit(u0.id);
        const c0 = u0?.chapters?.[0];if (c0) setChapter(c0.id);
      } catch (e) {
        setError(String(e.message || e));
      }
    })();
  }, []);

  const unitsForSemester = useMemo(() => {
    const s = glossary.semesters?.find(x => x.id === semester);
    return s?.units || [];
  }, [glossary, semester]);

  const chaptersForUnit = useMemo(() => {
    const u = unitsForSemester.find(x => x.id === unit);
    return u?.chapters || [];
  }, [unitsForSemester, unit]);

  useEffect(() => {
    // reset unit/chapter when semester changes
    const u0 = unitsForSemester[0]; if (u0) setUnit(u0.id);
  }, [semester]); // eslint-disable-line

  useEffect(() => {
    const c0 = chaptersForUnit[0]; if (c0) setChapter(c0.id);
  }, [unit]); // eslint-disable-line

  async function getBundle(){
    setLoading(true); setError(''); setBundle(null);
    try{
      const r = await fetch(`${API_BASE}/api/sentence-bundle?t=${Date.now()}`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          direction, difficulty, provider,
          scope: { semester, unit, chapter }
        })
      });
      const j = await r.json();
      if(!j.ok) throw new Error(j.error||'Failed to fetch bundle');
      setBundle(j);
    }catch(e){ setError(String(e.message||e)); }
    finally{ setLoading(false); }
  }

  async function grade(){
    if (!bundle) return;
    setLoading(true); setError('');
    try{
      const r = await fetch(`${API_BASE}/api/grade`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ guess, reference: bundle?.answer, direction })
      });
      const j = await r.json();
      if(!j.ok) throw new Error(j.error||'Failed to grade');
      setBundle(b => ({ ...b, score: j.score, feedback: j.feedback }));
    }catch(e){ setError(String(e.message||e)); }
    finally{ setLoading(false); }
  }

  useEffect(()=>{ if (semester && unit && chapter) getBundle(); }, [semester, unit, chapter]); // auto-refresh when scope changes

  return (
    <div className="card">
      <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(3,minmax(0,1fr))' }}>
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
        <label>Speed
          <select value={provider} onChange={e=>setProvider(e.target.value)}>
            <option value="auto">AI (auto, fallback if slow)</option>
            <option value="local">Fast (no AI)</option>
          </select>
        </label>
      </div>

      <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(3,minmax(0,1fr))', marginTop:8 }}>
        <label>Semester
          <select value={semester} onChange={e=>setSemester(e.target.value)}>
            {(glossary.semesters||[]).map(s => <option key={s.id} value={s.id}>{s.name||s.id}</option>)}
          </select>
        </label>
        <label>Unit
          <select value={unit} onChange={e=>setUnit(e.target.value)}>
            {unitsForSemester.map(u => <option key={u.id} value={u.id}>{u.name||u.id}</option>)}
          </select>
        </label>
        <label>Chapter
          <select value={chapter} onChange={e=>setChapter(e.target.value)}>
            {chaptersForUnit.map(c => <option key={c.id} value={c.id}>{c.name||c.id}</option>)}
          </select>
        </label>
      </div>

      <div style={{ marginTop:12 }}>
        <button onClick={getBundle} disabled={loading}>New Sentence</button>
      </div>

      {error && <p style={{color:'crimson'}}>{error}</p>}

      {bundle && (
        <div style={{ marginTop:12 }}>
          <div><strong>Prompt:</strong> {bundle.prompt}</div>
          <div><small>
            provider: {bundle.provider} • version: {bundle.version} •
            direction: {bundle.direction} • difficulty: {bundle.difficulty} •
            scope: {bundle.scopeUsed?.semester}/{bundle.scopeUsed?.unit}/{bundle.scopeUsed?.chapter}
          </small></div>
        </div>
      )}

      <div style={{ marginTop:12 }}>
        <input value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Your translation..." style={{ width:'100%' }} />
        <button onClick={grade} disabled={loading || !bundle}>Check</button>
      </div>

      {bundle?.score != null && (
        <div style={{ marginTop:12 }}>
          <div><strong>Correct answer:</strong> {bundle?.answer}</div>
          <div><strong>Score:</strong> {bundle.score}</div>
          <div><strong>Feedback:</strong> {bundle.feedback}</div>
        </div>
      )}
    </div>
  );
}
