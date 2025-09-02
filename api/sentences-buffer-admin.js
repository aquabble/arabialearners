// Minimal admin/debug endpoint (protect behind a secret if exposed!)
import { bufferPut, bufferPutMany, bufferPop, bufferSize } from "./_sentenceBuffer.js";

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export default async function handler(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "size";
  const semester = url.searchParams.get("semester") || "0";
  const unit = url.searchParams.get("unit") || "0";
  const chapter = url.searchParams.get("chapter") || "0";

  if (action === "size") {
    const n = await bufferSize({ semester, unit, chapter });
    return json({ ok: true, size: n, semester, unit, chapter });
  }

  if (action === "pop") {
    const s = await bufferPop({ semester, unit, chapter });
    return json({ ok: true, popped: s });
  }

  if (action === "put") {
    const body = await req.json().catch(()=> ({}));
    const ok = await bufferPut({
      ar: body.ar, en: body.en,
      semester, unit, chapter
    });
    return json({ ok, semester, unit, chapter });
  }

  if (action === "putMany") {
    const body = await req.json().catch(()=> ({}));
    const { items = [] } = body;
    const res = await bufferPutMany(items, { semester, unit, chapter });
    return json({ ok: true, ...res });
  }

  return json({ error: "unknown action" }, 400);
}
