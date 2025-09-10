export const config = { runtime: "nodejs" }
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { loadGlossary } = require('./_lib.cjs')

function rand(max){ return Math.floor(Math.random()*max) }
function choice(arr){ return arr[rand(arr.length)] }
function shuffle(a){ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=rand(i+1); [b[i],b[j]]=[b[j],b[i]] } return b }

const LEX = {
  people_ar: ['الطالب','الطالبة','المعلم','المعلمة','الجندي','الضابط','الطبيب','الممرضة','أمي','أبي','أختي','أخي','صديقي','صديقتي','جارتي','مديري','الموظف','المدرب','السائح','السائقة'],
  people_en: ['the student','the female student','the teacher','the female teacher','the soldier','the officer','the doctor','the nurse','my mother','my father','my sister','my brother','my friend','my (female) friend','my (female) neighbor','my manager','the employee','the coach','the tourist','the driver'],
  verbs_past_ar: ['ذهب','اشترى','قرأ','كتب','شاهد','زار','قابل','أعدّ','درس','عمل','تدرّب','ركض','أكل','شرب','نام','سافر','عاد','تحدّث','اتصل','فاز'],
  verbs_past_en: ['went','bought','read','wrote','watched','visited','met','prepared','studied','worked','trained','ran','ate','drank','slept','traveled','returned','spoke','called','won'],
  places_ar: ['إلى المدرسة','إلى المكتبة','إلى العمل','إلى المستشفى','إلى السوق','إلى الشاطئ','إلى الحديقة','إلى المطار','في البيت','في المطعم','في الصف','في المسجد','إلى الفندق','إلى القاعدة','إلى المتحف'],
  places_en: ['to the school','to the library','to work','to the hospital','to the market','to the beach','to the park','to the airport','at home','at the restaurant','in class','at the mosque','to the hotel','to the base','to the museum'],
  objects_ar: ['القهوة','الكتاب','الطعام','الماء','السيارة','الهاتف','الحقيبة','الفطور','الغداء','العشاء','التذكرة','الرسالة','الهدية'],
  objects_en: ['coffee','the book','the food','water','the car','the phone','the bag','breakfast','lunch','dinner','the ticket','the letter','the gift'],
  times_ar: ['صباحًا','مساءً','ليلاً','بعد الظهر','أمس','اليوم','غدًا','في الساعة السابعة','قريبًا','مبكرًا','متأخرًا'],
  times_en: ['in the morning','in the evening','at night','in the afternoon','yesterday','today','tomorrow','at seven o’clock','soon','early','late'],
  connectors_ar: ['ثم','ولكن','وأخيرًا','لأن','بعد أن','وبعد ذلك','وبينما'],
  connectors_en: ['then','but','finally','because','after','and after that','while'],
}

function dirMap(ar, en, direction){ return direction==='ar2en' ? {src:ar,tgt:en}:{src:en,tgt:ar} }

function extractChapterVocab(gloss, scope){
  const sem = (gloss?.semesters||[]).find(s => !scope?.semester || s.id === scope.semester) || (gloss?.semesters||[])[0]
  const unit = (sem?.units||[]).find(u => !scope?.unit || u.id === scope.unit) || (sem?.units||[])[0]
  const chap = (unit?.chapters||[]).find(c => !scope?.chapter || c.id === scope.chapter) || (unit?.chapters||[])[0]
  const vocab = (chap?.vocab || []).filter(v => v?.ar && v?.en)
  return { vocab, used: { semester: sem?.id, unit: unit?.id, chapter: chap?.id } }
}

function buildSentence({ direction='ar2en', difficulty='medium', vocab=[] }){
  const dm_people = dirMap(LEX.people_ar, LEX.people_en, direction)
  const dm_verbs  = dirMap(LEX.verbs_past_ar, LEX.verbs_past_en, direction)
  const dm_places = dirMap(LEX.places_ar, LEX.places_en, direction)
  const dm_objs   = dirMap(LEX.objects_ar, LEX.objects_en, direction)
  const dm_times  = dirMap(LEX.times_ar, LEX.times_en, direction)
  const dm_conn   = dirMap(LEX.connectors_ar, LEX.connectors_en, direction)

  const target = difficulty==='short' ? [4,7,1] : difficulty==='hard' ? [8,14,3] : [6,8,2]
  const [minLen, maxLen, wantVocab] = target

  const srcVocab = vocab.length ? vocab.map(v => direction==='ar2en' ? v.ar : v.en) : []
  const picked = shuffle(srcVocab).slice(0, Math.min(wantVocab, srcVocab.length))

  const templates = [
    () => [ choice(dm_people.src), choice(dm_verbs.src), choice(dm_places.src), choice(dm_times.src) ],
    () => [ choice(dm_people.src), choice(dm_verbs.src), choice(dm_objs.src),   choice(dm_times.src) ],
    () => [ choice(dm_times.src),  choice(dm_people.src), choice(dm_verbs.src), choice(dm_places.src) ],
    () => [ choice(dm_people.src), choice(dm_verbs.src), choice(dm_places.src), choice(dm_conn.src), choice(dm_people.src), choice(dm_verbs.src) ],
  ]

  let words = templates[rand(templates.length)]()

  for(const tok of picked){
    if (!words.includes(tok)) words.splice(Math.min(2, words.length), 0, tok)
  }

  const count = () => words.join(' ').trim().split(/\s+/).length
  while (count() < minLen) words.push(choice([choice(dm_places.src), choice(dm_times.src), choice(dm_objs.src)]))
  while (count() > maxLen) words.pop()

  const srcToTgt = (src, tgt, w) => { const i = src.indexOf(w); return i>=0 ? tgt[i] : null }
  function translateToken(w){
    return srcToTgt(dm_people.src, dm_people.tgt, w) ||
           srcToTgt(dm_verbs.src,  dm_verbs.tgt,  w) ||
           srcToTgt(dm_places.src, dm_places.tgt, w) ||
           srcToTgt(dm_objs.src,   dm_objs.tgt,   w) ||
           srcToTgt(dm_times.src,  dm_times.tgt,  w) ||
           srcToTgt(dm_conn.src,   dm_conn.tgt,   w) ||
           (srcVocab.includes(w) ? (vocab[srcVocab.indexOf(w)][direction==='ar2en'?'en':'ar']) : w)
  }

  const prompt = words.join(' ')
  const answer = words.map(translateToken).join(' ')
  const tokens = picked.length ? picked : shuffle(words).slice(0,2)
  return { prompt, answer, tokens }
}

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Cache-Control','no-store')
  try{
    const body = await new Promise(r=>{ let b=''; req.on('data', c=> b+=c); req.on('end', ()=> r(b||'{}')) })
    const { direction='ar2en', difficulty='medium', scope={} } = JSON.parse(body||'{}')

    const gloss = loadGlossary()
    const { vocab, used } = extractChapterVocab(gloss, scope)

    const built = buildSentence({ direction, difficulty, vocab })
    return res.status(200).json({ ok:true, version:'sb-2025-09-10c', direction, difficulty, scopeUsed: used, ...built })
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e?.message||e) })
  }
}
