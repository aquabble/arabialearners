// src/components/ui/Header.jsx
import { useState, useRef, useEffect } from 'react'
import Button from '../Button.jsx'

export default function Header({ onNav, user, onSignIn, onSignOut }){
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(()=>{
    function onDoc(e){
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return ()=>document.removeEventListener('click', onDoc)
  }, [])

  return (
    <header style={{position:'sticky', top:0, zIndex:40, background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
      <div className="container" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0'}}>
        {/* Brand / Home */}
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <button className="btn" title="Home" onClick={()=>onNav?.('home')} style={{fontWeight:800, fontSize:18, borderRadius:12, width:36, height:36}}>
            ع
          </button>
          <strong>Arabia Learners</strong>
        </div>

        {/* Right: Menu trigger */}
        <div ref={menuRef} style={{position:'relative'}}>
          <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} title="Menu" style={{borderRadius:12, width:36, height:36}}>
            ⋯
          </button>
          {open && (
            <div role="menu" style={{position:'absolute', right:0, top:'calc(100% + 8px)', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, minWidth:220, boxShadow:'0 8px 24px rgba(0,0,0,.08)', padding:8}}>
              <a role="menuitem" className="menu-item" onClick={()=>{ onNav?.('translate'); setOpen(false); }} style={itemStyle}>Translate</a>
              <a role="menuitem" className="menu-item" onClick={()=>{ onNav?.('word-order'); setOpen(false); }} style={itemStyle}>Word Order</a>
              <a role="menuitem" className="menu-item" onClick={()=>{ onNav?.('words'); setOpen(false); }} style={itemStyle}>Words</a>
              <div style={{height:1, background:'var(--border)', margin:'6px 0'}} />
              {user ? (
                <>
                  <div className="small" style={{padding:'6px 10px', opacity:.7}}>Signed in</div>
                  <a role="menuitem" className="menu-item" onClick={()=>{ onSignOut?.(); setOpen(false); }} style={itemStyle}>Sign out</a>
                </>
              ) : (
                <a role="menuitem" className="menu-item" onClick={()=>{ (onSignIn||onNav)?.('signin'); setOpen(false); }} style={itemStyle}>Sign in</a>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

const itemStyle = { display:'block', padding:'8px 10px', cursor:'pointer', borderRadius:8 }
