import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CopilotView: React.FC = () => {
  const { copilotMessages, sendCopilotMessage, isCopilotLoading } = useApp();
  const [inputQuery, setInputQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim()) return;
    sendCopilotMessage(inputQuery);
    setInputQuery('');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto bg-black text-white">
      {/* Header */}
      <div className="bg-black text-white p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Dealer Assist</h1>
        </div>
        <p className="text-sm text-zinc-300">
          Ask about deals, stock, pricing, service jobs and the numbers — across sales, workshop and accounting.
        </p>
      </div>

      {/* Main Chat Box */}
      <div className="bg-black rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col h-[550px]">
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-black">
          {copilotMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-sm ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}

              <div
                className={`p-4 rounded-2xl max-w-[80%] space-y-2 ${
                  msg.sender === 'user'
                    ? 'bg-white text-black font-medium rounded-br-none shadow-md'
                    : 'bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-bl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed text-xs sm:text-sm">{msg.text}</p>
                <span className="text-[10px] opacity-60 block text-right">{msg.timestamp}</span>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {isCopilotLoading && (
            <div className="flex gap-2 items-center text-xs text-zinc-200 font-medium p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
              <Sparkles className="w-4 h-4 animate-spin text-white" />
              Dealer Assist is working through the numbers...
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-black border-t border-zinc-800 flex gap-3">
          <input
            type="text"
            placeholder="e.g. 'Which units are aging and what should I price them at?'..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-zinc-700"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isCopilotLoading}
            className="px-5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-bold shrink-0 transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
