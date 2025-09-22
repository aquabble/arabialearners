// api/sentence-bundle.js
export const config = { runtime: "edge" };

/** Small helper: consistent JSON response with permissive CORS (same-origin is fine, but this keeps flexibility) */
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });
}

// Arabic normalization helpers
const __AL_HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const __alNormAr = (s) => String(s||'')
  .normalize('NFC')
  .replace(__AL_HARAKAT,'')
  .replace(/[\u061B\u061F\u060C]/g,' ')
  .replace(/[\.\!\?\,\;:]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();
const __alToks = (s) => __alNormAr(s).split(/\s+/).filter(Boolean);

function __alCountVocabInclusion(text, vocab){
  const t = __alNormAr(text);
  let count = 0;
  for(const v of (vocab||[])){
    const needle = __alNormAr(v.ar||v.word||'');
    if (needle && (t.includes(' '+needle+' ') || t.endsWith(' '+needle) || t.startsWith(needle+' ') || t === needle)) {
      count++;
    }
  }
  return count;
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return jsonResponse({}, 200);

  const body = await readBody(request);
  const { difficulty = "medium", semesterId, unitId, chapterId } = body || {};

  const glossary = await loadGlossary(request);
  const scopedVocab = getScopedVocab(glossary, { semesterId, unitId, chapterId });

  if (!scopedVocab.length) {
    return jsonResponse(
      {
        ok: false,
        error: "NO_VOCAB_FOUND",
        note: "Check that Glossary.json has vocab arrays at the selected scope.",
        scope: { semesterId, unitId, chapterId },
      },
      200
    );
  }

  // Try OpenAI first if available; otherwise local generator
  let bundle = null;
  try {
    bundle = await openAIGenerate({ vocab: scopedVocab, difficulty });
  } catch {
    // fallthrough
  }
  if (!bundle) {
    bundle = localGenerate({ vocab: scopedVocab, difficulty });
  }

  return jsonResponse({
    ok: true,
    source: "edge",
    scope: { semesterId, unitId, chapterId, difficulty },
    prompt: bundle.prompt,
    answer: bundle.answer,
    vocabUsed: bundle.vocabUsed, // [{ar,en}]
  });
}

// Arabic normalization helpers
  .normalize('NFC').replace(__AL_HARAKAT,'')
  .replace(/[\u061B\u061F\u060C]/g,' ')
  .replace(/[\.\!\?\,\;:]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();

  const t = __alNormAr(text);
  let count = 0;
  for(const v of (vocab||[])){
    const needle = __alNormAr(v.ar||v.word||'');
    if (needle && (t.includes(' '+needle+' ') || t.endsWith(' '+needle) || t.startsWith(needle+' ') || t === needle)) {
      count++;
    }
  }
  return count;
}