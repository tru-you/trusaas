import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, User } from "lucide-react";
import { askAI } from "../api";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export default function WebsiteChatWidget({ onLeadCapture }: { onLeadCapture: (name: string, phone: string, email: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "" });
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, showLeadForm]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          text: "Hi! Welcome to TrueCar. I'm your digital assistant. Looking for a specific vehicle or want to book a test drive?",
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
      const responseText = await askAI(`Simulate a website chatbot for a car dealership answering a customer. Keep it brief. Customer says: ${query}`);
      const botMsg: Message = {
        id: "bot_" + Date.now(),
        text: responseText,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      
      // Randomly trigger lead capture form after 2 exchanges
      if (messages.length >= 3 && !showLeadForm) {
        setTimeout(() => setShowLeadForm(true), 2000);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: "error_" + Date.now(),
        text: `Sorry, our digital assistant is currently offline. Please leave a message.`,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (leadForm.name && leadForm.phone) {
      onLeadCapture(leadForm.name, leadForm.phone, leadForm.email);
      setShowLeadForm(false);
      setMessages((prev) => [...prev, {
        id: "bot_" + Date.now(),
        text: "Thanks! One of our sales executives will contact you shortly. Your details have been sent to our showroom floor.",
        sender: "bot",
        timestamp: new Date(),
      }]);
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-[1000] font-sans">
      {/* Chat Panel */}
      {isOpen && (
        <div className="flex flex-col w-[350px] h-[480px] bg-[#0B0F17] border border-[rgba(126,164,214,0.15)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-[rgba(126,164,214,0.1)] bg-[linear-gradient(90deg,rgba(21,199,192,0.1),rgba(20,102,224,0.05))]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4FE3DC] shadow-[0_0_8px_#4FE3DC]"></span>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#E8EAE6]">Website Chat Bot</span>
                <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Public Customer Assistant</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] transition-colors p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 scrollbar-thin bg-[#06080D]">
            <div className="text-[13px] text-center text-[rgba(232,234,230,0.72)] mb-2 font-mono tracking-normal">PUBLIC WEBSITE PREVIEW</div>
            
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] px-3 py-2 rounded-xl text-xs line-height-relaxed ${
                  m.sender === "user"
                    ? "self-end bg-[#4FE3DC] on-fill rounded-br-none"
                    : "self-start bg-[rgba(90,109,138,0.1)] border border-[rgba(90,109,138,0.15)] text-[#E8EAE6] rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className={`text-[12px] mt-1 text-right ${m.sender === "user" ? "text-blue-200" : "text-[rgba(232,234,230,0.72)]"}`}>
                  {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="self-start bg-[rgba(90,109,138,0.1)] border border-[rgba(90,109,138,0.15)] text-[#E8EAE6] px-3 py-2 rounded-xl rounded-bl-none text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#4FE3DC] rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-[#4FE3DC] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-[#4FE3DC] rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
            
            {showLeadForm && (
              <div className="self-start bg-[#121826] border border-[#4FE3DC]/30 rounded-xl rounded-bl-none shadow-sm p-3 w-[90%] text-xs animate-in slide-in-from-left-2 text-[#E8EAE6]">
                <p className="font-bold text-[#E8EAE6] mb-2">Can we get your details?</p>
                <form onSubmit={handleLeadSubmit} className="flex flex-col gap-2">
                  <input required placeholder="Name" value={leadForm.name} onChange={(e) => setLeadForm({...leadForm, name: e.target.value})} className="bg-[#0B0F17] border border-white/10 rounded px-2 py-1.5 text-[#E8EAE6] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[#4FE3DC]" />
                  <input required type="tel" placeholder="Phone Number" value={leadForm.phone} onChange={(e) => setLeadForm({...leadForm, phone: e.target.value})} className="bg-[#0B0F17] border border-white/10 rounded px-2 py-1.5 text-[#E8EAE6] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[#4FE3DC]" />
                  <input type="email" placeholder="Email (Optional)" value={leadForm.email} onChange={(e) => setLeadForm({...leadForm, email: e.target.value})} className="bg-[#0B0F17] border border-white/10 rounded px-2 py-1.5 text-[#E8EAE6] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[#4FE3DC]" />
                  <button type="submit" className="bg-[#4FE3DC] on-fill font-bold py-1.5 rounded mt-1 cursor-pointer hover:bg-[#4FE3DC]/90 transition-colors">Send to Dealer</button>
                </form>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-[rgba(126,164,214,0.1)] bg-[#0B0F17] flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a car..."
              className="flex-1 bg-[#06080D] border border-white/10 rounded-full px-4 py-2 text-xs text-[#E8EAE6] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[#4FE3DC] focus:bg-[#4FE3DC]/5 transition-all"
            />
            <button
              type="submit"
              disabled={loading || showLeadForm}
              className="bg-[#4FE3DC] hover:bg-[#4FE3DC]/90 disabled:opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-all active:scale-95 animate-none"
            >
              <Send size={12} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <div className="relative group cursor-pointer animate-none" onClick={() => setIsOpen(true)}>
          <div className="absolute -top-10 left-0 bg-[#0B0F17] shadow-lg text-[#E8EAE6] text-xs font-bold px-3 py-1.5 rounded-lg border border-white/5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[1001]">
            Chat with us live!
            <div className="absolute -bottom-1 left-4 w-2 h-2 bg-[#0B0F17] border-b border-r border-white/5 transform rotate-45"></div>
          </div>
          <button className="w-14 h-14 bg-gradient-to-r from-blue-600 to-[#4FE3DC] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95">
            <MessageCircle className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
