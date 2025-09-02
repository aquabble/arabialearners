import React, { useEffect, useRef, useState } from 'react';
import Message from './Message.jsx';

export default function ChatBox() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'You are a helpful Arabic study assistant.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const next = [...messages, { role: 'user', content: input.trim() }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next })
      });
      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();
      setMessages(m => [...m, data.reply]);
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat__messages" ref={listRef}>
        {messages.filter(m => m.role !== 'system').map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}
      </div>
      <form className="chat__form" onSubmit={sendMessage}>
        <input
          className="chat__input"
          placeholder="Ask for Arabic drills, translations, tips…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button className="chat__send" disabled={loading || !input.trim()}>
          {loading ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  );
}