// === PATCH: If filtered lex is empty, fall back to ALL glossary vocab ===
import { createRequire } from 'module';
const __require = createRequire(import.meta.url);
let __lib; try { __lib = __require("./_lib.cjs"); } catch {}
const __extractAll = __lib && (__lib.extractAllLexicon || ((obj)=>[]));

const __oldHandler = (typeof handler === "function") ? handler : null;

export default async function handler(req, res) {
  if (!__oldHandler) return res.status(500).json({ ok:false, error:"handler missing" });

  // Monkey-patch res.json to inject fallback when lex is empty
  let _json = res.json.bind(res);
  res.json = function patchedJson(payload){
    try {
      if (payload && payload.ok && Array.isArray(payload.items) && payload.items.length === 0) {
        // try to regenerate from ALL vocab if available
        const { loadGlossary, extractLexicon, makeSimpleSentences } = __lib || {};
        if (typeof loadGlossary === "function" && typeof makeSimpleSentences === "function") {
          const { data } = loadGlossary();
          const all = __extractAll ? __extractAll(data) : [];
          if (all && all.length) {
            const size = Math.max(1, Math.min(50, Number((payload.meta && payload.meta.size) || 5)));
            const direction = (payload.meta && payload.meta.direction) || "ar2en";
            const dif = (payload.meta && payload.meta.difficulty) || "medium";
            const regen = makeSimpleSentences(all, { size, direction, difficulty: dif });
            if (Array.isArray(regen) && regen.length) {
              payload.items = regen;
              payload.meta = { ...(payload.meta||{}), fallbackAll: true };
            }
          }
        }
      }
    } catch {}
    return _json(payload);
  };

  return __oldHandler(req, res);
}
