// src/components/Words.jsx
import { useEffect, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import { loadVocabMap, getStats, mergeStatsWithVocab } from '../lib/wordStats.js'

function WordBubble({ item }){
  const { ar, en, def, correct=0, incorrect=0, total=0, forms=[] } = item
  const [open, setOpen] = useState(false)
  const variants = forms.slice(0, 6).join(' · ')
  return (
    <div className="word-bubble" style={{border:'1px solid var(--border)', borderRadius:16, padding:12}}>
      <button type="button" className="btn" onClick={()=>setOpen(o=>!o)} title={`${en || '—'}`} style={{width:'100%', display:'flex', justifyContent:'space-between'}}>
        <span style={{fontWeight:700, fontSize:18}}>{ar}</span>
        <span className="small" style={{opacity:.8}}>{en || '—'}</span>
      </button>
      {open && (
        <div className="small" style={{marginTop:8}}>
          <div><b>English:</b> {en || '—'}</div>
          <div><b>Definition:</b> {def || en || '—'}</div>
          {variants && <div style={{marginTop:8}}><b>Variants:</b> {variants}</div>}
          <div style={{marginTop:8, display:'flex', gap:12}}>
            <span className="badge ok">Correct: {correct}</span>
            <span className="badge warn">Incorrect: {incorrect}</span>
            <span className="badge">{total} total</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Words(){
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(()=>{
    let mounted = true
    async function load(){
      const map = await loadVocabMap()
      const stats = getStats()
      const merged = mergeStatsWithVocab(stats, map)
      if(!mounted) return
      setItems(merged)
    }
    load()
    return ()=>{ mounted = false }
  }, [])

  const filtered = items.filter(it => {
    if (filter === 'all') return true
    if (filter === 'known') return it.correct >= 3 && it.correct >= (it.incorrect || 0)
    if (filter === 'trouble') return it.incorrect > it.correct
    return true
  })

  return (
    <Card>
      <CardBody>
        <CardTitle>Your Words</CardTitle>
        <CardSub>Collapses conjugations; shows accuracy per lemma.</CardSub>
        <div className="small" style={{margin:'12px 0', display:'flex', gap:12, flexWrap:'wrap'}}>
          <Button onClick={()=>setFilter('all')} className={filter==='all'?'brand':''}>All</Button>
          <Button onClick={()=>setFilter('known')} className={filter==='known'?'brand':''}>Known</Button>
          <Button onClick={()=>setFilter('trouble')} className={filter==='trouble'?'brand':''}>Trouble</Button>
          <span className="small" style={{opacity:.7}}>{filtered.length} / {items.length}</span>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12}}>
          {filtered.map(it => <WordBubble key={it.lemma} item={it} />)}
        </div>
      </CardBody>
    </Card>
  )
}
