import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const provider = new GoogleAuthProvider()
export async function firebaseSignIn(){ const res = await signInWithPopup(auth, provider); const u=res.user; return { uid:u.uid, email:u.email, name:u.displayName } }
export async function firebaseSignOut(){ await signOut(auth) }
export function onAuth(cb){ return onAuthStateChanged(auth, u => cb(u?{uid:u.uid,email:u.email,name:u.displayName}:null)) }
export async function loadState(uid){ const ref = doc(db,'users',uid,'state','kv'); const s=await getDoc(ref); return s.exists()?s.data():{} }
export async function saveState(uid,data){ const ref=doc(db,'users',uid,'state','kv'); await setDoc(ref,data,{merge:true}); return true }
export function watchState(uid,cb){ const ref=doc(db,'users',uid,'state','kv'); return onSnapshot(ref,snap=>cb(snap.exists()?snap.data():{})) }
