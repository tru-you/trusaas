import logo from "../assets/images/propinspect-logo.svg";
import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2, Monitor, Eye, EyeOff } from 'lucide-react';
import { login, enterDemo } from '../lib/session';

export default function LoginSplash({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Entering a code you cannot see, on a phone, standing on site, is
  // the single most common way to fail this screen twice in a row.
  const [reveal, setReveal] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  // ?demo=1 opens the sandbox immediately — that's what the "Try it" links on
  // tru-saas.com point at, so a visitor never meets a login wall first.
  React.useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('demo')) return;
    let cancelled = false;
    enterDemo()
      .then(() => { if (!cancelled) onLogin(); })
      .catch((err: any) => { if (!cancelled) setError(err?.message || 'Demo is unavailable right now.'); });
    return () => { cancelled = true; };
  }, [onLogin]);

  // The code is checked by the server, which hands back a session token.
  // Nothing here can authorise anything on its own.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // Say why, rather than greying the button out. A primary action that is
    // dead on arrival gives no reason and reads as a broken screen.
    if (!password.trim()) {
      setError('Enter the access code for this agency.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(password.trim(), true);
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
      style={{
        paddingTop: 'calc(2.5rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="h-full w-full overflow-y-auto bg-[#F3F0E7] flex flex-col items-center justify-center px-6 relative"
    >
      {/* Two soft pools of light rather than a flat field. Kept well under the
          type so nothing sits on a gradient edge. */}
      <div className="absolute top-[-12%] right-[-18%] w-72 h-72 bg-[#0B7C72]/[0.05] blur-[110px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-12%] left-[-18%] w-72 h-72 bg-[#0B7C72]/[0.05] blur-[110px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm z-10 flex flex-col items-center">

        <div className="text-center mb-10">
          <img
            src={logo}
            alt="PropInspect"
            className="w-44 max-w-full object-contain mx-auto"
          />
          <p className="mt-3 text-[12px] text-[rgba(20,20,31,0.55)] tracking-[0.08em]">
            Property inspections · reports
          </p>
        </div>

        <div className="text-center mb-7">
          <h1 className="text-[20px] font-semibold text-[#14141F] tracking-[-0.01em]">
            Sign in this phone
          </h1>
          <p className="mt-1.5 text-[13px] text-[rgba(20,20,31,0.55)]">
            Signs in for 30 days · inspect → report → export
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <label htmlFor="agency-code" className="block text-[12px] font-semibold text-[rgba(20,20,31,0.72)] ml-1">
              Agency access code
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgba(20,20,31,0.42)] group-focus-within:text-[#0B7C72] transition-colors">
                <Lock size={15} />
              </div>
              {/* 16px is not a style choice: below it, Safari zooms the whole
                  page in when the field takes focus and the layout jumps. */}
              {/* autoComplete is a password as far as a password manager is
                  concerned — this is a per-agency code the phone keeps. */}
              <input
                id="agency-code"
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                placeholder="Access code"
                autoComplete="current-password"
                aria-invalid={!!error}
                className="block w-full pl-11 pr-14 h-[52px] bg-[rgba(255,255,255,0.85)] border border-[rgba(20,20,31,0.10)] rounded-xl shadow-[inset_0_2px_4px_rgba(20,20,31,0.06)] text-[16px] text-[#14141F] placeholder-[rgba(20,20,31,0.32)] focus:outline-none focus:border-[#0B7C72]/60 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide code' : 'Show code'}
                aria-pressed={reveal}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-lg text-[rgba(20,20,31,0.55)] hover:text-[#14141F] transition-colors"
              >
                {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {capsOn && (
              <p className="text-[13px] text-[rgba(20,20,31,0.55)] ml-1">Caps Lock is on.</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-700 shrink-0 mt-0.5" />
              <p className="text-[13px] font-medium text-red-700 leading-snug">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl text-[16px] font-semibold tracking-normal disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Checking code…
              </>
            ) : (
              <>
                <Monitor size={16} />
                Use this device
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-[13px] text-[rgba(20,20,31,0.55)] text-center leading-relaxed">
          Access is issued per agency. Ask your property manager for the code,
          or contact TruProperty to set your site up — there is no self-signup.
        </p>

        <p className="mt-10 text-center text-[12px] text-[rgba(20,20,31,0.55)]">
          <a
            href="https://tru-property.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[rgba(20,20,31,0.72)] hover:text-[#0B7C72] transition-colors"
          >
            PropInspect
          </a>
          {' — by TruProperty · V 1.0'}
        </p>
      </div>
    </div>
  );
}
