import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { apiFetch, fetchHealth } from '../../lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const HISTORY_KEY = 'trusaas_assistant_history_v1';
const MAX_HISTORY = 24;

const loadHistory = (): ChatMessage[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    // ignore corrupt storage
  }
  return [];
};

export const AssistantChat: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHealth()
      .then((h) => setConfigured(!!h.aiConfigured))
      .catch(() => setConfigured(true)); // health unreachable — let the request decide
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {
      // storage unavailable
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user' as const, content: text }].slice(-MAX_HISTORY);
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const payload: ChatMessage[] = next.map((m): ChatMessage => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
      const res = await apiFetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) setConfigured(false);
        throw new Error(data?.message || data?.error || 'AI request failed');
      }
      setMessages([...next, { role: 'assistant' as const, content: data.reply || '(empty reply)' }].slice(-MAX_HISTORY));
    } catch (err) {
      setMessages([
        ...next,
        { role: 'assistant' as const, content: `⚠ ${err instanceof Error ? err.message : 'Something went wrong. Try again.'}` },
      ].slice(-MAX_HISTORY));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="TruAssistant chat"
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 rounded-full bg-[color:var(--cyan)] text-[#06201E] shadow-[0_10px_30px_-8px_rgba(14,157,152,0.6)] hover:brightness-110 transition-all flex items-center justify-center"
        style={{ width: 52, height: 52 }}
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-[color:var(--glass-line)] bg-[color:var(--ink)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] flex flex-col"
          style={{ maxHeight: 'min(70vh, 640px)' }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:var(--glass-line)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] text-[color:var(--cyan)] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[length:var(--t-small)] font-medium text-[color:var(--white)] leading-tight">TruAssistant</p>
                <p className="text-[length:var(--t-micro)] text-[color:var(--faint)] leading-tight truncate">
                  {configured === false ? 'Not configured on this server' : 'DeepSeek · free chat'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md text-[color:var(--faint)] hover:text-[color:var(--white)] hover:bg-white/5 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-[length:var(--t-small)] text-[color:var(--muted)] leading-relaxed">
                Ask anything about your business — leads, invoices, workflow ideas, next
                steps for a deal…
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-[length:var(--t-small)] leading-relaxed break-words ${m.role === 'user'
                  ? 'ml-auto bg-[color:var(--cyan)] text-[#06201E] font-medium'
                  : 'mr-auto bg-[color:var(--glass)] border border-[color:var(--glass-line)] text-[color:var(--white)]'}`}>
                {m.role === 'assistant' ? (
                  <div className="space-y-1.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            ))}
            {busy && (
              <div className="mr-auto bg-[color:var(--glass)] border border-[color:var(--glass-line)] text-[color:var(--faint)] rounded-xl px-3 py-2 text-[length:var(--t-micro)]">
                thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-[color:var(--glass-line)] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              placeholder={configured === false ? 'AI disabled on this server' : 'Ask TruAssistant…'}
              className="flex-1 min-w-0 bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-lg px-3 py-2 text-[length:var(--t-small)] text-[color:var(--white)] placeholder-[color:var(--faint)] focus:outline-none focus:border-[color:var(--cyan-soft)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || configured === false}
              className="p-2.5 rounded-lg bg-[color:var(--cyan)] text-[#06201E] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};