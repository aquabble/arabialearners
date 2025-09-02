// src/components/TopBar.jsx
import Button from './ui/Button.jsx'

export default function TopBar({ onNav, user }){
  return (
    <header style={{position:'sticky', top:0, zIndex:10, background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
      <div className="container" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <button className="btn" onClick={()=>onNav?.('home')} title="Home">🏠</button>
          <strong>Arabia Learners</strong>
        </div>
        <nav style={{display:'flex', gap:8, alignItems:'center'}}>
          <div className="btn-group">
            <button className="btn" onClick={()=>onNav?.('translate')}>Translate</button>
            <button className="btn" onClick={()=>onNav?.('word-order')}>Word Order</button>
            <button className="btn" onClick={()=>onNav?.('words')}>Words</button>
          </div>
          {user ? (
            <div className="small" style={{marginLeft:12, opacity:.8}}>Signed in</div>
          ) : (
            <Button className="brand" onClick={()=>onNav?.('signin')}>Sign in</Button>
          )}
        </nav>
      </div>
    </header>
  )
}
