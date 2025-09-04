
// File: src/lib/glossary-client.js
export async function fetchGlossary() {
  // Works for both routers
  const res = await fetch("/api/glossary?ts=" + Date.now(), { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error("Failed to load glossary: " + (err.error || res.statusText));
  }
  const j = await res.json();
  return j.semesters || [];
}

import { useEffect, useState } from "react";
export function useGlossary() {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchGlossary().then(s => { if (alive) { setSemesters(s); setLoading(false); } })
                   .catch(e => { if (alive) { setError(e); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  return { semesters, loading, error };
}
