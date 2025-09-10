
// /api/sentence-bundle.js
// Generates *varied* sentence cards using OpenAI (if OPENAI_API_KEY is set).
// - Accepts both GET and POST
// - Enforces difficulty buckets
// - Deduplicates results
// - Always returns JSON: { ok, items: [...] }
//
// Env:
//   OPENAI_API_KEY = sk-...
//   OPENAI_MODEL   = gpt-4o-mini (default) or any Chat Completions-compatible model
//
// Request params (GET query or POST body):
//   count       number of items (1..20; default 12)
//   direction   "ar2en" or "en2ar"
//   difficulty  "short" | "medium" | "hard"
//   unit        optional string (e.g., "unit_1")
//   chapter     optional string (e.g., "chapter_2")
//   vocab       optional string[] of target vocab to incorporate
//
// Response item shape:
//   { prompt, answer, ar, en, modifiers[], tokens[] }
//
// Note: This is a Node (edge disabled) Vercel function using native fetch to OpenAI.
export default async function handler(req, res){
  if (req.method !== 'GET' && req.method !== 'POST'){
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok:false, error:'Method Not Allowed' })
  }

  const body = req.method === 'POST' ? (req.body || {}) : {}
  const qp = req.query || {}
  const pick = (k, d) => (body?.[k] ?? qp?.[k] ?? d)

  const count = clampInt(pick('count', 12), 1, 20)
  const direction = (pick('direction', 'ar2en') === 'en2ar') ? 'en2ar' : 'ar2en'
  const difficulty = pick('difficulty', 'medium')
  const unit = pick('unit', '')
  const chapter = pick('chapter', '')

  // vocab may arrive as JSON string or array
  let vocab = pick('vocab', [])
  if (typeof vocab === 'string'){
    try { vocab = JSON.parse(vocab) } catch { vocab = vocab.split(',').map(s=>String(s||'').trim()).filter(Boolean) }
  }
  if (!Array.isArray(vocab)) vocab = []

  const key = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  // If no key, return a deterministic but shuffled baseline so UI works.
  if (!key){
    const base = demoBase(difficulty)
    const items = takeShuffled(base, count)
    return res.status(200).json({ ok:true, method:req.method, source:'demo', items })
  }

  try{
    const prompt = buildSystemPrompt({ direction, difficulty, unit, chapter, vocab })
    const user = buildUserPrompt({ count, direction, difficulty, vocab })

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        top_p: 0.95,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: user }
        ]
      })
    })

    if (!openaiRes.ok){
      const txt = await openaiRes.text().catch(()=> '')
      return res.status(500).json({ ok:false, error:`OpenAI ${openaiRes.status}`, detail: txt.slice(0,500) })
    }

    const data = await openaiRes.json()
    const raw = safeJsonField(data, ['choices',0,'message','content'])
    const parsed = tryParseJson(raw, { items: [] })
    let items = Array.isArray(parsed?.items) ? parsed.items : []

    // Normalize & validate items
    items = items
      .map(normalizeItem)
      .filter(isValidCard)

    // Deduplicate by normalized prompt+answer
    items = dedupe(items, (x)=> `${norm(x.prompt)}|${norm(x.answer)}`)

    // Enforce difficulty constraints post-hoc; if some fail, filter them out
    items = items.filter(x => difficultyPasses(x, difficulty))

    // If not enough, top up by sampling demo base (ensures UI remains usable)
    if (items.length < count){
      const fill = takeShuffled(demoBase(difficulty), count - items.length)
      items = items.concat(fill)
    }

    // Trim to count
    items = items.slice(0, count)

    return res.status(200).json({
      ok:true,
      method:req.method,
      source:'openai',
      model,
      items
    })

  }catch(err){
    return res.status(500).json({ ok:false, error: String(err?.message || err) })
  }
}

// -------- helpers --------

function clampInt(n, min, max){
  const v = Number(n) || 0
  return Math.max(min, Math.min(max, v))
}

function norm(s){ return String(s||'').trim().toLowerCase() }

function isArabic(s){ return /[\u0600-\u06FF]/.test(String(s||'')) }

function wordCount(s){ return String(s||'').trim().split(/\s+/).filter(Boolean).length }

function normalizeItem(it){
  const o = {
    prompt: it?.prompt || it?.arSentence || it?.sentenceAr || it?.text_ar || it?.enSentence || it?.sentenceEn || it?.text_en || '',
    answer: it?.answer || '',
    ar: it?.ar || it?.vocabAr || '',
    en: it?.en || it?.vocabEn || '',
    modifiers: Array.isArray(it?.modifiers) ? it.modifiers : Array.isArray(it?.tags) ? it.tags : [],
    tokens: Array.isArray(it?.tokens) ? it.tokens : []
  }

  // Try to ensure prompt is in the "display language" depending on direction is handled in UI,
  // but we still prefer Arabic in prompt if both present.
  if (!isArabic(o.prompt) && isArabic(o.answer)){
    // swap if clearly inverted
    const tmp = o.prompt; o.prompt = o.answer; o.answer = tmp
  }
  return o
}

function isValidCard(it){
  return !!it?.prompt && !!it?.answer
}

function dedupe(arr, keyFn){
  const seen = new Set()
  const out = []
  for (const x of arr){
    const k = keyFn(x)
    if (!seen.has(k)){ seen.add(k); out.push(x) }
  }
  return out
}

function difficultyPasses(card, difficulty){
  const wcAr = wordCount(card.prompt)   // for ar2en, prompt will be Arabic in UI
  const wcEn = wordCount(card.answer)
  const lo = Math.min(wcAr, wcEn), hi = Math.max(wcAr, wcEn)

  if (difficulty === 'short'){
    return (lo >= 4 && hi <= 7)
  }
  if (difficulty === 'medium'){
    return (lo >= 6 && hi <= 8)
  }
  if (difficulty === 'hard'){
    return (hi >= 8 && hi <= 14)
  }
  return true
}

