import React from 'react';
import { LogIn, Lock, AlertCircle, Loader2, ShieldOff, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import propInspectLogo from '../assets/images/propinspect-logo.svg';

/**
 * One field: the access code issued for this instance.
 *
 * There used to be an email/password pair plus a "Start on this PC" button that
 * signed in with no credentials at all — and the server accepted that from
 * anyone, so inspection reports were readable and writable by anyone who knew
 * the URL. Sign-up was offered too, though nobody may self-register into a
 * dealer's inspection data.
 *
 * ── The dead end this screen used to be ────────────────────────────────────
 * The code is checked by POST /api/auth/device, and the first thing that route
 * does is refuse everything with 503 when TRUPROPERTY_ACCESS_CODE is unset. On
 * an instance where nobody has set that variable — which is every fresh checkout
 * and any deploy that missed the env var — this screen showed a code field that
 * could not succeed no matter what was typed into it, and said only "no access
 * on this server".
 *
 * So the screen now asks GET /api/health first. It answers accessCodeConfigured
 * as a boolean (never the value) and exists precisely so this can be checked
 * from outside. When it comes back false the code field is replaced with an
 * explanation and the offline route the server is currently allowing anyway —
 * no bypass, because the API only honours the offline token while no code is
 * configured. Set the variable and both the notice and the offline button
 * disappear on their own.
 */

type ServerState = 'checking' | 'secured' | 'unconfigured' | 'unreachable';

export default function Login() {
  const { signInWithCode, enterDemoMode } = useAuth();
  const [code, setCode] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [server, setServer] = React.useState<ServerState>('checking');
  /* The code is typed on a phone, often on-site. Entering it blind is how
     you fail twice. */
  const [reveal, setReveal] = React.useState(false);
  const [capsOn, setCapsOn] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (alive) setServer(data?.accessCodeConfigured ? 'secured' : 'unconfigured');
      } catch {
        // Offline or the server is down. Keep the code field — a cached PWA
        // opening in a dead spot should still let someone try the code they
        // were given, rather than being told the instance is misconfigured.
        if (alive) setServer('unreachable');
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Say why rather than returning silently — a submit that does nothing at
    // all reads as a broken button, not as a validation message.
    if (!code.trim()) {
      setError('Enter the access code for this instance.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithCode(code.trim());
    } catch (err: any) {
      setError(err?.message || 'Could not sign in on this device.');
      // The server may have come up unconfigured since the health check.
      if (/no access code configured/i.test(err?.message || '')) setServer('unconfigured');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      /* Installed to the home screen this draws under the notch and the home
         indicator; gutters grow only by what the device reserves. */
      style={{
        paddingTop: 'calc(2.5rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="h-full w-full overflow-y-auto bg-[#F5F4F1] flex flex-col items-center justify-center px-6 relative"
    >
      <div className="absolute top-[-12%] right-[-18%] w-72 h-72 bg-[#0E9D98]/[0.04] blur-[110px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-12%] left-[-18%] w-72 h-72 bg-[#0E9D98]/[0.04] blur-[110px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm z-10 flex flex-col items-center">

        <div className="text-center mb-10">
          <img src={propInspectLogo} alt="PropInspect" className="h-20 w-full max-w-xs mx-auto object-contain" />
          <p className="mt-3 text-[12px] text-[rgba(10,20,32,0.50)] tracking-[0.08em]">
            Property inspection reports
          </p>
        </div>

        <div className="text-center mb-7">
          <h1 className="text-[20px] font-semibold text-[#0A1420] tracking-[-0.01em]">
            Inspector sign-in
          </h1>
          <p className="mt-1.5 text-[13px] text-[rgba(10,20,32,0.50)]">
            This device is registered to one agency.
          </p>
        </div>

        {server === 'unconfigured' ? (
          /* No code is set on this instance, so there is nothing to type. Say
             that plainly and offer the only route the server currently accepts,
             instead of a field that silently cannot work. */
          <div className="w-full space-y-4">
            <div className="rounded-2xl border border-[rgba(10,20,32,0.10)] bg-[rgba(10,20,32,0.04)] p-4">
              <div className="flex items-start gap-2.5">
                <ShieldOff size={16} className="text-[rgba(10,20,32,0.50)] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0A1420]">
                    No access code is set on this server
                  </p>
                  <p className="mt-1 text-[13px] text-[rgba(10,20,32,0.65)] leading-relaxed">
                    Until one is, sign-in codes cannot be checked and this instance
                    holds local data only.
                  </p>
                  <p className="mt-2 text-[12px] font-mono text-[rgba(10,20,32,0.50)] break-all">
                    TRUPROPERTY_ACCESS_CODE
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={enterDemoMode}
              className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl tl-btn-3d text-[16px] font-semibold tracking-normal"
            >
              <LogIn size={16} />
              Continue offline
            </button>

            <p className="text-[13px] text-[rgba(10,20,32,0.50)] text-center leading-relaxed">
              Inspections stay on this device and this server. Set the access code
              to sign in properly — this notice goes away on its own.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-2">
              <label htmlFor="access-code" className="block text-[12px] font-semibold text-[rgba(10,20,32,0.65)] ml-1">
                Inspector access code
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgba(10,20,32,0.32)] group-focus-within:text-[#0E9D98] transition-colors">
                  <Lock size={15} />
                </div>
                {/* 16px is not a style choice: below it, Safari zooms the whole
                    page in when the field takes focus and the layout jumps. */}
                {/* autoComplete was "one-time-code", which tells the browser to
                    expect an SMS OTP: it will not offer to save the value and
                    may autofill a message code over it. This is a per-dealership
                    code the device keeps, so it is a password to a manager. */}
                <input
                  id="access-code"
                  type={reveal ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                  autoComplete="current-password"
                  inputMode="text"
                  aria-invalid={!!error}
                  className="block w-full pl-11 pr-14 h-[52px] bg-[rgba(10,20,32,0.04)] border border-[rgba(10,20,32,0.08)] rounded-xl shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] focus:outline-none focus:border-[#0E9D98]/60 focus:bg-[rgba(10,20,32,0.06)] transition-all"
                  placeholder="Access code"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide code' : 'Show code'}
                  aria-pressed={reveal}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-lg text-[rgba(10,20,32,0.50)] hover:text-[#0A1420] transition-colors"
                >
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsOn && (
                <p className="text-[13px] text-[rgba(10,20,32,0.50)] ml-1">Caps Lock is on.</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[13px] font-medium text-red-600 leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || server === 'checking'}
              className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl tl-btn-3d text-[16px] font-semibold tracking-normal disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Checking code…
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Use this device
                </>
              )}
            </button>
          </form>
        )}

        {server !== 'unconfigured' && (
          <p className="mt-6 text-[13px] text-[rgba(10,20,32,0.50)] text-center leading-relaxed">
            Access is issued per instance. Ask your manager for the code — inspectors
            cannot self-register.
          </p>
        )}

        <p className="mt-10 text-center text-[12px] text-[rgba(10,20,32,0.50)] leading-relaxed">
          <span className="text-[rgba(10,20,32,0.65)]">Prop Inspect</span>
          {' — by TruProperty · V 1.0'}
        </p>
      </div>
    </div>
  );
}
