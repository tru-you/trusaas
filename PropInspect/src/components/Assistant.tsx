import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Send, X } from 'lucide-react';
import { authFetch } from '../lib/session';

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
        background: isUser ? 'var(--accent)' : 'var(--glass)',
        color: isUser ? 'var(--text-on-accent)' : 'var(--white)',
        border: isUser ? 'none' : '1px solid var(--glass-line)',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function Assistant() {
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
    if (!text || busy) return;
    setInput('');
    setError('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const res = await authFetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: 'You are a helpful property assistant. Be concise.' }, ...next],
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
  }, [input, busy, messages]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          borderRadius: 100, background: 'var(--accent)', color: 'var(--text-on-accent)',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px -6px rgba(0,0,0,0.45)',
          border: 'none', cursor: 'pointer',
          transition: 'transform 0.3s cubic-bezier(0.34,1.4,0.64,1)',
        }}
        title={open ? 'Close assistant' : 'Ask the assistant'}
      >
        <Sparkles size={16} />
        {!open && <span>Ask</span>}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 999,
          width: 'min(380px, calc(100vw - 36px))', display: 'flex', flexDirection: 'column',
          borderRadius: 16, overflow: 'hidden',
          border: '1px solid var(--glass-line)',
          background: 'var(--ink-2)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'fadeIn 0.2s ease-out both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--glass-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                <Sparkles size={14} color="var(--text-on-accent)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>PropInspect Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={17} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', minHeight: 220, maxHeight: 420 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
                Ask me about the app or your inspections.
              </p>
            )}
            {messages.filter(m => m.role !== 'system').map((m, i) => <ChatBubble key={i} msg={m} />)}
            {error && <p style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-bg)', borderRadius: 12, padding: '8px 12px', marginTop: 8 }}>{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--glass-line)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={busy}
              placeholder="Ask something…"
              style={{
                flex: 1, background: 'var(--glass)', color: 'var(--white)', fontSize: 13,
                borderRadius: 12, padding: '8px 12px', border: '1px solid var(--glass-line)', outline: 'none',
              }}
            />
            <button type="submit" disabled={busy || !input.trim()} style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--accent)', color: 'var(--text-on-accent)',
              border: 'none', opacity: busy ? 0.4 : 1, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}