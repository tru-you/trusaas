import logo from "../assets/truflow-logo.png";
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TRUESAAS_URL } from '../lib/ecosystem';
import { login, enterDemo } from '../lib/session';

export default function LoginSplash({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [demoBusy, setDemoBusy] = useState(false);
  // Entering a code you cannot see, on a phone, standing on a forecourt, is
  // the single most common way to fail this screen twice in a row.
  const [reveal, setReveal] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

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
    // Say why, rather than greying the button out. A primary action that is
    // dead on arrival gives no reason and reads as a broken screen — and this
    // is the first thing a prospect sees in a demo.
    if (!password.trim()) {
      setError('Enter your access code.');
      return;
    }
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
    <div
      className="flex items-center justify-center min-h-screen bg-[color:var(--ink)] text-[color:var(--white)] p-4 relative overflow-hidden"
      style={{
        paddingTop: 'calc(1rem + var(--safe-t))',
        paddingBottom: 'calc(1rem + var(--safe-b))',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-80" />
      <div
        className="relative w-full max-w-sm p-8 rounded-2xl border border-[rgba(232,234,230,0.14)]"
        style={{
          background: 'var(--ink-2)',
          boxShadow: '0 1px 0 rgba(232,234,230,0.06) inset, 0 40px 90px -40px rgba(0,0,0,0.95)',
        }}
      >
        <div className="flex flex-col items-center justify-center mb-6 gap-2">
          <img src={logo} alt="TruFlow Premium" className="h-14 w-auto max-w-full object-contain logo-float" />
          {/* This screen is the first thing a prospect sees on a demo, and it
              said nothing about what the product is — a logo and a password
              box. One line naming the job it does costs nothing and stops the
              screen reading like an internal tool someone left exposed. */}
          <p className="text-[13px] text-[rgba(232,234,230,0.55)] text-center leading-snug">
            Dealer management — stock, leads, F&amp;I and reporting
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* The input had no label, no name and no id, so assistive tech
              announced it as an unlabelled secure field and password managers
              had nothing to key off. autoComplete was "off", which actively
              fights the manager staff use to store the code they type daily. */}
          <label htmlFor="access-code" className="block text-[13px] text-[rgba(232,234,230,0.72)] mb-1.5">
            Dealership access code
          </label>
          <div className="relative mb-3">
            <input
              id="access-code"
              name="access-code"
              type={reveal ? 'text' : 'password'}
              placeholder="Enter your code"
              autoFocus
              disabled={busy}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
              aria-invalid={!!error}
              aria-describedby={error ? 'access-code-error' : undefined}
              /* pr-12 keeps the typed code clear of the reveal button. 16px is
                 deliberate: iOS zooms the whole page in on focus below that. */
              className="w-full bg-[color:var(--ink)] border border-white/20 rounded-xl pl-4 pr-12 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)] transition-colors"
            />
            {/* Replaces a decorative padlock that occupied the one spot on this
                screen where a control is genuinely useful. */}
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide code' : 'Show code'}
              aria-pressed={reveal}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-lg text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)] transition-colors cursor-pointer"
            >
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {capsOn && (
            <p className="text-[13px] text-[color:var(--muted)] mb-3">Caps Lock is on.</p>
          )}

          {/* The row is the target, not the 14px box — a checkbox that small is
              a miss on a phone even before the label is considered. */}
          <label className="flex items-center gap-3 mb-4 cursor-pointer select-none min-h-11 -my-1">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-5 h-5 shrink-0 accent-[color:var(--cyan)]"
            />
            <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Keep me signed in on this device</span>
          </label>

          {/* A failed sign-in was rendered in the same muted grey as the hint
              text above it, so the screen simply cleared and looked idle. This
              is what brand.css keeps the one dusty red for. role="alert" so it
              is announced rather than silently swapped in. */}
          {error && (
            <p
              id="access-code-error"
              role="alert"
              className="text-[13px] text-[color:var(--danger)] mb-4"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-bright)] disabled:opacity-60 on-fill font-bold text-[16px] cursor-pointer transition-colors"
          >
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

        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col items-center gap-1.5">
          <a href={TRUESAAS_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] font-mono tracking-normal text-[color:var(--cyan-bright)] hover:underline">
            TruSaaS platform
          </a>
          <p className="text-[13px] text-[color:var(--faint)] text-center">
            Codes are issued by your dealer principal.
          </p>
        </div>
      </div>
    </div>
  );
}
