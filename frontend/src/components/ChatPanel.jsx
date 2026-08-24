import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';

export default function ChatPanel({ orderId, currentUser, getAuthHeaders }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  const loadMessages = async () => {
    try {
      const token = localStorage.getItem('lastmile_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/orders/${orderId}/messages`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 1500);
    return () => clearInterval(interval);
  }, [orderId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    try {
      await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ message: inputText })
      });
      setInputText('');
      loadMessages();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="chat-container">
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <MessageSquare size={14} color="#6366f1"/> Live Courier Chat
      </div>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', margin: 'auto' }}>No messages yet. Send a message to start!</div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUser?.id;
            return (
              <div key={msg.id} className={`chat-bubble ${isMe ? 'sent' : 'received'}`}>
                <div style={{ fontWeight: 700, fontSize: '0.65rem', color: isMe ? '#e0e7ff' : '#a5b4fc', marginBottom: '0.15rem' }}>{msg.sender_name}</div>
                <div>{msg.message}</div>
                <div className="chat-bubble-meta">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSend} className="chat-input-row" style={{ margin: 0 }}>
        <input type="text" className="chat-input" placeholder="Type message..." value={inputText} onChange={e => setInputText(e.target.value)} />
        <button type="submit" className="btn btn-accent" style={{ width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Send</button>
      </form>
    </div>
  );
}
