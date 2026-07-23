import React from 'react';
import { LogIn, Lock, User, Sparkles, AlertCircle, Loader2, UserPlus, Monitor } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import trulensLogo from '../assets/images/trulens-wordmark.png';

export default function Login() {
  const { enterDemoMode, signInWithCode } = useAuth();
  const [deviceCode, setDeviceCode] = React.useState('');
  const [codeBusy, setCodeBusy] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'login' | 'signup'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Email already in use.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      }
      setError(message);
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
        {/* TruLens Logo */}
        <div className="mb-12 relative">
          <img 
            src={trulensLogo} 
            alt="TruLens Logo" 
            className="w-48 object-contain mx-auto"
          />
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[13px] font-semibold text-indigo-400  tracking-[0.3em] font-sans">Vision for Growth</span>
            <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-1 mb-8">
          <h1 className="text-xl font-semibold text-[#E8EAE6] tracking-tight ">
            {mode === 'login' ? 'Inspector Login' : 'Create Account'}
          </h1>
          <p className="text-neutral-500 text-[13px] font-medium  tracking-widest">
            {mode === 'login' ? 'Securing your lot data' : 'Join TruSaaS Network'}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] text-neutral-500  font-bold tracking-widest ml-1">Terminal ID (Email)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-600 group-focus-within:text-indigo-400 transition-colors">
                <User size={14} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 bg-neutral-900/80 border border-neutral-800 rounded-xl text-xs text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="Enter Email"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] text-neutral-500  font-bold tracking-widest ml-1">Access Token (Password)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-600 group-focus-within:text-indigo-400 transition-colors">
                <Lock size={14} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 bg-neutral-900/80 border border-neutral-800 rounded-xl text-xs text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="Enter Password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={12} className="text-red-400 shrink-0" />
              <p className="text-[12px] font-bold text-red-400  tracking-wide">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] font-semibold rounded-xl text-[13px]  tracking-widest transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden hover:scale-[1.01] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span>Authorizing...</span>
              </div>
            ) : (
              <>
                {mode === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
                <span>{mode === 'login' ? 'Initialize Session' : 'Create Account'}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
              </>
            )}
          </button>
        </form>

        {/* Sign this phone in with the dealership's access code. It replaced a
            "Start on this PC" button that sent the literal string
            'local-demo-token' — which the server accepted from anyone, so the
            captured stock and photos were readable by the whole internet. */}
        <form
          className="mt-4 w-full flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (codeBusy) return;
            setCodeBusy(true); setCodeError(null);
            try {
              await signInWithCode(deviceCode.trim());
            } catch (err: any) {
              setCodeError(err?.message || 'Could not sign in on this device.');
            } finally {
              setCodeBusy(false);
            }
          }}
        >
          <input
            type="password"
            value={deviceCode}
            onChange={(e) => setDeviceCode(e.target.value)}
            placeholder="Dealership access code"
            autoComplete="off"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-[13px] text-[#E8EAE6] outline-none focus:border-[#4FE3DC]"
          />
          {codeError && <p className="text-[12px] text-[#C07676]">{codeError}</p>}
          <button
            type="submit"
            disabled={codeBusy || !deviceCode.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#4FE3DC] disabled:opacity-50 text-[#06080D] font-semibold rounded-xl text-[13px] transition-all"
          >
            <Monitor size={14} />
            {codeBusy ? 'Checking…' : 'Use this device'}
          </button>
          <span className="text-[12px] text-neutral-500 text-center">
            Signs this phone in for 30 days · full photo → export → web flow
          </span>
        </form>

        <button 
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="mt-6 text-[12px] font-semibold text-neutral-500  tracking-[0.2em] hover:text-indigo-400 transition-colors"
        >
          {mode === 'login' ? "New Inspector? Sign Up" : "Back to Login"}
        </button>

        {/* Footer Info — ecosystem links */}
        <div className="mt-12 flex flex-col items-center space-y-4">
          <div className="flex items-center gap-3">
            <a href="https://true-cars.co.za/truesaas.html" target="_blank" rel="noopener noreferrer" className="flex flex-col items-end hover:opacity-90">
              <span className="text-[12px] text-neutral-600  tracking-tighter">Powered By</span>
              <span className="text-[12px] font-bold text-cyan-300 underline underline-offset-2">TruSaas</span>
            </a>
            <div className="w-[1px] h-6 bg-neutral-800" />
            <div className="flex flex-col items-start">
              <span className="text-[12px] text-neutral-600  tracking-tighter">Secured By</span>
              <span className="text-[12px] font-bold text-indigo-400 flex items-center gap-1">
                AI Audit Core <Sparkles size={10} />
              </span>
            </div>
          </div>

          <a
            href="https://true-cars.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-bold text-emerald-400/90  tracking-widest hover:text-emerald-300 underline underline-offset-2"
          >
            true-cars.co.za showroom
          </a>
          
          <p className="text-[12px] text-neutral-700 max-w-[200px] text-center leading-relaxed">
            By initializing, you agree to the Automated Photography & AI Processing Terms of Service.
          </p>
          <div className="pt-4 flex flex-col items-center">
            <span className="text-[7px] text-neutral-800  tracking-[0.2em]">TruLens v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
