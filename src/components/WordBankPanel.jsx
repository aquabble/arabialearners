// src/components/WordBankPanel.jsx
import { useEffect, useState } from 'react'
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import { loadVocabMap, getStats, mergeStatsWithVocab } from '../lib/wordStats.js'

function Bubble({ item }){
  const { ar, en, correct=0, incorrect=0 } = item
  return (
    <button
      type="button"
      className="btn"
      title={`${en || '—'} · ✓${correct} ✗${incorrect}`}
      style={{border:'1px solid var(--border)', borderRadius:20, padding:'6px 10px', whiteSpace:'nowrap'}}
    >
      <span style={{fontWeight:700}}>{ar}</span>
      {en ? <span className="small" style={{marginLeft:8, opacity:.75}}>· {en}</span> : null}
    </button>
  )
}

export default function WordBankPanel({ max=18, onOpenFull }){
  const [items, setItems] = useState([])

  useEffect(()=>{
    let mounted = true
    async function load(){
      const map = await loadVocabMap()
      const stats = getStats()
      const merged = mergeStatsWithVocab(stats, map)
      if(!mounted) return
      setItems(merged.slice(0, max))
    }
    load()
    return ()=>{ mounted = false }
  }, [max])

  return (
    <Card>
      <CardBody>
        <div className="flex" style={{justifyContent:'space-between', alignItems:'baseline'}}>
          <CardTitle>Your Words</CardTitle>
          <div className="small" style={{opacity:.7}}>{items.length} shown</div>
        </div>
        <CardSub>Recent words you’ve practiced (click a bubble for details in the Words page).</CardSub>

        <div style={{display:'flex', flexWrap:'wrap', gap:8, marginTop:12}}>
          {items.map(it => <Bubble key={it.lemma || it.ar} item={it} />)}
        </div>

        <div className="mt-16">
          <Button className="ghost" onClick={()=>onOpenFull?.()}>Open full Words page</Button>
        </div>
      </CardBody>
    </Card>
  )
}
