export const config = { runtime: "nodejs" }
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { loadGlossary } = require('./_lib.cjs')

function sample(arr){ return arr[Math.floor(Math.random()*arr.length)] }

function pickFallbackWord(direction){
  const vocab = [
    { ar:'الطالب', en:'the student' },
    { ar:'المعلم', en:'the teacher' },
    { ar:'الكتاب', en:'the book' },
    { ar:'في المدرسة', en:'at the school' },
    { ar:'في البيت', en:'at home' }
  ]
  return sample(vocab)
}

function buildSentence({ difficulty='medium', direction='ar2en' }){
  // difficulty controls length
  const len = difficulty==='short' ? 5 : difficulty==='hard' ? 11 : 7
  const word = pickFallbackWord(direction)
  if (direction==='ar2en'){
    const ar = ['ذهب', word.ar, 'إلى', 'المكتبة', 'صباحًا'].slice(0, len>5?5:len).join(' ')
    return { prompt: ar, answer: 'went ' + word.en + ' to the library in the morning', direction, difficulty, tokens:[word.ar] }
  } else {
    const en = ['The student','went','to','the library','in the morning'].slice(0, len>5?5:len).join(' ')
    return { prompt: en, answer: 'الطالب ذهب إلى المكتبة صباحًا', direction, difficulty, tokens:['الطالب'] }
  }
}

export default async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  try{
    // TODO: if your Semesters include vocab lists per chapter, sample from them here
    const body = (await new Promise(r=>{
      let b=''; req.on('data', c=> b+=c); req.on('end',()=>r(b||'{}'))
    }))
    const payload = JSON.parse(body)
    const out = buildSentence(payload||{})
    return res.status(200).json({ ok:true, ...out })
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e?.message||e) })
  }
}
