export function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
}
export function jsonResponse(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type':'application/json', ...corsHeaders() } })
}
