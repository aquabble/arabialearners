export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async function handler(req) {
  if (req.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405);

  const { origin } = new URL(req.url);
  const urls = ['/semester1.json', '/data/semester1.json'].map(p => new URL(p, origin).href);

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (res.ok) return new Response(res.body, res);
    } catch {}
  }
  return json({ error: 'Not Found' }, 404);
}
