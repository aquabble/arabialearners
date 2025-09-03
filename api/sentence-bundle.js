// Edge wrapper with simple single-flight (Map) to reduce dup calls
import originalHandler from "./sentence-bundle.inner.js";
export const config = { runtime: "edge" };
const inflight = new Map();
function keyOf(req){ return req.url + ":" + (req.method || "GET"); }
export default async function handler(req){
  const key = keyOf(req);
  if (inflight.has(key)) return inflight.get(key);
  const exec = (async () => {
    try { return await originalHandler(req); }
    finally { inflight.delete(key); }
  })();
  inflight.set(key, exec);
  return exec;
}
