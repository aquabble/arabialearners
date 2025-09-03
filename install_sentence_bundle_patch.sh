#!/usr/bin/env bash
set -euo pipefail

mkfile() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path"
  echo "Wrote $path"
}

# 1) Normalizer util
mkfile "api/_normalizeSentenceBundleBody.js" <<'EOF'
// api/_normalizeSentenceBundleBody.js
const DIFFICULTIES = new Set(["easy","medium","hard"]);
const DIRECTIONS   = new Set(["ar2en","en2ar"]);
const TIMEMODES    = new Set(["none","relative","absolute"]);

function toNullIfAll(v){
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim().toLowerCase() === "all") return null;
  return v;
}
function clamp(n, lo, hi){ if (isNaN(n)) return lo; return Math.max(lo, Math.min(hi, n)); }

function normalizeSentenceBundleBody(input = {}){
  const body = typeof input === "object" && input !== null ? input : {};
  const difficulty = DIFFICULTIES.has(String(body.difficulty||"").toLowerCase()) ? String(body.difficulty).toLowerCase() : "medium";
  const direction  = DIRECTIONS.has(String(body.direction||"").toLowerCase())   ? String(body.direction).toLowerCase()  : "ar2en";
  const timeMode   = TIMEMODES.has(String(body.timeMode||"").toLowerCase())     ? String(body.timeMode).toLowerCase()   : "none";
  const unit       = toNullIfAll(body.unit);
  const chapter    = toNullIfAll(body.chapter);
  const sizeRaw    = typeof body.size==="number" ? body.size : parseInt(body.size,10);
  const size       = clamp(sizeRaw, 1, 10);
  const timeText   = typeof body.timeText==="string" ? body.timeText : "";
  return { difficulty, unit, chapter, size, timeMode, timeText, direction };
}

module.exports = { normalizeSentenceBundleBody };
EOF

# 2) API route (Next.js) - if you already have one, merge the normalization bits
mkfile "pages/api/sentence-bundle.js" <<'EOF'
// pages/api/sentence-bundle.js
import { normalizeSentenceBundleBody } from "../../api/_normalizeSentenceBundleBody.js";

export default async function handler(req, res){
  if (req.method !== "POST"){
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok:false, error:"Method Not Allowed" });
  }

  let incoming = {};
  try {
    incoming = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ ok:false, error:"Invalid JSON body" });
  }

  const body = normalizeSentenceBundleBody(incoming);

  try {
    // TODO: replace with your real sentence generation logic
    const mock = Array.from({length: body.size}).map((_, i) => ({
      id: i+1,
      ar: "جملة عربية تجريبية",
      en: "Sample Arabic sentence",
      meta: { difficulty: body.difficulty, direction: body.direction, unit: body.unit, chapter: body.chapter }
    }));
    return res.status(200).json({ ok:true, data: mock });
  } catch (err){
    console.error("sentence-bundle error", err);
    return res.status(500).json({ ok:false, error:"Server error" });
  }
}
EOF

# 3) Client wrapper (browser/Node safe)
mkfile "src/lib/getSentenceBundle.js" <<'EOF'
// src/lib/getSentenceBundle.js
export async function getSentenceBundle({
  difficulty = "medium",
  unit = null,
  chapter = null,
  size = 3,
  timeMode = "none",
  timeText = "",
  direction = "ar2en",
  endpoint = "/api/sentence-bundle"
} = {}){
  const payload = { difficulty, unit, chapter, size, timeMode, timeText, direction };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Accept":"application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok){
    const errText = await res.text().catch(()=>String(res.status));
    throw new Error(`sentence-bundle HTTP ${res.status}: ${errText}`);
  }
  const json = await res.json();
  if (json && typeof json === "object" && "ok" in json){
    if (!json.ok) throw new Error(json.error || "Unknown error");
    return json.data;
  }
  return json;
}
EOF

# 4) Node test script (optional)
mkfile "scripts/try-sentence-bundle.mjs" <<'EOF'
// scripts/try-sentence-bundle.mjs
import fetch from "node-fetch"; // Node >=18: you can remove this import
globalThis.fetch ||= fetch;
import { getSentenceBundle } from "../src/lib/getSentenceBundle.js";

const data = await getSentenceBundle({
  difficulty: "medium",
  unit: null,
  chapter: null,
  size: 3,
  direction: "ar2en",
  endpoint: "https://arabialearners.vercel.app/api/sentence-bundle"
});

console.log("Received:", data);
EOF

# 5) README
mkfile "README-SENTENCE-BUNDLE-PATCH.md" <<'EOF'
# Patch: sentence-bundle (client + API)

## What this does
- Normalizes incoming POST bodies on the server (tolerates `"All"`, coerces types).
- Cleans the client request (no browser-only headers; minimal JSON body).

## Files
- `pages/api/sentence-bundle.js` — patched API route.
- `api/_normalizeSentenceBundleBody.js` — shared normalizer.
- `src/lib/getSentenceBundle.js` — safe client wrapper.
- `scripts/try-sentence-bundle.mjs` — Node test script.

## How to use
- Call from browser/Node:
  ```js
  import { getSentenceBundle } from "@/lib/getSentenceBundle";
  const data = await getSentenceBundle({ difficulty:"medium", unit:null, chapter:null, size:3, direction:"ar2en" });
