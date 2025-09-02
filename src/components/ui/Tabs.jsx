
// src/components/ui/Tabs.jsx
export function Tabs({ items = [], value, onChange }){
  return (
    <div className="tabs-scroll">
      {items.map(it => (
        <button
          key={it.value}
          className={`btn ${value===it.value?'brand':''}`}
          type="button"
          onClick={() => onChange && onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
