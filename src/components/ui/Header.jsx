import Button from './Button.jsx';

export default function Header({ user, onLogout, onSettings, onSignIn, right=null }){
  const initials = user?.displayName?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()
                  || user?.name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()
                  || '';

  return (
    <div className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-badge">ع</div>
          <div>Arabic Learner</div>
        </div>

        <div className="header-actions">
          {right}
          {onSettings && <Button variant="ghost" onClick={onSettings}>Settings</Button>}

          {user ? (
            <>
              <div className="avatar" title={user?.displayName || user?.name || 'User'}>
                {initials || '🙂'}
              </div>
              {onLogout && <Button variant="ghost" onClick={onLogout}>Log out</Button>}
            </>
          ) : (
            <Button data-qa="sign-in" variant="brand" onClick={() => { console.log('[ui] Sign in clicked'); onSignIn && onSignIn(); }}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
