export function Stat({label, value, hint}){
  return (
    <div className="card">
      <div className="card-body">
        <div className="small">{label}</div>
        <div className="title">{value}</div>
        {hint && <div className="small">{hint}</div>}
      </div>
    </div>
  )
}