import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/apiBase";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randid = () => (typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2));
function isPair(x){ return x && typeof x === "object" && x.ar && x.en; }
function normUnit(u){ return (!u || u === "All") ? null : u; }
function normChapter(c){ return (!c || c === "All") ? null : c; }
function makeScopeKey({ difficulty, unit, chapter, timeMode, timeText, direction }) {
  const u = normUnit(unit);
  const ch = normChapter(chapter);
  const tt = (timeText || "").trim();
  return [difficulty, u, ch, timeMode, tt, direction].join("__");
}

async function fetchBundle({ difficulty, unit, chapter, size=3, timeMode="none", timeText="", direction="ar2en" }, timeoutMs=20000) {
  const body = { difficulty, unit: unit || "All", chapter: chapter || "All", size, timeMode, timeText, direction };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  try {
    const res = await fetch(`/api/sentence-bundle`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-nonce": randid() },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after")) || 2;
      await sleep(retry * 1000);
      return await fetchBundle({ difficulty, unit, chapter, size, timeMode, timeText, direction }, timeoutMs);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data?.items) && data.items.length) return data.items;
    if (isPair(data)) return [data];
    const f = await fetch(`/api/sentence-fast`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-nonce": randid() },
      body: JSON.stringify(body)
    });
    if (f.ok) {
      const j = await f.json().catch(()=>null);
      if (isPair(j)) return [j];
    }
    return [];
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === "AbortError" || String(err).includes("timeout")) {
      const e = new Error("aborted"); e.code = "ABORTED"; throw e;
    }
    throw err;
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
  const [feedback, setFeedback] = useState("");
  const [err, setErr] = useState("");

  const queuesRef = useRef(new Map());
  const inflightRef = useRef(null);

  const scope = useMemo(() => ({ difficulty, unit, chapter, timeMode, timeText, direction }), [difficulty, unit, chapter, timeMode, timeText, direction]);
  const key = useMemo(() => makeScopeKey(scope), [scope]);

  function abortInflight() {
    if (inflightRef.current && typeof inflightRef.current.abort === "function") {
      inflightRef.current.abort("scope-changed");
    }
    inflightRef.current = null;
  }

  async function ensureWarm() {
    try { await fetch(`/api/sentence-fast-health`, { method: "GET", cache: "no-store" }); } catch {}
  }

  async function prefetch(size = 5, timeoutMs = 20000) {
    const q = queuesRef.current;
    if (!q.has(key)) q.set(key, []);
    const queue = q.get(key);
    if (queue.length >= size) return;

    const ctrl = new AbortController();
    inflightRef.current = ctrl;

    try {
      const items = await fetchBundle(scope, timeoutMs);
      if (makeScopeKey(scope) !== key) return;
      for (const it of items) {
        if (!queue.find(x => x.ar === it.ar && x.en === it.en)) queue.push(it);
      }
    } catch (e) {
      if (e?.code === "ABORTED") {
        // ignore
      } else {
        console.warn("prefetch failed:", e);
        setErr(String(e?.message || e));
      }
    } finally {
      if (inflightRef.current === ctrl) inflightRef.current = null;
    }
  }

  function showNext() {
    const q = queuesRef.current;
    if (!q.has(key)) q.set(key, []);
    const queue = q.get(key);
    if (queue.length === 0) { prefetch(5); return; }
    const item = queue.shift();
    setAr(item.ar || ""); setEn(item.en || ""); setGuess(""); setFeedback("");
  }

  useEffect(() => { ensureWarm(); }, []);

  useEffect(() => {
    abortInflight();
    queuesRef.current.set(key, []);
    setAr(""); setEn(""); setGuess(""); setFeedback(""); setErr("");
    (async () => { setLoading(true); await prefetch(5); showNext(); setLoading(false); })();
  }, [key]); // note: includes direction

  useEffect(() => {
    const iv = setInterval(() => {
      const q = queuesRef.current.get(key) || [];
      if (q.length < 2 && !inflightRef.current) prefetch(5);
    }, 3000);
    return () => clearInterval(iv);
  }, [key]);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-2 text-sm text-gray-500">Scope: <code>{key}</code></div>
      <div className="rounded border p-4 mb-4">
        <div className="text-lg mb-2">{direction === "ar2en" ? ar : en}</div>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          className="border px-2 py-1 w-full rounded"
          placeholder={direction === "ar2en" ? "Translate to English…" : "Translate to Arabic…"}
        />
        <div className="mt-3 flex gap-2">
          <button onClick={showNext} className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-400" disabled={loading}>Next</button>
          <button onClick={() => prefetch(5)} className="px-3 py-1 rounded border">Prefetch</button>
        </div>
        {feedback && <div className="mt-2 text-green-600">{feedback}</div>}
        {err && <div className="mt-2 text-red-600">Error: {err}</div>}
      </div>
      <div className="text-xs text-gray-500">
        If cancellations persist, verify your Production OPENAI_API_KEY and consider raising your Vercel plan's execution limits.
      </div>
    </div>
  );
}
