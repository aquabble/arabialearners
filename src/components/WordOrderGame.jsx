import React, { useState } from 'react'

export default function WordOrderGame(){
  const [words, setWords] = useState(['ذهبتُ','إلى','المدرسة','صباحًا'])
  const [order, setOrder] = useState(words.map((_,i)=>i))

  function swap(i,j){
    const next = order.slice()
    const t = next[i]; next[i] = next[j]; next[j] = t
    setOrder(next)
  }

  return (
    <div className="card">
      <h3>Word Order</h3>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {order.map((idx,i)=>(
          <button key={i} onClick={()=> i>0 && swap(i,i-1)}>
            {words[idx]}
          </button>
        ))}
      </div>
    </div>
  )
}
