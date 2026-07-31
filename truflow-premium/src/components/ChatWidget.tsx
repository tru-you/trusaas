import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { askAI } from "../api";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ChatWidgetProps {
  /** Let a parent open the assistant (the dashboard's "Ask Dealer Assist"
   *  button). Left undefined, the widget keeps owning its own state and
   *  behaves exactly as before. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ChatWidget({ open, onOpenChange }: ChatWidgetProps = {}) {
  const [selfOpen, setSelfOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : selfOpen;
  const setIsOpen = (v: boolean) => {
    if (!isControlled) setSelfOpen(v);
    onOpenChange?.(v);
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          text: "Hi — I'm Dealer Assist. I can see your stock, your leads and today's jobs. Ask me what to chase, what a unit should be priced at, or what's sitting too long.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    const userMsg: Message = {
      id: "user_" + Date.now(),
      text: query,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const responseText = await askAI(query);
      const botMsg: Message = {
        id: "bot_" + Date.now(),
        text: responseText,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: "error_" + Date.now(),
        text: `Error connecting to AI server: ${err.message || "Please check secret keys."}`,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-0 md:bottom-5 md:right-5 z-[1000] font-sans">
      {/* Chat Panel */}
      {isOpen && (
        <div className="flex flex-col w-full h-[100dvh] md:w-[350px] md:h-[480px] md:rounded-2xl bg-[color:var(--ink-2)] border border-[rgba(138,162,184,0.15)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-[rgba(138,162,184,0.1)] bg-[linear-gradient(90deg,rgba(20,102,224,0.1),rgba(21,199,192,0.05))]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[color:var(--cyan)] shadow-[var(--glow-cyan)]"></span>
              <span className="font-semibold text-[16px] text-[color:var(--white)]">Dealer Assist</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 scrollbar-thin">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] px-3 py-2 rounded-xl text-[13px] line-height-relaxed ${
                  m.sender === "user"
                    ? "self-end bg-[color:var(--cyan)] on-fill rounded-br-none"
                    : "self-start bg-[rgba(90,109,138,0.1)] border border-[rgba(90,109,138,0.15)] text-[color:var(--white)] rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className="text-[13px] text-[rgba(232,234,230,0.72)] mt-1 text-right">
                  {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
            {loading && (
              <div className="self-start bg-[rgba(90,109,138,0.1)] border border-[rgba(90,109,138,0.15)] text-[color:var(--white)] px-3 py-2 rounded-xl rounded-bl-none text-[13px] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[color:var(--cyan)] rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-[color:var(--cyan)] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-[color:var(--cyan)] rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-[rgba(138,162,184,0.1)] flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query stock, sales stats, hot prospects..."
              className="flex-1 bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[color:var(--cyan)] focus:bg-[color:var(--cyan-faint)] transition-all"
            />
            <button aria-label="Send message"
              type="submit"
              disabled={loading}
              className="bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] disabled:opacity-50 text-[color:var(--ink)] rounded-lg p-2 flex items-center justify-center cursor-pointer transition-all active:scale-95"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* No floating launcher. Dealer Assist opens from the top bar, so it sits
          with the rest of the controls instead of covering the screen corner. */}
    </div>
  );
}
