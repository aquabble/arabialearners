export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normAR(s){
  if(typeof s !== 'string') return '';
  return s.normalize('NFKC')
    .replace(/[\u064B-\u0652]/g, '') // harakat
    .replace(/\u0640/g, '')           // tatweel
    .trim();
}
function normEN(s){
  if(typeof s !== 'string') return '';
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}
function normalizeByLang(s, lang){
  if(lang === 'en2ar') return normAR(s);
  if(lang === 'ar2en') return normEN(s);
  // free: try both
  return s.trim();
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const {
    mode = 'evaluate',
    prompt,
    expected = '',
    userAnswer = '',
    lang = 'free',
    tolerance = 0.85
  } = body || {};

  if(!prompt) return json({ error: 'Missing prompt' }, 400);
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if(!OPENAI_API_KEY) return json({ error: 'Server missing OPENAI_API_KEY' }, 500);

  if(mode === 'answer'){
    // Generate an answer for the given prompt (no comparison)
    const system = 'You answer briefly and accurately for Arabic learning tasks.';
    try{
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ]
        })
      });
      if(!resp.ok) return json({ error: 'OpenAI error', details: await resp.text() }, resp.status);
      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content ?? '';
      return json({ reply });
    }catch(e){
      return json({ error: 'Upstream failure', details: String(e) }, 502);
    }
  }

  // evaluate mode (default): compare userAnswer vs expected, with OpenAI feedback
  if(!userAnswer) return json({ error: 'Missing userAnswer' }, 400);
  if(!expected) return json({ error: 'Missing expected (teacher canonical) for evaluate mode' }, 400);

  // fast-path exact-ish check
  const nExp = normalizeByLang(expected, lang);
  const nAns = normalizeByLang(userAnswer, lang);
  if(nExp && nAns && nExp === nAns){
    return json({ isCorrect: true, score: 100, feedback: 'Exact match (normalized).', canonical: expected });
  }

  const system = `You are a strict but fair evaluator for short Arabic↔English answers.
Return ONLY JSON with keys: isCorrect (boolean), score (0-100), feedback (short string), canonical (string best answer).
Consider synonyms and minor spelling variants. Be concise.`;

  const user = `PROMPT:
${prompt}

EXPECTED (teacher canonical):
${expected}

LEARNER ANSWER:
${userAnswer}

LANG: ${lang} (ar2en = Arabic→English, en2ar = English→Arabic, free = freeform)
TOLERANCE: ${tolerance} (fractional similarity threshold)
`;

  try{
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if(!resp.ok){
      const t = await resp.text();
      return json({ error: 'OpenAI error', details: t }, resp.status);
    }
    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { parsed = { isCorrect:false, score:0, feedback: content, canonical: expected }; }
    parsed.isCorrect = !!parsed.isCorrect;
    parsed.score = Math.max(0, Math.min(100, Number(parsed.score)||0));
    parsed.canonical = parsed.canonical || expected;
    return json(parsed);
  }catch(e){
    return json({ error: 'Upstream failure', details: String(e) }, 502);
  }
}
