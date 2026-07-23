import logo from "../assets/truflow-logo.png";
import React, { useState } from 'react';
import { Lock, ExternalLink } from 'lucide-react';
import { TRUE_CARS_URL, TRUESAAS_URL } from '../lib/ecosystem';
import { login, enterDemo } from '../lib/session';

export default function LoginSplash({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [demoBusy, setDemoBusy] = useState(false);

  // The code is checked by the server, which hands back a session token.
  // Nothing here can authorise anything on its own.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(password, remember);
      onLogin();
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Try again.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#06080D] text-white p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-80" />
      <div
        className="relative w-full max-w-sm p-8 rounded-2xl border border-[rgba(232,234,230,0.14)]"
        style={{
          background: '#0B0F17',
          boxShadow: '0 1px 0 rgba(232,234,230,0.06) inset, 0 40px 90px -40px rgba(0,0,0,0.95)',
        }}
      >
        <div className="flex flex-col items-center justify-center mb-6 gap-3">
          <img src={logo} alt="TruFlow Premium" className="h-14 w-auto max-w-full object-contain logo-float" />
          <p className="text-[13px] text-[rgba(232,234,230,0.72)]">Enter your dealership access code</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type="password"
              placeholder="Access code"
              autoFocus
              disabled={busy}
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#06080D] border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#4FE3DC] transition-colors"
            />
            <Lock className="absolute right-3 top-3.5 w-4 h-4 text-[rgba(232,234,230,0.72)]" />
          </div>
          <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#4FE3DC]"
            />
            <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Keep me signed in on this device</span>
          </label>
          {error && <p className="text-xs text-[#FF6B6B] mb-4">{error}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-[#4FE3DC] hover:bg-[#7FF0EA] disabled:opacity-60 on-fill font-bold text-sm">
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </form>

        <button
          type="button"
          disabled={demoBusy}
          onClick={async () => {
            setDemoBusy(true); setError('');
            try { await enterDemo(); onLogin(); }
            catch (err: any) { setError(err?.message || 'Demo is unavailable right now.'); }
            finally { setDemoBusy(false); }
          }}
          className="mt-3 w-full py-2.5 rounded-xl border border-[rgba(232,234,230,0.14)] text-[13px] text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] hover:border-[#4FE3DC]/40 transition-colors disabled:opacity-60"
        >
          {demoBusy ? 'Opening demo…' : 'Explore the demo — no login needed'}
        </button>

        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
          <a href={TRUE_CARS_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] font-mono tracking-normal text-[#67E8F9] hover:underline inline-flex items-center gap-1">
            true-cars.co.za showroom <ExternalLink size={10} />
          </a>
          <a href={TRUESAAS_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] font-mono tracking-normal text-[#67e8f9] hover:underline">
            TruSaas platform
          </a>
        </div>
      </div>
    </div>
  );
}
