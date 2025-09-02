// src/components/ui/Header.jsx
import Button from './Button.jsx'

export default function Header({ user, onLogout, onSettings, onSignIn, right=null, compact=false }) {
  const initials =
    user?.displayName?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() ||
    user?.name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() || ''

  return (
    <div className={compact ? 'header header-compact' : 'header'}>
      <div className="header-inner">
        <div className="brand">
          <div className="brand-badge">ع</div>
          <div>Arabic Learner</div>
        </div>

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
    </div>
  )
}
