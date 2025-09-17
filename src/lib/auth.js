// src/lib/auth.js
import { auth } from './firebase.js'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'

export async function signInWithGoogle(){
  const provider = new GoogleAuthProvider()
  // provider.setCustomParameters({ prompt: 'select_account' }) // optional
  try {
    const res = await signInWithPopup(auth, provider)
    return res.user
  } catch (e) {
    // Common causes:
    // - auth/popup-blocked: browser blocked popups
    // - auth/unauthorized-domain: domain not whitelisted in Firebase Console
    // Fallback to redirect which is rarely blocked
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, provider)
      return null
    }
    if (e?.code === 'auth/unauthorized-domain') {
      throw new Error('Unauthorized domain in Firebase Auth: add your domain to Firebase Console → Authentication → Settings → Authorized domains')
    }
    throw e
  }
}

// Call this once on app load to complete redirect flows without throwing
export async function completeRedirectIfNeeded(){
  try { await getRedirectResult(auth) } catch {}
}

export async function signOutUser(){
  await signOut(auth)
}

export function onAuthChanged(cb){
  return onAuthStateChanged(auth, cb)
}
