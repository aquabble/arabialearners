import { uploadAllLocalToCloud } from './cloudStore'
let timer=null, lastUserId=null
export function notifyChange(user, delayMs=1500){
  if(!user||!user.uid) return
  if(lastUserId && lastUserId!==user.uid){ clearTimeout(timer); timer=null }
  lastUserId=user.uid
  if(timer) clearTimeout(timer)
  timer=setTimeout(()=>{ uploadAllLocalToCloud(user).catch(e=>console.warn('auto-upload failed',e)) }, delayMs)
}
