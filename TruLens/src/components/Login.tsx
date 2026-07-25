import React from 'react';
import { Lock, Sparkles, AlertCircle, Loader2, Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import trulensLogo from '../assets/images/trulens-wordmark.png';

export default function Login() {
  const { enterDemoMode, signInWithCode } = useAuth();
  const [deviceCode, setDeviceCode] = React.useState('');
  const [codeBusy, setCodeBusy] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);
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
            className="w-48 object-contain mx-auto [filter:brightness(2.1)_contrast(0.95)_saturate(1.05)]"
          />
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap">
            <span className="text-[13px] font-semibold text-indigo-400  tracking-[0.3em] font-sans">Vision for Growth</span>
            <div className="w-1 h-1 rounded-full bg-indigo-500" />
          </div>
        </div>

        <div className="text-center space-y-1 mb-8">
          <h1 className="text-xl font-semibold text-[#E8EAE6] tracking-tight ">
            Inspector Login
          </h1>
          <p className="text-neutral-400 text-[13px] font-medium  tracking-widest">
            Securing your lot data
          </p>
        </div>

        {/* The Firebase email/password form lived here. It could never work in
            production: TruLens runs LOCAL_MODE=1 with no Firebase credentials, so
            the server never starts the verifier — a dealer signed in on the phone
            and then every request 401'd. It was also the most prominent thing on
            the screen. The access code below is the only real way in. */}

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
          {codeError && <p className="text-[13px] text-[#C07676]">{codeError}</p>}
          <button
            type="submit"
            disabled={codeBusy || !deviceCode.trim()}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#4FE3DC] disabled:opacity-50 text-[#06080D] font-semibold rounded-xl text-[13px] transition-all"
          >
            <Monitor size={14} />
            {codeBusy ? 'Checking…' : 'Use this device'}
          </button>
          <span className="text-[13px] text-neutral-500 text-center">
            Signs this phone in for 30 days · full photo → export → web flow
          </span>
        </form>

        {/* There is no self-signup. Access is a code issued per dealership —
            the old "New Inspector? Sign Up" toggle created a Firebase account
            that the server never honours, because it gates on the dealership
            code, so anyone following it got an account granting nothing. */}
        <p className="mt-6 max-w-[260px] text-center text-[13px] leading-relaxed text-neutral-400">
          Access is issued per dealership. Ask your dealer principal for the
          code, or contact TruSaaS to set your yard up.
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
              <span className="text-[13px] text-neutral-600  tracking-tighter">Secured By</span>
              <span className="text-[13px] font-bold text-indigo-400 flex items-center gap-1">
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
          
          <p className="text-[13px] text-neutral-700 max-w-[200px] text-center leading-relaxed">
            By initializing, you agree to the Automated Photography & AI Processing Terms of Service.
          </p>
          <div className="pt-4 flex flex-col items-center">
            <span className="text-[11px] text-neutral-800  tracking-[0.2em]">TruLens v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
