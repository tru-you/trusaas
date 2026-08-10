import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Sparkles, ShieldCheck, Zap, BarChart3, KeyRound, Loader2 } from 'lucide-react';
import tsMark from '../../assets/brand/ts-mark.png';
import wordmark from '../../assets/brand/trusaas-wordmark.png';
import { fetchHealth, loginWithAccessCode, hasDeviceToken } from '../../lib/api';

interface LoginScreenProps {
  onLogin: () => void;
}

type AuthMode = 'checking' | 'demo' | 'code';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decide which login this server needs: an access code (production on
  // Render) or the plain demo log-in (no TRUCRM_ACCESS_CODE configured).
  useEffect(() => {
    let cancelled = false;
    if (hasDeviceToken()) {
      onLogin();
      return;
    }
    fetchHealth().then((health) => {
      if (cancelled) return;
      setMode(health.accessCodeConfigured ? 'code' : 'demo');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter any email and password to continue (demo mode).');
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 700);
  };

  const submitCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter your access code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginWithAccessCode(trimmed);
      onLogin();
    } catch (err: any) {
      setError(err?.message || 'That code is not recognised.');
    } finally {
      setLoading(false);
    }
  };

  const demo = () => {
    setEmail('demo@trudealer.co.za');
    setPassword('demo123');
    submit();
  };

  const inputClass =
    'w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[rgba(10,20,32,0.12)] bg-white text-[#1A2332] placeholder-[rgba(10,20,32,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(14,157,152,0.25)] focus:border-[rgba(14,157,152,0.40)] transition-all';

  return (
    <div className="min-h-screen flex bg-[#F5F1E8]">
      {/* Left brand panel — desktop only */}
      <div className="hidden lg:flex w-1/2 bg-[#0B1220] relative overflow-hidden flex-col justify-between p-12 select-none">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(50% 40% at 80% 0%, rgba(7,136,155,0.28), transparent 65%), radial-gradient(40% 30% at 10% 100%, rgba(7,136,155,0.12), transparent 60%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden ring-1 ring-white/10">
            <img src={tsMark} alt="TruSaaS" className="w-full h-full object-cover" />
          </div>
          <img src={wordmark} alt="TruSaaS" style={{ height: '2.2rem', width: 'auto' }} />
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold text-white tracking-tight leading-tight">
            One workspace for your
            <br />
            <span className="text-[#3ECFC8]">dealership operations.</span>
          </h1>
          <p className="mt-4 text-[15px] text-white/55 max-w-md leading-relaxed">
            Leads, deals, quotes, invoices, SLAs, documents and market intel —
            in one place, on any device.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: Zap, label: 'Quotes, invoices & SLAs with e-signatures' },
              { icon: BarChart3, label: 'Pipeline, run-rate and ledger at a glance' },
              { icon: ShieldCheck, label: 'One workspace, synced across your devices' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm text-white/70">
                <div className="w-8 h-8 rounded-lg bg-[rgba(7,136,155,0.15)] border border-[rgba(7,136,155,0.30)] flex items-center justify-center">
                  <f.icon className="w-4 h-4 text-[#3ECFC8]" />
                </div>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/40 font-mono uppercase tracking-[0.14em]">
          TruDealer · Future Automotive
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-[rgba(10,20,32,0.10)]">
              <img src={tsMark} alt="TruSaaS" className="w-full h-full object-cover" />
            </div>
            <img src={wordmark} alt="TruSaaS" style={{ height: '2rem', width: 'auto' }} />
          </div>

          <div className="bg-white rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-[0_18px_50px_-20px_rgba(18,32,43,0.18)] p-7">
            {mode === 'checking' ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#0E9D98] animate-spin" />
                <p className="text-sm text-[#6B7685]">Connecting to your workspace…</p>
              </div>
            ) : mode === 'code' ? (
              <>
                <h2 className="text-xl font-bold text-[#1A2332] tracking-tight">Sign in</h2>
                <p className="text-sm text-[#6B7685] mt-1 mb-6">
                  Enter your workspace access code.
                </p>

                <form onSubmit={submitCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7685] mb-1.5">Access code</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#0E9D98]" />
                      <input
                        type="password"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Your access code"
                        className={inputClass}
                        autoFocus
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="px-3 py-2 rounded-lg bg-[rgba(184,106,106,0.08)] border border-[rgba(184,106,106,0.25)] text-xs text-[#B86A6A] font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="w-full py-2.5 bg-[#0E9D98] hover:bg-[#0B8A85] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_16px_-6px_rgba(14,157,152,0.5)] flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-[#1A2332] tracking-tight">Sign in</h2>
                <p className="text-sm text-[#6B7685] mt-1 mb-6">
                  Demo workspace — any credentials work.
                </p>

                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7685] mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#0E9D98]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@dealership.co.za"
                        className={inputClass}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B7685] mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#0E9D98]" />
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8172] hover:text-[#1A2332] transition-colors"
                        aria-label="Toggle password visibility"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="px-3 py-2 rounded-lg bg-[rgba(184,106,106,0.08)] border border-[rgba(184,106,106,0.25)] text-xs text-[#B86A6A] font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-[#0E9D98] hover:bg-[#0B8A85] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_16px_-6px_rgba(14,157,152,0.5)] flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-[rgba(10,20,32,0.08)]" />
                  <span className="text-[10px] uppercase tracking-wider text-[#8A8172] font-mono">or</span>
                  <div className="flex-1 h-px bg-[rgba(10,20,32,0.08)]" />
                </div>

                <button
                  onClick={demo}
                  disabled={loading}
                  className="w-full py-2.5 bg-[rgba(14,157,152,0.08)] hover:bg-[rgba(14,157,152,0.12)] text-[#0E9D98] border border-[rgba(14,157,152,0.25)] rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Continue as demo user
                </button>
              </>
            )}

            <p className="mt-6 text-center text-[11px] text-[#8A8172] leading-relaxed">
              {mode === 'code'
                ? 'Your data is saved on the server and synced to every device you sign in from.'
                : 'Demo workspace — data lives only in this browser.'}
            </p>
          </div>

          <p className="text-center text-[11px] text-[#8A8172] mt-5 font-mono uppercase tracking-[0.12em]">
            TruDealer · Future Automotive
          </p>
        </div>
      </div>
    </div>
  );
};