function buildSystemPrompt({ direction, difficulty, unit, chapter, vocab }){
  const rules = {
    short: '4–7 words total; include at least 1 vocab item from the provided list if any.',
    medium: '6–8 words total; include at least 2 distinct vocab items from the list if any.',
    hard: '8–14 words; complex clause but natural; include 2–3 vocab items if any.'
  }[difficulty] || 'natural, varied length'

  const dirRule = (direction === 'ar2en')
    ? 'Return Arabic in "prompt" and English in "answer".'
    : 'Return English in "prompt" and Arabic in "answer".'

  return [
    'You are generating short, natural sentence pairs for Arabic learners.',
    dirRule,
    'Return strictly a single JSON object with key "items": an array of objects.',
    'Each item must have: prompt, answer, ar, en, modifiers (array), tokens (array).',
    'The "ar"/"en" fields are the primary lexeme that motivated the sentence (not the full sentence).',
    'Use casual, everyday topics and keep meaning clear.',
    'No transliteration; Arabic must use Arabic script.',
    `Difficulty rules: ${rules}`,
    unit ? `Theme constraint: unit=${unit}.` : '',
    chapter ? `Subtheme constraint: chapter=${chapter}.` : '',
    vocab?.length ? `Target vocab to incorporate: ${vocab.join(', ')}` : 'If no vocab supplied, pick common A1–A2 lexemes.'
  ].filter(Boolean).join(' ')
}

function buildUserPrompt({ count, direction, difficulty, vocab }){
  const wants = Math.max(1, Math.min(20, Number(count||12)))
  // Ask the model to avoid duplicates explicitly.
  return [
    `Generate ${wants} unique items. Avoid duplicates and trivial rephrasings.`,
    'Vary subjects, time expressions, and verbs.',
    'Return valid JSON only.'
  ].join(' ')
}

function safeJsonField(obj, pathArr){
  let cur = obj
  for (const k of pathArr){
    if (cur && typeof cur === 'object' && k in cur){ cur = cur[k] } else { return '' }
  }
  return cur
}

function tryParseJson(txt, fallback){
  try{ return JSON.parse(txt) } catch { return fallback }
}

function demoBase(difficulty){
  // a slightly larger pool than before to reduce repetition without OpenAI
  const base = [
    { prompt:'زارَ عليٌّ صديقهُ في المساءِ وتناولا العشاءَ معًا.', answer:'Ali visited his friend in the evening and they had dinner together.', ar:'زارَ', en:'visited', modifiers:['time:evening', 'theme:friends', `difficulty:${difficulty}`], tokens:['زارَ','المساء','العشاء'] },
    { prompt:'تدرُسُ سارةُ في المكتبةِ ساعتين كلَّ يوم.', answer:'Sarah studies in the library for two hours every day.', ar:'تدرُسُ', en:'studies', modifiers:['place:library', 'freq:daily', `difficulty:${difficulty}`], tokens:['تدرُسُ','المكتبة','ساعتين'] },
    { prompt:'ذهبتُ إلى الشاطئِ صباحًا والتقطتُ صورًا للشمسِ.', answer:'I went to the beach in the morning and took photos of the sun.', ar:'الشاطئ', en:'beach', modifiers:['time:morning', 'theme:photos', `difficulty:${difficulty}`], tokens:['الشاطئ','صباحًا','صورًا'] },
    { prompt:'يشربُ خالدٌ القهوةَ قبل العملِ بقليل.', answer:'Khalid drinks coffee shortly before work.', ar:'القهوة', en:'coffee', modifiers:['time:before work', `difficulty:${difficulty}`], tokens:['يشربُ','القهوة','العمل'] },
    { prompt:'تُحبُّ لُبنى ركوبَ الدراجةِ في الحديقةِ.', answer:'Lubna loves riding a bicycle in the park.', ar:'الدراجة', en:'bicycle', modifiers:['place:park', `difficulty:${difficulty}`], tokens:['تُحبُّ','الدراجة','الحديقة'] },
    { prompt:'قرأْنا كتابًا جديدًا في نهايةِ الأسبوع.', answer:'We read a new book on the weekend.', ar:'كتاب', en:'book', modifiers:['time:weekend', `difficulty:${difficulty}`], tokens:['قرأْنا','كتابًا','الأسبوع'] },
    { prompt:'اشترى سامي بعضَ الخضارِ من السوقِ.', answer:'Sami bought some vegetables from the market.', ar:'الخضار', en:'vegetables', modifiers:['place:market', `difficulty:${difficulty}`], tokens:['اشترى','الخضار','السوق'] },
    { prompt:'نظَّمت مريم غرفتها ثم ذهبت إلى المتحف.', answer:'Maryam tidied her room, then went to the museum.', ar:'المتحف', en:'museum', modifiers:['sequence:then', `difficulty:${difficulty}`], tokens:['نظَّمت','غرفتها','المتحف'] },
    { prompt:'يتمرّنُ عمر في النادي ساعةً كلَّ صباح.', answer:'Omar works out at the gym for an hour every morning.', ar:'النادي', en:'gym', modifiers:['freq:morning', `difficulty:${difficulty}`], tokens:['يتمرّنُ','النادي','ساعةً'] },
  ]
  return base
}

function takeShuffled(arr, n){
  const a = arr.slice()
  for (let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  // cycle if n > a.length
  const out = []
  while (out.length < n){
    out.push(a[out.length % a.length])
  }
  return out
}
