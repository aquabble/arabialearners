import React, { useEffect, useMemo, useState } from "react";

/**
 * TranslateGame (scoped-vocab v2)
 *
 * - Loads glossary from /api/glossary
 * - Lets the user pick Semester → Unit → Chapter
 * - Sends { semesterId, unitId, chapterId, difficulty } to /api/sentence-bundle
 * - Displays the generated prompt and which vocab was used
 */
export default function TranslateGame() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [glossary, setGlossary] = useState(null);

  const [semesterId, setSemesterId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [difficulty, setDifficulty] = useState("medium"); // "short" | "medium" | "hard"

  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [vocabUsed, setVocabUsed] = useState([]); // [{ar,en}]

  const [userGuess, setUserGuess] = useState("");
  const [grading, setGrading] = useState(null); // optional: server grading result

  // --- Load glossary once ---
  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/glossary");
        const data = await res.json();
        if (aborted) return;

        if (!data || !data.ok) {
          throw new Error(data?.error || "Failed to load glossary");
        }
        setGlossary(data.glossary || data);

        // Initialize defaults to the first available ids
        const s = data.glossary?.semesters || data.semesters || [];
        const s0 = s[0];
        if (s0?.id) setSemesterId(s0.id);
        const u0 = s0?.units?.[0];
        if (u0?.id) setUnitId(u0.id);
        const c0 = u0?.chapters?.[0];
        if (c0?.id) setChapterId(c0.id);
      } catch (e) {
        console.error(e);
        setError(e.message || "Glossary load error");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

  // --- Dependent lists ---
  const semesters = useMemo(() => glossary?.semesters ?? [], [glossary]);
  const units = useMemo(() => {
    return semesters.find((s) => s.id === semesterId)?.units ?? [];
  }, [semesters, semesterId]);
  const chapters = useMemo(() => {
    return units.find((u) => u.id === unitId)?.chapters ?? [];
  }, [units, unitId]);

  // When semester changes, reset unit & chapter
  useEffect(() => {
    if (!semesterId) return;
    const u0 = units?.[0];
    setUnitId(u0?.id || "");
  }, [semesterId]);

  // When unit changes, reset chapter
  useEffect(() => {
    if (!unitId) return;
    const c0 = chapters?.[0];
    setChapterId(c0?.id || "");
  }, [unitId]);

  // --- Fetch a new sentence with scope ---
  async function getNewSentence() {
    setError("");
    setPrompt("");
    setAnswer("");
    setVocabUsed([]);
    setGrading(null);

    try {
      const body = {
        difficulty,
        semesterId: semesterId || undefined,
        unitId: unitId || undefined,
        chapterId: chapterId || undefined,
      };

      const res = await fetch("/api/sentence-bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data?.ok || !data?.prompt) {
        setError(data?.error || "Could not generate sentence");
        return;
      }

      setPrompt(data.prompt);
      setAnswer(data.answer || "");
      setVocabUsed(Array.isArray(data.vocabUsed) ? data.vocabUsed : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Sentence request failed");
    }
  }

  // --- Optional: send to /api/grade ---
  async function gradeGuess() {
    setGrading(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, guess: userGuess }),
      });
      const data = await res.json();
      setGrading(data);
    } catch (e) {
      console.error(e);
      setGrading({ ok: false, error: e.message || "grade failed" });
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Translate Game</h1>

      {loading && <div>Loading glossary…</div>}
      {error && (
        <div className="rounded-md bg-red-100 text-red-800 p-2 text-sm">{error}</div>
      )}

      {/* Scope selectors */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm mb-1">Semester</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Unit</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Chapter</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Difficulty</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="short">Short (4–7)</option>
            <option value="medium">Medium (6–8)</option>
            <option value="hard">Hard (8–14)</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={getNewSentence}
          className="px-3 py-2 rounded bg-black text-white"
        >
          New sentence
        </button>
      </div>

      {/* Prompt display */}
      {prompt && (
        <div className="mt-3 p-3 border rounded">
          <div className="text-lg">{prompt}</div>
          {vocabUsed?.length > 0 && (
            <div className="mt-2 text-sm opacity-70">
              Uses vocab: {vocabUsed.map((v) => v.ar).join("، ")}
            </div>
          )}
        </div>
      )}

      {/* Answer & grading (optional) */}
      <div className="space-y-2">
        <textarea
          className="w-full border rounded p-2 min-h-[80px]"
          placeholder="Type your English translation here…"
          value={userGuess}
          onChange={(e) => setUserGuess(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={gradeGuess} className="px-3 py-2 rounded border">
            Check
          </button>
          {answer && (
            <details>
              <summary className="cursor-pointer select-none">Show model answer hint</summary>
              <div className="text-sm mt-1 opacity-80">{answer}</div>
            </details>
          )}
        </div>
        {grading && (
          <div className="text-sm opacity-80">{JSON.stringify(grading)}</div>
        )}
      </div>
    </div>
  );
}
