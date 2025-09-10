
// /api/sentence-bundle.js
// Supports GET and POST. If OPENAI_API_KEY exists, it will (optionally) generate;
// otherwise returns a small static bundle so the UI always works.

export default async function handler(req, res){
  // Allow both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST'){
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok:false, error:'Method Not Allowed' })
  }

  const count = Math.max(1, Math.min(20, Number(req.body?.count || req.query?.count || 8)))
  const direction = (req.body?.direction || req.query?.direction || 'ar2en')
  const difficulty = (req.body?.difficulty || req.query?.difficulty || 'medium')

  // If you want to wire OpenAI, uncomment and implement here using process.env.OPENAI_API_KEY.
  // For now, return a deterministic sample so the UI renders.
  const base = [
    {
      prompt: 'زارَ عليٌّ صديقهُ في المساءِ وتناولا العشاءَ معًا.',
      answer: 'Ali visited his friend in the evening and they had dinner together.',
      ar: 'زارَ',
      en: 'visited',
      modifiers: ['unit:1', 'chapter:2', `difficulty:${difficulty}`],
      tokens: ['زارَ', 'المساء', 'العشاء']
    },
    {
      prompt: 'تدرُسُ سارةُ في المكتبةِ ساعتين كلَّ يوم.',
      answer: 'Sarah studies in the library for two hours every day.',
      ar: 'تدرُسُ',
      en: 'studies',
      modifiers: ['unit:2', 'chapter:1', `difficulty:${difficulty}`],
      tokens: ['تدرُسُ', 'المكتبة', 'ساعتين']
    },
    {
      prompt: 'ذهبتُ إلى الشاطئِ صباحًا والتقطتُ صورًا للشمسِ.',
      answer: 'I went to the beach in the morning and took photos of the sun.',
      ar: 'الشاطئ',
      en: 'beach',
      modifiers: ['unit:3', 'chapter:4', `difficulty:${difficulty}`],
      tokens: ['الشاطئ', 'صباحًا', 'صورًا']
    }
  ]

  const items = Array(count).fill(0).map((_,i)=> base[i % base.length])

  return res.status(200).json({
    ok:true,
    method: req.method,
    items
  })
}
