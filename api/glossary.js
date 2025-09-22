export const config = { runtime: "nodejs" }
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const lib = require('./_lib.cjs')
const { loadGlossary, normalizeGlossaryForUI } = lib

export default async (req, res) => {
  try {
    const data = loadGlossary()
    const payload = normalizeGlossaryForUI(data)
    res.setHeader('Access-Control-Allow-Origin','*')
    return res.status(200).json({ ok:true, source:'src/lib/Glossary.json', ...payload })
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e?.message||e) })
  }
}
