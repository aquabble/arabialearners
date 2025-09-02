export const config = { runtime: 'edge' };

import { ChatSchema } from '../src/lib/validators.js';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  let body; try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return json({ error: 'Server missing OPENAI_API_KEY' }, 500);

  const messages = parsed.data.messages.filter(m => m.role !== 'system');
  const system = parsed.data.messages.find(m => m.role === 'system')?.content ?? 'You are a helpful assistant.';

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [ { role: 'system', content: system }, ...messages ],
        temperature: 0.4
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return json({ error: 'OpenAI error', details: err }, resp.status);
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message ?? { role: 'assistant', content: 'No reply.' };
    return json({ reply });
  } catch (e) {
    return json({ error: 'Upstream failure', details: String(e) }, 502);
  }
}