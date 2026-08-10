import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Send, X } from 'lucide-react';
import { api } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-accent text-white rounded-br-md'
            : 'bg-[rgba(255,255,255,0.06)] text-[#F4F4F1] rounded-bl-md border border-[rgba(255,255,255,0.08)]'
        }`}
      >
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
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
      const res = await api<{ choices: { message: { content: string } }[] }>('/api/assistant', {
        method: 'POST',
        body: {
          messages: [
            { role: 'system', content: 'You are a helpful property management assistant for Flow Prop. Answer questions about the app, real estate, and property management. Be concise.' },
            ...next,
          ],
        },
      });
      const reply = res.choices?.[0]?.message?.content || 'No response.';
      setMessages([...next, { role: 'assistant', content: reply }]);
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
        className="fixed bottom-5 right-5 z-[999] flex items-center gap-2 px-4 py-2.5 rounded-full
          bg-[linear-gradient(135deg,#0E9D98,#0B7C72)] text-white text-[13px] font-semibold
          shadow-[0_8px_24px_-6px_rgba(14,157,152,0.45)] hover:scale-[1.03]
          transition-transform duration-300 ease-spring"
        title={open ? 'Close assistant' : 'Ask the assistant'}
      >
        <Sparkles size={16} className={open ? '' : 'animate-pulse'} />
        {!open && <span className="hidden sm:inline">Ask</span>}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-[999] w-[min(380px,calc(100vw-36px))] flex flex-col
          rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)]
          bg-[rgba(12,13,18,0.92)] backdrop-blur-2xl
          shadow-[0_28px_70px_-20px_rgba(0,0,0,0.65),0_0_30px_-16px_rgba(14,157,152,0.15)]
          animate-fade"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[linear-gradient(135deg,#0E9D98,#0B7C72)] flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="text-[13px] font-semibold text-[#F4F4F1]">Flow Prop Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#94A3B8] hover:text-white transition-colors">
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[280px] max-h-[480px]">
            {messages.length === 0 && (
              <p className="text-[12.5px] text-[#94A3B8] text-center mt-6 leading-relaxed">
                Ask me anything about the app, your portfolio, or property management.
              </p>
            )}
            {messages.filter((m) => m.role !== 'system').map((m, i) => (
              <ChatBubble key={i} msg={m} />
            ))}
            {error && (
              <p className="text-[12px] text-[#C06666] bg-[rgba(192,102,102,0.10)] rounded-xl px-3 py-2">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 px-3 py-3 border-t border-[rgba(255,255,255,0.06)]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              placeholder="Ask something…"
              className="flex-1 bg-[rgba(255,255,255,0.05)] text-[#F4F4F1] text-[13px] rounded-xl px-3.5 py-2.5
                placeholder-[rgba(255,255,255,0.28)] outline-none border border-[rgba(255,255,255,0.06)]
                focus:border-[rgba(14,157,152,0.4)] transition-colors"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-[linear-gradient(135deg,#0E9D98,#0B7C72)]
                flex items-center justify-center disabled:opacity-40 transition-opacity"
            >
              <Send size={15} className="text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}