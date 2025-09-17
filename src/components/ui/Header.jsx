// src/components/ui/Header.jsx
import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'

function IconHome(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4H10v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8z" fill="currentColor" opacity=".92"/>
  </svg>
)}
function IconTranslate(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 5h12a1 1 0 0 1 1 1v4H3V6a1 1 0 0 1 1-1zm0 8h8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5zm12.5 0L19 20h2l3-7h-2l-2 5-2-5h-2z" fill="currentColor" opacity=".92"/>
  </svg>
)}
function IconOrder(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h7v2H4v-2z" fill="currentColor" opacity=".92"/>
  </svg>
)}
function IconLogin(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10 17l5-5-5-5v3H3v4h7v3zM20 19H12v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" fill="currentColor" opacity=".9"/>
  </svg>
)}
function IconLogout(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 7l5 5-5 5v-3H8v-4h6V7zM4 3h8v2H6v14h6v2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" opacity=".9"/>
  </svg>
)}

export default function Header({
  user,
  onLogout,
  onSettings,
  onSignIn,
  onNav,
  right = null,
  compact = false,
  items = [],
  current = 'home' // ← pass current mode for active highlight
}) {
  const initials =
    user?.displayName?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() ||
    user?.name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() || ''

  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    function onDocClick(e){
      if (!open) return
      const m = menuRef.current, b = btnRef.current
      if (m && !m.contains(e.target) && b && !b.contains(e.target)) setOpen(false)
    }
    function onEsc(e){ if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function handleNav(value){
    setOpen(false)
    onNav && onNav(value)
  }

  const iconFor = (v) => v==='home' ? <IconHome/> : v==='translate' ? <IconTranslate/> : v==='word-order' ? <IconOrder/> : null

  return (
    <div className={compact ? 'header header-compact' : 'header'}>
      <div className="header-inner">
        <button
          ref={btnRef}
          className="brand brand-trigger sleek"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="brand-menu"
          onClick={() => setOpen(v => !v)}
          type="button"
        >
          <div className="brand-badge">ع</div>
          <div>Arabic Learner</div>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className={`chev ${open?'up':''}`}>
            <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="header-actions">
          {!compact && right}
          {onSettings && !compact && <Button variant="ghost" onClick={onSettings}>Settings</Button>}

          {user ? (
            <>
              <div className="avatar" title={user?.displayName || user?.name || 'User'}>
                {initials || '🙂'}
              </div>
              {onLogout && <Button variant="ghost" onClick={onLogout}>Log out</Button>}
            </>
          ) : (
            <Button data-qa="sign-in" variant="brand" onClick={() => { onSignIn && onSignIn(); }}>Sign in</Button>
          )}
        </div>
      </div>

      {open && (
        <div id="brand-menu" ref={menuRef} className="brand-menu sleek" role="menu" aria-label="Main navigation">
          <div className="brand-menu-inner sleek">
            {items && items.length ? items.map(it => (
              <button
                key={it.value}
                className={`brand-menu-item sleek ${current===it.value?'active':''}`}
                role="menuitem"
                type="button"
                onClick={() => handleNav(it.value)}
              >
                <span className="icon">{iconFor(it.value)}</span>
                <span className="label">{it.label}</span>
              </button>
            )) : null}

            <div className="brand-menu-sep" />
            {user ? (
              <button className="brand-menu-item sleek" role="menuitem" type="button" onClick={() => onLogout && onLogout()}>
                <span className="icon"><IconLogout/></span>
                <span className="label">Log out</span>
              </button>
            ) : (
              <button className="brand-menu-item sleek" role="menuitem" type="button" onClick={() => onSignIn && onSignIn()}>
                <span className="icon"><IconLogin/></span>
                <span className="label">Sign in</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
