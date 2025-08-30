export default function Progress({value=0}){
  const clamped = Math.max(0, Math.min(100, value));
  return <div className="progress"><span style={{width: clamped+'%'}}/></div>
}