import React, { useEffect, useMemo, useRef, useState } from "react";

const randid = () => (typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2));
function isPair(x){ return x && typeof x === "object" && x.ar && x.en; }
const hasLatin = (s) => /[A-Za-z]/.test(String(s||""));

function normalizeItem(it) {
  if (!it) return it;
  if (it.source === "archive" && hasLatin(it.ar)) {
    const parts = String(it.ar).split(/[^\u0600-\u06FF]+/).filter(Boolean);
    const ar = parts.slice(0,3).join(" ").trim() || "تمرين بسيط.";
    return { ...it, ar };
  }
  return it;
}

async function fetchOne(scope, timeoutMs=20000) {
  const body = { ...scope, unit: scope.unit || "All", chapter: scope.chapter || "All" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  try {
    const r = await fetch(`/api/sentence-fast`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-nonce": randid() },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json().catch(()=>null);
    if (!isPair(j)) throw new Error("Empty pair");
    return normalizeItem(j);
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export default function TranslateGame({
  difficulty="medium",
  unit="All",
  chapter="All",
  timeMode="none",
  timeText="",
  direction="ar2en",
}) {
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const scope = useMemo(() => ({ difficulty, unit, chapter, timeMode, timeText, direction }), [difficulty, unit, chapter, timeMode, timeText, direction]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const one = await fetchOne(scope, 20000);
      setAr(one.ar || ""); setEn(one.en || ""); setGuess("");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [difficulty, unit, chapter, timeMode, timeText, direction]);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="rounded border p-4 mb-4">
        <div className="text-sm text-gray-400 mb-1">Mode: {difficulty}/{unit}/{chapter} • {direction}</div>
        <div className="text-xl font-semibold mb-3">
          {direction === "ar2en" ? ar : en}
        </div>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          className="border px-3 py-2 w-full rounded"
          placeholder={direction === "ar2en" ? "Translate to English…" : "Translate to Arabic…"}
        />
        <div className="mt-3 flex gap-2">
          <button onClick={load} className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-400" disabled={loading}>
            {loading ? "Loading…" : "Next"}
          </button>
        </div>
        {err && <div className="mt-2 text-red-600 text-sm">Error: {err}</div>}
      </div>
      <div className="text-xs text-gray-500">
        Check the response header <code>x-sf-source</code> on /api/sentence-fast; it should say <code>openai</code> for AI sentences.
      </div>
    </div>
  );
}
