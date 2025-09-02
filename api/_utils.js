// api/_utils.js
export function getOpenAI() {
  const key = process.env.OPENAI_API_KEY || ''
  if (!key) return { error: 'Missing OPENAI_API_KEY' }
  // edge-safe dynamic import
  const OpenAI = requireOpenAI()
  const client = new OpenAI({ apiKey: key })
  return { client }
}

// avoid bundler static analysis issues in edge
function requireOpenAI(){
  // eslint-disable-next-line no-new-func
  const mod = new Function('return require("openai")')()
  return mod.default || mod
}

export function json(res, status=200){
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

export function safeText(v){
  return String(v == null ? '' : v).trim()
}
