// DROP-IN REPLACEMENT
// File: src/components/TranslateGame.jsx
// Notes:
// - Includes `direction` in scopeKey to prevent queue collisions.
// - Sends `count` instead of `size` to /api/sentence-bundle.
// - Larger first prefetch (10) to reduce immediate repeats.
// - Includes light de-duplication on enqueue.

import React, { useEffect, useMemo, useRef, useState } from "react";

export default function TranslateGame(props) {
  const {
    difficulty = "medium",
    unit = "All",
    chapter = "All",
    direction = "ar2en",
    timeMode = "off",
    timeText = ""
  } = props;

  const queueRef = useRef([]);
  const seenRef = useRef(new Set()); // keep last few seen strings to avoid near duplicates

  // Include direction in the scopeKey so ar2en and en2ar maintain independent queues
  const scopeKey = (d = difficulty, u = unit, c = chapter, t = timeMode, tt = (timeText || "").trim(), dir = direction) =>
    `${d}__${u}__${c}__${t}__${tt}__${dir}`;

  const [scope, setScope] = useState(scopeKey());

  useEffect(() => {
    setScope(scopeKey());
    // reset queue for new scope
    queueRef.current = [];
    seenRef.current = new Set();
    // initial warm-up
    ensureWarm(10).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, unit, chapter, direction, timeMode, timeText]);

  function pushUnique(items) {
    const out = [];
    for (const it of items || []) {
      const key = typeof it === "string" ? it : JSON.stringify(it);
      if (!seenRef.current.has(key)) {
        out.push(it);
        seenRef.current.add(key);
        if (seenRef.current.size > 50) {
          // trim old
          const first = seenRef.current.values().next().value;
          seenRef.current.delete(first);
        }
      }
    }
    queueRef.current.push(...out);
    return out.length;
  }

  async function fetchBundle(count) {
    const body = {
      difficulty,
      unit,
      chapter,
      direction,
      count, // <-- send count (server also accepts size; see patched API)
      timeMode,
      timeText
    };
    const res = await fetch("/api/sentence-bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error(`Bundle fetch failed: ${res.status}`);
    }
    const data = await res.json();
    // Expecting { items: [...] } but we also tolerate array fallback
    const items = Array.isArray(data) ? data : (data.items || []);
    return items;
  }

  async function ensureWarm(min = 2) {
    if (queueRef.current.length >= min) return;
    // top-up amount: 5 by default
    const topUp = Math.max(min - queueRef.current.length, 5);
    const got = await fetchBundle(topUp);
    pushUnique(got);
  }

  async function nextItem() {
    if (queueRef.current.length === 0) {
      await ensureWarm(5);
    }
    const item = queueRef.current.shift();
    // Asynchronously keep it warm
    ensureWarm(5).catch(() => {});
    return item;
  }

  // Demo render (replace with your app's UI)
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const it = await nextItem();
      if (!cancelled) setCurrent(it);
    })();
    return () => { cancelled = true; };
  }, [scope]);

  return (
    <div className="p-4 rounded-xl border shadow-sm">
      <div className="text-sm opacity-70 mb-2">Scope: {scope}</div>
      <div className="mb-4">
        <pre className="text-xs whitespace-pre-wrap">
          {current ? JSON.stringify(current, null, 2) : "Loading..."}
        </pre>
      </div>
      <button
        className="px-4 py-2 rounded-lg border"
        onClick={async () => setCurrent(await nextItem())}
      >
        Next
      </button>
    </div>
  );
}