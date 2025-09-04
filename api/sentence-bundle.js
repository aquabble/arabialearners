
/**
 * POST /api/sentence-bundle
 * Body: { difficulty, unit, chapter, size, direction }
 * Returns: { ok:true, items:[{prompt,answer,ar,en}] }
 */
const { loadGlossary, extractLexicon, makeSimpleSentences } = require("./_lib.js");

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve({}); }
    });
  });
}

module.exports = async (req, res) => {
  // CORS for dev convenience
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  const body = await readBody(req);
  const {
    difficulty = "medium",
    unit = "",
    chapter = "",
    size = 5,
    direction = "ar2en"
  } = body || {};

  const { data } = loadGlossary();
  const lex = extractLexicon(data, unit, chapter);
  const items = makeSimpleSentences(lex, { size, direction, difficulty });

  res.status(200).json({
    ok: true,
    meta: { usedLexicon: lex.length, unit, chapter, difficulty, direction },
    items
  });
};
