// src/components/SignIn.jsx
import { useEffect, useState } from 'react'
import Button from './ui/Button.jsx'
import { signInWithGoogle, completeRedirectIfNeeded } from '../lib/auth.js'

export default function SignIn({ onDone }){
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    // Complete any pending redirect auth flows silently
    completeRedirectIfNeeded().catch(()=>{})
  }, [])

  async function handleGoogle(){
    setErr(''); setLoading(true)
    try {
      await signInWithGoogle()
      onDone && onDone()
    } catch (e) {
      setErr(e?.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{padding:24, border:'1px solid var(--border)', borderRadius:12}}>
      <h3 style={{marginBottom:8}}>Sign in</h3>
      <p className="small" style={{opacity:.8, marginBottom:16}}>Use your Google account to continue.</p>
      {err && <p className="small" style={{color:'tomato', marginBottom:12}}>{err}</p>}
      <Button variant="brand" onClick={handleGoogle} disabled={loading}>
        {loading ? 'Signing in...' : 'Continue with Google'}
      </Button>
    </div>
  )
}
