import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { sendMessageToAi } from '../../lib/ai/client';

type Message = { from: 'user' | 'bot'; text: string };

export default function AIHelper() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const role = user?.role || 'student';

  async function send() {
    if (!input.trim()) return;
    const userMsg: Message = { from: 'user', text: input };
    setMessages((m) => [...m, userMsg]);
    setInput('');

    try {
      const data = await sendMessageToAi(userMsg.text, role);
      const botMsg: Message = { from: 'bot', text: data.reply || 'Bir cevap alınamadı.' };
      setMessages((m) => [...m, botMsg]);
    } catch (err: any) {
      const errText = err?.message || String(err);
      const botMsg: Message = { from: 'bot', text: `Sunucuya bağlanırken hata oluştu: ${errText}` };
      setMessages((m) => [...m, botMsg]);
    }
  }

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60 }}>
      <button onClick={() => setOpen((s) => !s)} style={{ padding: '8px 12px' }}>
        {open ? 'Kapat AI' : 'YKS Mentor AI'}
      </button>
      {open && (
        <div style={{ width: 360, height: 480, background: '#fff', border: '1px solid #ddd', marginTop: 8, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #eee', fontWeight: 600 }}>YKS Mentor Yardımcısı ({role})</div>
          <div style={{ flex: 1, padding: 8, overflow: 'auto' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#666' }}>{m.from === 'user' ? 'Sen' : 'Mentor'}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid #eee' }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={send} style={{ flex: 1 }}>Gönder</button>
              <button onClick={() => setMessages([])}>Temizle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
