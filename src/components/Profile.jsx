import React from 'react'
import { GoogleLogin } from '@react-oauth/google'
export default function Profile({ onLogin }){
  return (<div className="p-8 rounded-3xl bg-white dark:bg-zinc-900 shadow-xl text-center space-y-4">
    <h2 className="text-2xl font-bold">Sign in to Save Progress</h2>
    <p className="text-gray-500">Track your streak and sync across devices.</p>
    <GoogleLogin onSuccess={(res)=>{ const p=res.credential?JSON.parse(atob(res.credential.split('.')[1])):{}; onLogin({ name:p.name, email:p.email }) }} onError={()=>console.log('Login Failed')} />
  </div>);
}
