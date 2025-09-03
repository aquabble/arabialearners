import React, { useEffect, useState } from "react";

export default function TranslateGame({
  difficulty = "medium",
  unit = "All",
  chapter = "All",
  timeMode = "none",
  timeText = "",
  direction = "ar2en",
}) {
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/sentence-fast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ difficulty, unit, chapter, timeMode, timeText, direction }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      setAr(j.ar || "");
      setEn(j.en || "");
      setGuess("");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [difficulty, unit, chapter, timeMode, timeText, direction]);

  return (
    <div className="p-4">
      <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800 p-6 max-w-3xl">
        <div className="text-sm text-neutral-400 mb-3">Translate</div>
        <div className="text-2xl font-semibold mb-4">
          {direction === "ar2en" ? ar : en}
        </div>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          className="border border-neutral-700 bg-neutral-900 rounded-lg w-full px-3 py-2"
          placeholder={direction === "ar2en" ? "Type the English meaning…" : "اكتب المعنى بالعربية…"}
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Next"}
          </button>
        </div>
        {err && <div className="mt-3 text-red-500 text-sm">Error: {err}</div>}
      </div>
    </div>
  );
}
