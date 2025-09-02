export const config = { runtime: 'edge' };

import { GradeSchema } from '../src/lib/validators.js';

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const parsed = GradeSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return json({ error: 'Server missing OPENAI_API_KEY' }, 500);

  const { prompt, answer, rubric } = parsed.data;

  const system = `You are a precise Arabic grading assistant. Score the student's answer against the teacher prompt using this rubric: ${rubric}. Return strict JSON: {\n  \"score\": number (0-100),\n  \"feedback\": string,\n  \"mistakes\": string[]\n}`;

  try {
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
          { role: 'user', content: `PROMPT:\n${prompt}\n\nANSWER:\n${answer}` }
        ]
      })
    });

    if (!resp.ok) return json({ error: 'OpenAI error', details: await resp.text() }, resp.status);

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    let parsedJSON; try { parsedJSON = JSON.parse(content); } catch { parsedJSON = { score: null, feedback: content, mistakes: [] }; }

    return json({ result: parsedJSON });
  } catch (e) {
    return json({ error: 'Upstream failure', details: String(e) }, 502);
  }
}