// src/components/StudyShell.jsx
import { useState } from 'react'
import { Card, CardBody } from './ui/Card.jsx'

export default function StudyShell({ children, onNav }){
  const [tab, setTab] = useState('translate')
  const items = [
    {label:'Translate', value:'translate'},
    {label:'Word Order', value:'word-order'},
    {label:'Words', value:'words'},
  ]
  return (
    <Card>
      <CardBody>
        <div className="tabs" style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {items.map(it => (
            <button key={it.value} className={`btn ${tab===it.value?'brand':''}`} onClick={()=>{ setTab(it.value); onNav?.(it.value); }}>{it.label}</button>
          ))}
        </div>
        <div className="mt-16">
          {children}
        </div>
      </CardBody>
    </Card>
  )
}
