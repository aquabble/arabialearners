// Forwarder so front-end can call /api/sentence-fast
import bundle from "./sentence-bundle.js";
export const config = { runtime: "edge" };
export default async function handler(req) {
  try { return await bundle(req); }
  catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
