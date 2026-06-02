import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { sendMessageToAi } from '../../lib/ai/client';

type Message = { from: 'user' | 'bot'; text: string; fullText?: string };

export default function AIHelper() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const role = user?.role || 'student';

  async function send() {
    if (!input.trim()) return;
    const userMsg: Message = { from: 'user', text: input };
    setMessages((m) => [...m, userMsg]);
    setInput('');

    try {
      const data = await sendMessageToAi(userMsg.text, role);
      const botMsg: Message = { from: 'bot', text: data.reply || 'Bir cevap alınamadı.', fullText: data.fullReply };
      setMessages((m) => [...m, botMsg]);
    } catch (err: any) {
      const errText = err?.message || String(err);
      const botMsg: Message = { from: 'bot', text: `Sunucuya bağlanırken hata oluştu: ${errText}` };
      setMessages((m) => [...m, botMsg]);
    }
  }

  const toggleExpand = (idx: number) => {
    setExpanded((s) => ({ ...s, [idx]: !s[idx] }));
  };

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60 }}>
      <button onClick={() => setOpen((s) => !s)} style={{ padding: '8px 12px' }}>
        {open ? 'Kapat AI' : 'YKS Mentor AI'}
      </button>
      {open && (
        <div style={{ width: 380, height: 520, background: '#fff', border: '1px solid #e6e6e6', marginTop: 8, display: 'flex', flexDirection: 'column', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', borderRadius: 8 }}>
          <div style={{ padding: 12, borderBottom: '1px solid #f1f1f1', fontWeight: 600 }}>YKS Mentor Yardımcısı ({role})</div>
          <div style={{ flex: 1, padding: 12, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 4, alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{m.from === 'user' ? 'Sen' : 'Mentor'}</div>
                <div style={{ background: m.from === 'user' ? '#eef2ff' : '#f7f7f8', padding: 12, borderRadius: 10, maxWidth: 320, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {m.from === 'bot' && m.fullText ? (
                    <>
                      <div>{expanded[i] ? m.fullText : m.text}</div>
                      {m.fullText.length > m.text.length && (
                        <button onClick={() => toggleExpand(i)} style={{ marginTop: 8, background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer' }} aria-label="Show more">
                          {expanded[i] ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </>
                  ) : (
                    <div>{m.text}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #f1f1f1' }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} style={{ width: '100%', borderRadius: 6, border: '1px solid #eaeaea', padding: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={send} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>Gönder</button>
              <button onClick={() => setMessages([])} style={{ background: '#fff', border: '1px solid #e6e6e6', padding: '8px 12px', borderRadius: 6 }}>Temizle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
