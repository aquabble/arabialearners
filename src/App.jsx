import React from 'react';
import ChatBox from './components/ChatBox.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Arabia Learners — OpenAI</h1>
      </header>
      <main className="app__main">
        <ChatBox />
      </main>
      <footer className="app__footer">© {new Date().getFullYear()} Arabia Learners</footer>
    </div>
  );
}