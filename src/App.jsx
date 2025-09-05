import React, { useState } from "react";
import TranslateGame from "./components/TranslateGame.jsx";

export default function App() {
  const [tab, setTab] = useState("game");

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-xl font-semibold">Arabia Learners</div>
          <nav className="flex gap-2">
            <button
              className={"px-3 py-1.5 rounded " + (tab==="game" ? "bg-black text-white" : "border")}
              onClick={() => setTab("game")}
            >
              Sentence Game
            </button>
            <a className="px-3 py-1.5 rounded border" href="/api/diag" target="_blank" rel="noreferrer">API Diag</a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === "game" && <TranslateGame />}
      </main>
    </div>
  );
}
