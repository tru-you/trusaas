import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, X, ChevronRight, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CopilotDrawer: React.FC = () => {
  const {
    isCopilotOpen,
    setIsCopilotOpen,
    copilotMessages,
    sendCopilotMessage,
    isCopilotLoading,
    setActiveView,
  } = useApp();

  const [inputQuery, setInputQuery] = useState('');

  if (!isCopilotOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim()) return;
    sendCopilotMessage(inputQuery);
    setInputQuery('');
  };

  const handleSuggestedPrompt = (promptText: string) => {
    sendCopilotMessage(promptText);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-black text-white border-l border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              Dealer Assist
              <span className="text-[10px] bg-zinc-900 text-zinc-300 border border-zinc-700 px-1.5 py-0.5 rounded-md font-mono">
                GEMINI 3.6
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">Unified Business Intelligence</p>
          </div>
        </div>

        <button
          onClick={() => setIsCopilotOpen(false)}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-black">
        {copilotMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'ai' && (
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
            )}

            <div
              className={`p-3.5 rounded-2xl max-w-[85%] space-y-2 ${
                msg.sender === 'user'
                  ? 'bg-white text-black font-medium rounded-br-none shadow-xs'
                  : 'bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-bl-none shadow-xs'
              }`}
            >
              <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="pt-2 border-t border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Quick Action</span>
                  {msg.suggestedActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveView(action.type);
                        setIsCopilotOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-lg text-[11px] font-semibold flex items-center justify-between border border-zinc-700"
                    >
                      <span>{action.label}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[9px] opacity-60 block text-right">{msg.timestamp}</span>
            </div>

            {msg.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {isCopilotLoading && (
          <div className="flex gap-2 items-center text-xs text-zinc-200 font-medium p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
            <Sparkles className="w-4 h-4 animate-spin text-white" />
            Dealer Assist is checking deals, stock and the workshop...
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-3 bg-black border-t border-zinc-800 space-y-1.5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block px-1">
          Suggested Questions
        </span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <button
            onClick={() => handleSuggestedPrompt('Summarize our Q3 cash flow and pending client invoices.')}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg font-medium whitespace-nowrap transition-colors"
          >
            📊 Q3 Cash Flow
          </button>
          <button
            onClick={() => handleSuggestedPrompt('Which CRM deals in negotiation require immediate follow-up?')}
            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg font-medium whitespace-nowrap transition-colors"
          >
            💼 High Value Deals
          </button>
        </div>
      </div>

      {/* Input Field */}
      <form onSubmit={handleSubmit} className="p-3 bg-black border-t border-zinc-800 flex gap-2">
        <input
          type="text"
          placeholder="Ask about deals, stock, pricing or the workshop..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-zinc-700 focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isCopilotLoading}
          className="px-3.5 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-bold shrink-0 transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
