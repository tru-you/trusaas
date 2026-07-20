import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { askAI } from "../api";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
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
          text: "Greetings from the TrueCar DMS AI Agent! I have access to your live showroom floor inventory, customer CRM files, and operational tasks. Ask me anything!",
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
    <div className="fixed bottom-5 right-5 z-[1000] font-sans">
      {/* Chat Panel */}
      {isOpen && (
        <div className="flex flex-col w-[350px] h-[480px] bg-[#0f1826] border border-[rgba(126,164,214,0.15)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-[rgba(126,164,214,0.1)] bg-[linear-gradient(90deg,rgba(20,102,224,0.1),rgba(21,199,192,0.05))]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#15C7C0] shadow-[0_0_8px_#15C7C0]"></span>
              <span className="font-bold text-sm text-[#E8EEF6]">TrueCar DMS AI Agent</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#9DB0C6] hover:text-[#E8EEF6] transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 scrollbar-thin">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] px-3 py-2 rounded-xl text-xs line-height-relaxed ${
                  m.sender === "user"
                    ? "self-end bg-[#1466E0] text-white rounded-br-none"
                    : "self-start bg-[rgba(90,109,138,0.1)] border border-[rgba(90,109,138,0.15)] text-[#E8EEF6] rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className="text-[9px] text-[#9DB0C6] mt-1 text-right">
                  {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
            {loading && (
              <div className="self-start bg-[rgba(90,109,138,0.1)] border border-[rgba(90,109,138,0.15)] text-[#E8EEF6] px-3 py-2 rounded-xl rounded-bl-none text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#15C7C0] rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-[#15C7C0] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-[#15C7C0] rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-[rgba(126,164,214,0.1)] flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query stock, sales stats, hot prospects..."
              className="flex-1 bg-[#0f1826]/3 border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] placeholder-[#5F7590] outline-none focus:border-[#1466E0] focus:bg-[#1466E0]/5 transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1466E0] hover:bg-[#1466E0]/90 disabled:opacity-50 text-white rounded-lg p-2 flex items-center justify-center cursor-pointer transition-all active:scale-95"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-[#1466E0] hover:bg-gradient-to-r from-[#1466E0] to-[#15C7C0] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-[#1466E0]/30 transition-all cursor-pointer active:scale-95 group"
        >
          <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
}
