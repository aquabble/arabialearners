import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { app } from './firebase.js';

const db = getFirestore(app);

// Local helpers
export function readLocal(key, email=''){
  const k = email ? `${email}_${key}` : key;
  try {
    const v = localStorage.getItem(k);
    if (v == null) return null;
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) return JSON.parse(v);
    return v;
  } catch { return null; }
}

export function writeLocal(key, val, email=''){
  const k = email ? `${email}_${key}` : key;
  try {
    localStorage.setItem(k, typeof val === 'object' ? JSON.stringify(val) : String(val));
  } catch {}
}

// Cloud ops
export async function loadState(userId){
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

export async function saveState(userId, state){
  const ref = doc(db, 'users', userId);
  await setDoc(ref, state || {}, { merge: true });
  return true;
}

export function watchState(userId, cb){
  const ref = doc(db, 'users', userId);
  return onSnapshot(ref, (snap)=> cb(snap.exists() ? snap.data() : {}));
}

// App-level convenience
const NAMESPACE_KEYS = [
  'mistakes','mastery','wordStats','translate_history','wordorder_history',
  'streak_current','streak_best','last_active_date','badges'
];

export async function uploadAllLocalToCloud(user){
  if (!user || !user.uid) return {};
  const state = {};
  for (const k of NAMESPACE_KEYS){
    const v = readLocal(k, user.email);
    if (v !== null) state[k] = v;
  }
  await saveState(user.uid, state);
  return state;
}

export async function downloadAllCloudToLocal(user){
  if (!user || !user.uid) return {};
  const cloud = await loadState(user.uid);
  for (const [k,v] of Object.entries(cloud || {})){
    writeLocal(k, v, user.email);
  }
  return cloud;
}

export function subscribeCloudToLocal(user){
  if (!user || !user.uid) return () => {};
  const unsub = watchState(user.uid, (cloud)=>{
    for (const [k,v] of Object.entries(cloud || {})){
      writeLocal(k, v, user.email);
    }
  });
  return unsub;
}

export async function mergeLocalAndCloud(user, strategy='preferCloud'){
  if (!user || !user.uid) return {};
  const cloud = await loadState(user.uid);
  const local = {};
  for (const k of NAMESPACE_KEYS){
    const v = readLocal(k, user.email);
    if (v !== null) local[k] = v;
  }
  let merged;
  if (strategy === 'preferCloud') merged = { ...local, ...cloud };
  else if (strategy === 'preferLocal') merged = { ...cloud, ...local };
  else merged = { ...cloud, ...local };
  await saveState(user.uid, merged);
  for (const [k,v] of Object.entries(merged)) writeLocal(k, v, user.email);
  return merged;
}
