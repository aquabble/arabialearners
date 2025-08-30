export function Tabs({value, onChange, items=[]}){
  return <div className="tabs">
    {items.map(it => (
      <button key={it.value}
        className={`tab ${value===it.value ? 'active' : ''}`}
        onClick={()=>onChange(it.value)}>{it.label}</button>
    ))}
  </div>
}