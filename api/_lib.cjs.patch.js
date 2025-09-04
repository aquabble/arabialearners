// === PATCH: robust matching for unit/chapter + 'All' wildcard ===
function __normKey(s){
  return String(s || "")
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]+/g, '-')   // unify dashes
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAllLexicon(obj){
  return extractLexicon(obj, "", "");
}

const __oldExtractLexicon = extractLexicon;
extractLexicon = function patchedExtractLexicon(obj, unitName="", chapterName=""){
  try {
    const uKey = __normKey(unitName);
    const cKey = __normKey(chapterName);
    const unitAll = !uKey || uKey === "all";
    const chapAll = !cKey || cKey === "all";

    const semesters = getSemestersList(obj);
    const out = [];
    for (const sem of (semesters||[])) {
      for (const u of (sem.units||[])) {
        const uName = (u?.name || u?.id || "").toString();
        const uNorm = __normKey(uName);
        if (!unitAll && uNorm !== uKey) continue;
        for (const ch of (u.chapters||[])) {
          const cName = (ch?.name || ch?.id || "").toString();
          const cNorm = __normKey(cName);
          if (!chapAll && cNorm !== cKey) continue;
          for (const v of (ch.vocab||[])) {
            const ar = (v.ar || v.arabic || v.word || "").toString().trim();
            const en = (v.en || v.english || v.translation || v.gloss || "").toString().trim();
            if (ar) out.push({ ar, en });
          }
        }
      }
    }
    return out;
  } catch (e) {
    // fallback to original if anything odd happens
    return __oldExtractLexicon(obj, unitName, chapterName);
  }
};

// export helpers
try { module.exports.extractAllLexicon = extractAllLexicon; } catch {}
