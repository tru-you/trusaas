import React, { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle } from "lucide-react";

const CHAT_API = "https://trusaas-chat.onrender.com";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  userName?: string;
}

export default function DealerAssist({ userName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hey! Ask me anything about shooting tips, quality scores, damage reports, DMS export, or the platform." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(() => !localStorage.getItem("trulens_assist_seen"));
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || busy) return;
    setInput("");

    const next: ChatMsg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setBusy(true);

    try {
      const res = await fetch(CHAT_API + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "trulens",
          messages: next.slice(-10),
          session: { name: userName || "Dealer" },
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't reach the server — try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = messages.length <= 1
    ? ["How do I shoot a car?", "What are quality scores?", "How to export to DMS"]
    : null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setHint(false); localStorage.setItem("trulens_assist_seen", "1"); }}
        className={`fixed bottom-5 right-5 z-[1000] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border border-[rgba(79,227,220,0.3)] transition-transform ${open ? "scale-0 pointer-events-none" : "scale-100"}`}
        style={{
          background: "rgba(11,15,23,0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        aria-label="Open Dealer Assist"
      >
        <MessageCircle size={24} className="text-[#4FE3DC]" />
        {hint && <span className="absolute inset-0 rounded-full animate-ping border-2 border-[#4FE3DC] opacity-40 pointer-events-none" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1100] flex flex-col font-sans">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer"
          />
          <div className="absolute inset-0 flex flex-col bg-[color:var(--ink-2,#0B0F17)] border-l border-[rgba(232,234,230,0.14)] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(232,234,230,0.14)] bg-[linear-gradient(90deg,rgba(20,102,224,0.1),rgba(21,199,192,0.05))]">
              <span className="font-semibold text-[16px] text-[#E8EAE6]">Dealer Assist</span>
              <button onClick={() => setOpen(false)} className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1 rounded-lg hover:bg-white/5 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div ref={msgsRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 scrollbar-thin">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "self-end bg-[rgba(79,227,220,0.12)] text-[#E8EAE6] border border-[rgba(79,227,220,0.25)]"
                      : "self-start bg-[rgba(232,234,230,0.06)] text-[rgba(232,234,230,0.85)] border border-[rgba(232,234,230,0.1)]"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="self-start max-w-[85%] rounded-xl px-3 py-2 text-[13px] text-neutral-500 bg-[rgba(232,234,230,0.04)] border border-[rgba(232,234,230,0.08)]">
                  Thinking…
                </div>
              )}
            </div>

            {suggestions && (
              <div className="flex gap-1.5 px-3 pb-1 flex-wrap">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-[rgba(79,227,220,0.25)] text-[#4FE3DC] bg-[rgba(79,227,220,0.06)] hover:bg-[rgba(79,227,220,0.14)] transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-2 border-t border-[rgba(232,234,230,0.14)]">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask anything…"
                className="flex-1 bg-[rgba(232,234,230,0.06)] border border-[rgba(232,234,230,0.14)] rounded-lg px-3 py-2 text-[13px] text-[#E8EAE6] placeholder:text-neutral-600 outline-none focus:border-[rgba(79,227,220,0.4)]"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || busy}
                className="p-2 rounded-lg text-[#4FE3DC] hover:bg-[rgba(79,227,220,0.1)] disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
