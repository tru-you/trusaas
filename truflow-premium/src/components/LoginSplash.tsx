import logo from "../assets/truflow-logo.png";
import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { TRUESAAS_URL } from '../lib/ecosystem';
import { login, enterDemo } from '../lib/session';

export default function LoginSplash({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [demoBusy, setDemoBusy] = useState(false);

  // ?demo=1 opens the sandbox immediately — that's what the "Try it" links on
  // tru-saas.com point at, so a visitor never meets a login wall first.
  React.useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('demo')) return;
    let cancelled = false;
    setDemoBusy(true);
    enterDemo()
      .then(() => { if (!cancelled) onLogin(); })
      .catch((err: any) => { if (!cancelled) setError(err?.message || 'Demo is unavailable right now.'); })
      .finally(() => { if (!cancelled) setDemoBusy(false); });
    return () => { cancelled = true; };
  }, [onLogin]);

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
    <div className="flex items-center justify-center min-h-screen bg-[color:var(--ink)] text-[color:var(--white)] p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-80" />
      <div
        className="relative w-full max-w-sm p-8 rounded-2xl border border-[rgba(232,234,230,0.14)]"
        style={{
          background: 'var(--ink-2)',
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
              className="w-full bg-[color:var(--ink)] border border-white/20 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)] transition-colors"
            />
            <Lock className="absolute right-3 top-3.5 w-4 h-4 text-[rgba(232,234,230,0.72)]" />
          </div>
          <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 accent-[color:var(--cyan)]"
            />
            <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Keep me signed in on this device</span>
          </label>
          {error && <p className="text-[13px] text-[color:var(--muted)] mb-4">{error}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-bright)] disabled:opacity-60 on-fill font-bold text-[16px]">
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </form>

        {/* The demo button that used to sit here is gone. A dealer signing in on
            their own DMS should not be offered a way into someone else's sample
            data, and it read as though the product were a sandbox. The ?demo=1
            route above still works, so the "Try it" links on tru-saas.com take a
            prospect straight in — they just no longer land on a dealer's login
            screen as an option. */}
        {demoBusy && (
          <p className="mt-3 text-center text-[13px] text-[rgba(232,234,230,0.72)]">Opening demo…</p>
        )}

        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
          <a href={TRUESAAS_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] font-mono tracking-normal text-[color:var(--cyan-bright)] hover:underline">
            TruSaaS platform
          </a>
        </div>
      </div>
    </div>
  );
}
