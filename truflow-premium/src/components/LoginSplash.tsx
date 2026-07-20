import logo from "../assets/truflow-premium-logo.svg";
import React, { useState } from 'react';
import { Lock } from 'lucide-react';

export default function LoginSplash({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === '2026') {
      onLogin();
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#070d15] text-white p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-80" />
      <div
        className="relative w-full max-w-sm p-8 rounded-2xl border border-white/15"
        style={{
          background: 'linear-gradient(160deg, rgba(40,24,64,0.55), rgba(10,16,28,0.7))',
          backdropFilter: 'blur(24px) saturate(1.45)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.45)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.1) inset, 0 24px 60px -20px rgba(0,0,0,0.85), 0 0 70px -18px rgba(168,85,247,0.45)',
        }}
      >
        <div className="flex flex-col items-center justify-center mb-6 gap-3">
          <img src={logo} alt="TruFlow Premium" className="h-14 w-auto max-w-full object-contain logo-float" />
          <p className="text-[10px] text-[#9DB0C6]">Enter password to open the DMS</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type="password"
              placeholder="Password (demo: 2026)"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#070d15] border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#1466E0] transition-colors"
            />
            <Lock className="absolute right-3 top-3.5 w-4 h-4 text-[#9DB0C6]" />
          </div>
          {error && <p className="text-xs text-[#F0555A] mb-4">Invalid password.</p>}
          <button type="submit" className="w-full py-3 rounded-xl bg-[#1466E0] hover:bg-[#1258c4] text-white font-bold text-sm">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
