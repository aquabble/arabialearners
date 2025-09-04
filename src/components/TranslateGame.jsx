import React, { useEffect, useMemo, useState } from "react";

export default function TranslateGame() {
  const [units, setUnits] = useState(["All"]);
  const [chaptersByUnit, setChaptersByUnit] = useState({}); // { [unitName]: ["All", ...] }
  const [unit, setUnit] = useState("All");
  const [chapter, setChapter] = useState("All");
  const [direction, setDirection] = useState("ar2en");
  const [difficulty, setDifficulty] = useState("medium");
  const [size, setSize] = useState(5);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/glossary", { cache: "no-store" });
        if (!res.ok) throw new Error("glossary failed");
        const data = await res.json();
        const sems = Array.isArray(data?.semesters) ? data.semesters : [];
        const uSet = new Set(["All"]);
        const byUnit = {};
        for (const sem of sems) {
          for (const u of (sem?.units || [])) {
            const uName = u?.name || u?.id;
            if (!uName) continue;
            uSet.add(uName);
            const chs = Array.isArray(u?.chapters) ? u.chapters : [];
            byUnit[uName] = ["All", ...chs.map(c => c?.name || c?.id).filter(Boolean)];
          }
        }
        setUnits(Array.from(uSet));
        setChaptersByUnit(byUnit);
      } catch {
        setUnits(["All"]);
        setChaptersByUnit({});
      }
    })();
  }, []);

  const chapterOptions = useMemo(() => chaptersByUnit[unit] || ["All"], [chaptersByUnit, unit]);

  async function generate() {
    setLoading(true);
    setItems([]);
    try {
      const body = {
        unit: unit === "All" ? "" : unit,
        chapter: chapter === "All" ? "" : chapter,
        size: Number(size) || 5,
        direction,
        difficulty
      };
      const res = await fetch("/api/sentence-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Sentence Generator</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <div className="text-sm opacity-70 mb-1">Unit</div>
          <select className="w-full border rounded p-2" value={unit} onChange={e => setUnit(e.target.value)}>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="text-sm opacity-70 mb-1">Chapter</div>
          <select className="w-full border rounded p-2" value={chapter} onChange={e => setChapter(e.target.value)}>
            {chapterOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="text-sm opacity-70 mb-1">Direction</div>
          <select className="w-full border rounded p-2" value={direction} onChange={e => setDirection(e.target.value)}>
            <option value="ar2en">Arabic → English</option>
            <option value="en2ar">English → Arabic</option>
          </select>
        </label>

        <label className="block">
          <div className="text-sm opacity-70 mb-1">Difficulty</div>
          <select className="w-full border rounded p-2" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <label className="block">
          <div className="text-sm opacity-70 mb-1">How many?</div>
          <input className="w-28 border rounded p-2" type="number" min="1" max="20" value={size} onChange={e => setSize(e.target.value)} />
        </label>
        <button onClick={generate} className="px-4 py-2 rounded bg-black text-white disabled:opacity-60" disabled={loading}>
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((it, i) => {
          const prompt = it?.prompt || it?.ar || it?.en || "";
          const answer = it?.answer || it?.en || it?.ar || "";
          return (
            <div key={i} className="border rounded-xl p-3">
              <div className="text-lg">{prompt}</div>
              <div className="mt-1 text-sm opacity-80">{answer}</div>
              <div className="mt-1 text-xs opacity-60">{it?.ar}{it?.en ? ` — ${it.en}` : ""}</div>
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="opacity-70">No items yet — click Generate.</div>
        )}
      </div>
    </div>
  );
}
