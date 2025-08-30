import React, { useEffect, useState } from 'react'
import { firebaseSignIn, firebaseSignOut, onAuth } from '../lib/firebase'
import { mergeLocalAndCloud, uploadAllLocalToCloud, downloadAllCloudToLocal, subscribeCloudToLocal } from '../lib/cloudStore'
export default function ProfileFirebase({ onLogin }){
  const [user,setUser]=useState(null); const [sub,setSub]=useState(null)
  useEffect(()=>{ const off=onAuth(async (u)=>{ setUser(u); if(u){ onLogin(u); const merged=await mergeLocalAndCloud(u,'preferCloud'); const unsub=subscribeCloudToLocal(u); setSub(()=>unsub) } else { if(sub) sub(); setSub(null) } }); return ()=>off&&off() },[])
  return (<div className="p-8 rounded-3xl bg-white dark:bg-zinc-900 shadow-xl text-center space-y-4">{!user? (<><h2 className="text-2xl font-bold">Sign in with Google</h2><p className="text-gray-500">Sync your progress across devices.</p><button onClick={firebaseSignIn} className="px-4 py-2 rounded-xl bg-emerald-500 text-white">Sign in</button></>) : (<><div className="text-lg">Hi, {user.name}</div><div className="flex justify-center gap-2"><button onClick={async()=>uploadAllLocalToCloud(user)} className="px-3 py-1.5 rounded-xl border">Upload</button><button onClick={async()=>downloadAllCloudToLocal(user)} className="px-3 py-1.5 rounded-xl border">Download</button></div><button onClick={firebaseSignOut} className="px-4 py-2 rounded-xl bg-rose-500 text-white">Sign out</button></>)}</div>)
}
