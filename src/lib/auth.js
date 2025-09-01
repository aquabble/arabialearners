// Lightweight Firebase auth helpers (Google).
// Requires you already initialized Firebase in src/lib/firebase.js
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

export function getFirebaseAuth(){
  const auth = getAuth()
  return auth
}

export async function signInWithGoogle(){
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  // You can use signInWithRedirect if you prefer
  const res = await signInWithPopup(auth, provider)
  return res.user
}

export async function signOutUser(){
  const auth = getFirebaseAuth()
  await signOut(auth)
}

export function onAuthChanged(cb){
  const auth = getFirebaseAuth()
  return onAuthStateChanged(auth, cb)
}