import React from 'react';
import { LogIn, Lock, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * One field: the access code issued for this instance.
 *
 * There used to be an email/password pair plus a "Start on this PC" button that
 * signed in with no credentials at all — and the server accepted that from
 * anyone, so inspection reports were readable and writable by anyone who knew
 * the URL. Sign-up was offered too, though nobody may self-register into a
 * dealer's inspection data.
 */
export default function Login() {
  const { signInWithCode } = useAuth();
  const [code, setCode] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithCode(code.trim());
    } catch (err: any) {
      setError(err?.message || 'Could not sign in on this device.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background Glow effects */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div
        className="w-full max-w-sm z-10 flex flex-col items-center"
      >
        {/* TruInspect wordmark */}
        <div className="mb-12 relative text-center">
          <div className="font-display font-semibold text-4xl tracking-tight">
            <span className="text-neutral-200">Tru</span><span className="text-cyan-400">Inspect</span>
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap">
            <span className="text-[13px] font-semibold text-cyan-400  tracking-[0.3em] font-sans">Vehicle Inspection Reports</span>
            <div className="w-1 h-1 rounded-full bg-indigo-500" />
          </div>
        </div>

        <div className="text-center space-y-1 mb-8">
          <h1 className="text-xl font-semibold text-[#E8EAE6] tracking-tight ">
            Inspector Login
          </h1>
          <p className="text-neutral-500 text-[13px] font-medium  tracking-widest">
            Securing your lot data
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] text-neutral-500  font-bold tracking-widest ml-1">Inspector access code</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-600 group-focus-within:text-indigo-400 transition-colors">
                <Lock size={14} />
              </div>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                className="block w-full pl-10 pr-3 py-3 bg-neutral-900/80 border border-neutral-800 rounded-xl text-[13px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="Access code"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={12} className="text-red-400 shrink-0" />
              <p className="text-[13px] font-bold text-red-400  tracking-wide">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] font-semibold rounded-xl text-[13px]  tracking-widest transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden hover:scale-[1.01] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span>Authorizing...</span>
              </div>
            ) : (
              <>
                <LogIn size={14} />
                <span>Use this device</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-[13px] text-neutral-500 text-center leading-relaxed max-w-xs">
          Access is issued per instance. Ask your manager for the code, or contact TruSaaS to set your
          team up — inspectors cannot self-register.
        </p>

        {/* Footer Info — ecosystem links */}
        <div className="mt-12 flex flex-col items-center space-y-4">
          <div className="flex items-center gap-3">
            <a href="https://tru-saas.com" target="_blank" rel="noopener noreferrer" className="flex flex-col items-end hover:opacity-90">
              <span className="text-[13px] text-neutral-600  tracking-tighter">Powered By</span>
              <span className="text-[13px] font-bold text-cyan-300 underline underline-offset-2">TruSaaS</span>
            </a>
            <div className="w-[1px] h-6 bg-neutral-800" />
            <div className="flex flex-col items-start">
              <span className="text-[13px] text-neutral-600  tracking-tighter">Reports</span>
              <span className="text-[13px] font-bold text-cyan-400 flex items-center gap-1">
                Inspector-signed <Check size={10} />
              </span>
            </div>
          </div>

          
          <p className="text-[13px] text-neutral-700 max-w-[200px] text-center leading-relaxed">
            By signing in, you agree to the Inspection & Data Terms of Service.
          </p>
          <div className="pt-4 flex flex-col items-center">
            <span className="text-[13px] text-neutral-800  tracking-[0.2em]">TruInspect v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
