import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Send, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.25s ease-out both' }}>
      <div style={{
        maxWidth: '80%', borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        padding: '8px 14px', fontSize: 13, lineHeight: 1.45,
        background: isUser ? '#0E9D98' : 'rgba(255,255,255,0.06)',
        color: isUser ? '#fff' : '#F4F4F1',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function Assistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !user) return;
    setInput('');
    setError('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{ role: 'system', content: 'You are a helpful property inspection assistant for PropLens. Be concise.' }, ...next],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API error');
      setMessages([...next, { role: 'assistant', content: data.choices?.[0]?.message?.content || 'No response.' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, user]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          borderRadius: 100, background: 'linear-gradient(135deg,#0E9D98,#0B7C72)',
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px -6px rgba(14,157,152,0.45)',
          border: 'none', cursor: 'pointer',
          transition: 'transform 0.3s cubic-bezier(0.34,1.4,0.64,1)',
        }}
        title={open ? 'Close assistant' : 'Ask the assistant'}
      >
        <Sparkles size={16} className={open ? '' : 'animate-pulse'} />
        {!open && <span>Ask</span>}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 999,
          width: 'min(380px, calc(100vw - 36px))', display: 'flex', flexDirection: 'column',
          borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(12,13,18,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 28px 70px -20px rgba(0,0,0,0.65), 0 0 30px -16px rgba(14,157,152,0.15)',
          animation: 'fadeIn 0.2s ease-out both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#0E9D98,#0B7C72)', display: 'grid', placeItems: 'center' }}>
                <Sparkles size={14} color="#fff" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F4F4F1' }}>PropLens Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}><X size={17} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', minHeight: 220, maxHeight: 420 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
                Ask me about the app, photo tips, or your inspections.
              </p>
            )}
            {messages.filter(m => m.role !== 'system').map((m, i) => <ChatBubble key={i} msg={m} />)}
            {error && <p style={{ fontSize: 12, color: '#C06666', background: 'rgba(192,102,102,0.10)', borderRadius: 12, padding: '8px 12px' }}>{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={busy}
              placeholder="Ask something…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', color: '#F4F4F1', fontSize: 13,
                borderRadius: 12, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)', outline: 'none',
              }}
            />
            <button type="submit" disabled={busy || !input.trim()} style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg,#0E9D98,#0B7C72)',
              border: 'none', opacity: busy ? 0.4 : 1, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}>
              <Send size={15} color="#fff" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}