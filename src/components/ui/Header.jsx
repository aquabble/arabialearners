// src/components/ui/Header.jsx
import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'

export default function Header({
  user,
  onLogout,
  onSettings,
  onSignIn,
  onNav,        // ← new: navigate callback (value => void)
  right = null,
  compact = false,
  items = []    // ← [{label, value}]
}) {
  const initials =
    user?.displayName?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() ||
    user?.name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() || ''

  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function onDocClick(e){
      if (!open) return
      const m = menuRef.current
      const b = btnRef.current
      if (m && !m.contains(e.target) && b && !b.contains(e.target)){
        setOpen(false)
      }
    }
    function onEsc(e){
      if (e.key === 'Escape') setOpen(false)
    }
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

  return (
    <div className={compact ? 'header header-compact' : 'header'}>
      <div className="header-inner">
        {/* Brand as a menu trigger */}
        <button
          ref={btnRef}
          className="brand brand-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="brand-menu"
          onClick={() => setOpen(v => !v)}
          type="button"
        >
          <div className="brand-badge">ع</div>
          <div>Arabic Learner</div>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" style={{opacity:0.8, marginLeft:6}}>
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
            <Button
              data-qa="sign-in"
              variant="brand"
              onClick={() => { onSignIn && onSignIn(); }}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>

      {/* Dropdown menu */}
      {open && (
        <div
          id="brand-menu"
          ref={menuRef}
          className="brand-menu"
          role="menu"
          aria-label="Main navigation"
        >
          <div className="brand-menu-inner">
            {items && items.length ? items.map(it => (
              <button
                key={it.value}
                className="brand-menu-item"
                role="menuitem"
                type="button"
                onClick={() => handleNav(it.value)}
              >
                {it.label}
              </button>
            )) : null}

            {/* Optional auth actions in the menu on mobile */}
            <div className="brand-menu-sep" />
            {user ? (
              <button className="brand-menu-item" role="menuitem" type="button" onClick={() => onLogout && onLogout()}>
                Log out
              </button>
            ) : (
              <button className="brand-menu-item" role="menuitem" type="button" onClick={() => onSignIn && onSignIn()}>
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
