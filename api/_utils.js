// api/_utils.js
export function json(res, status=200){
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}
export const ok = (res)=>json(res, 200)
export const bad = (res)=>json(res, 400)
export const oops = (res)=>json(res, 500)
export const svc = (res)=>json(res, 503)

export function env(key){
  try{ return process.env[key] || '' }catch{ return '' }
}

export function safe(v){ return String(v == null ? '' : v).trim() }
