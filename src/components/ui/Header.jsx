import Button from './Button.jsx';
export default function Header({user, onLogout, onSettings, right=null}){
  const initials = user?.name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() || 'G';
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
              <div className="avatar" title={user.name || 'Guest'}>{initials}</div>
              {onLogout && <Button variant="ghost" onClick={onLogout}>Log out</Button>}
            </>
          ) : (
            <Button variant="brand" onClick={()=>window.location.href='/login'}>Sign in</Button>
          )}
        </div>
      </div>
    </div>
  )
}