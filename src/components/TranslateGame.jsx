import React from "react";

const API_BASE = ""; // same origin

export default function TranslateGame(){
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [difficulty, setDifficulty] = React.useState("medium");
  const [direction, setDirection] = React.useState("ar2en");
  const [size, setSize] = React.useState(3);

  async function fetchBundle(){
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/sentence-fast`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ difficulty, direction, size })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Request failed");
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      console.error(e);
      alert(`Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 items-center">
        <label>Difficulty:</label>
        <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
          <option value="easy">easy</option>
          <option value="medium">medium</option>
          <option value="hard">hard</option>
        </select>
        <label>Direction:</label>
        <select value={direction} onChange={e=>setDirection(e.target.value)}>
          <option value="ar2en">Arabic → English</option>
          <option value="en2ar">English → Arabic</option>
        </select>
        <label>Size:</label>
        <input type="number" min="1" max="10" value={size} onChange={e=>setSize(Number(e.target.value || 1))} />
        <button onClick={fetchBundle} disabled={loading}>
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      <ol className="space-y-3">
        {items.map((it, idx)=> (
          <li key={idx} className="border rounded p-3">
            {direction === "ar2en" ? (
              <>
                <div className="text-xl">{it.ar}</div>
                <div className="opacity-70">→ {it.en}</div>
              </>
            ) : (
              <>
                <div className="text-xl">{it.en}</div>
                <div className="opacity-70">→ {it.ar}</div>
              </>
            )}
            {it?.tokens && (
              <div className="mt-2 text-sm opacity-70">
                tokens.ar: {Array.isArray(it.tokens?.ar) ? it.tokens.ar.join(" • ") : ""}<br/>
                tokens.en: {Array.isArray(it.tokens?.en) ? it.tokens.en.join(" • ") : ""}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
