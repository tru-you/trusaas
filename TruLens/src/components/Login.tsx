import React from 'react';
import { Lock, AlertCircle, Loader2, Monitor, ShieldOff, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import trulensLogo from '../assets/images/trulens-wordmark.png';

/**
 * One field: the access code issued for this dealership.
 *
 * The Firebase email/password form that used to lead this screen could never
 * work in production — TruLens runs LOCAL_MODE=1 with no Firebase credentials,
 * so the server never starts the verifier and every request 401'd after a
 * apparently successful sign-in. There is no self-signup either: access is a
 * code issued per dealership.
 *
 * ── The dead end this screen used to be ────────────────────────────────────
 * The code is checked by POST /api/auth/device, and the first thing that route
 * does is refuse everything with 503 when neither TRULENS_ACCESS_CODE nor
 * TRULENS_DEALER_CODES is set. On an instance where nobody has set either —
 * every fresh checkout, and any deploy that missed the env var — this screen
 * showed a code field that could not succeed no matter what was typed into it,
 * and said only "no access on this server".
 *
 * So the screen now asks GET /api/health first. It answers accessCodeConfigured
 * and dealerCodesConfigured (booleans and a count, never values) and exists
 * precisely so this can be checked from outside. When both come back empty the
 * code field is replaced with an explanation and the offline route the server
 * is currently allowing anyway — no bypass, because the API only honours the
 * offline token while no code is configured. Set either variable and both the
 * notice and the offline button disappear on their own.
 */

type ServerState = 'checking' | 'secured' | 'unconfigured' | 'unreachable';

export default function Login() {
  const { signInWithCode, enterDemoMode } = useAuth();
  const [deviceCode, setDeviceCode] = React.useState('');
  const [codeBusy, setCodeBusy] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [server, setServer] = React.useState<ServerState>('checking');
  /* Same two additions TruFlow's sign-in got, for the same reason: this code is
     typed on a phone, outdoors, by someone standing next to a car. Entering it
     blind is how you fail the screen twice in a row. */
  const [reveal, setReveal] = React.useState(false);
  const [capsOn, setCapsOn] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        const configured = !!d?.accessCodeConfigured || Number(d?.dealerCodesConfigured) > 0;
        if (alive) setServer(configured ? 'secured' : 'unconfigured');
      } catch {
        // Offline or the server is down. Keep the code field — a cached PWA
        // opening in a dead spot should still let someone try the code they
        // were given, rather than being told the yard is misconfigured.
        if (alive) setServer('unreachable');
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeBusy) return;
    // Say why rather than greying the button out. A primary action that is dead
    // on arrival gives no reason and reads as a broken screen.
    if (!deviceCode.trim()) {
      setCodeError('Enter the access code for this dealership.');
      return;
    }
    setCodeBusy(true);
    setCodeError(null);
    try {
      await signInWithCode(deviceCode.trim());
    } catch (err: any) {
      setCodeError(err?.message || 'Could not sign in on this device.');
      // The server may have come up unconfigured since the health check.
      if (/no access code configured/i.test(err?.message || '')) setServer('unconfigured');
    } finally {
      setCodeBusy(false);
    }
  };

  return (
    <div
      /* Installed to the home screen this draws under the notch and the home
         indicator, so the gutters grow by whatever the device reserves and stay
         put everywhere else. */
      style={{
        paddingTop: 'calc(2.5rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="h-full w-full overflow-y-auto bg-[#06080D] flex flex-col items-center justify-center px-6 relative"
    >
      {/* Two soft pools of light rather than a flat black field. Kept well under
          the type so nothing sits on a gradient edge. */}
      <div className="absolute top-[-12%] right-[-18%] w-72 h-72 bg-[#4FE3DC]/[0.07] blur-[110px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-12%] left-[-18%] w-72 h-72 bg-[#4FE3DC]/[0.05] blur-[110px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm z-10 flex flex-col items-center">

        {/* The tagline under the mark used to be 13px with 0.3em of tracking,
            which is a lot of work to read at that size, and it was absolutely
            positioned into the gap below the logo where it could collide. */}
        <div className="text-center mb-10">
          <img
            src={trulensLogo}
            alt="TruLens"
            className="w-44 max-w-full object-contain mx-auto [filter:brightness(2.1)_contrast(0.95)_saturate(1.05)]"
          />
          <p className="mt-3 text-[12px] text-[rgba(232,234,230,0.55)] tracking-[0.08em]">
            Dealer photo studio
          </p>
        </div>

        <div className="text-center mb-7">
          <h1 className="text-[20px] font-semibold text-[#E8EAE6] tracking-[-0.01em]">
            Sign in this phone
          </h1>
          <p className="mt-1.5 text-[13px] text-[rgba(232,234,230,0.55)]">
            Signs in for 30 days · photo → export → web
          </p>
        </div>

        {server === 'unconfigured' ? (
          /* No code is set on this instance, so there is nothing to type. Say
             that plainly and offer the only route the server currently accepts,
             instead of a field that silently cannot work. */
          <div className="w-full space-y-4">
            {/* Was amber-on-amber. brand.css — shared by all three apps — retired
                the traffic-light palette: a warning de-emphasises to muted text
                rather than shouting in yellow, and the one dusty red is kept for
                destructive actions and genuine errors. This is a configuration
                notice, not an error, so it reads quiet. */}
            <div className="rounded-2xl border border-[rgba(232,234,230,0.14)] bg-[rgba(232,234,230,0.055)] p-4">
              <div className="flex items-start gap-2.5">
                <ShieldOff size={16} className="text-[rgba(232,234,230,0.55)] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#E8EAE6]">
                    No access code is set on this server
                  </p>
                  <p className="mt-1 text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                    Until one is, sign-in codes cannot be checked and this instance
                    holds local data only.
                  </p>
                  <p className="mt-2 text-[12px] font-mono text-[rgba(232,234,230,0.55)] break-all">
                    TRULENS_ACCESS_CODE
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={enterDemoMode}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl tl-btn-3d text-[15px] font-semibold tracking-normal"
            >
              <Monitor size={16} />
              Continue offline
            </button>

            <p className="text-[13px] text-[rgba(232,234,230,0.55)] text-center leading-relaxed">
              Captures stay on this device and this server. Set the access code to
              sign in properly — this notice goes away on its own.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-2">
              <label htmlFor="dealer-code" className="block text-[12px] font-semibold text-[rgba(232,234,230,0.72)] ml-1">
                Dealership access code
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgba(232,234,230,0.42)] group-focus-within:text-[#4FE3DC] transition-colors">
                  <Lock size={15} />
                </div>
                {/* 16px is not a style choice: below it, Safari zooms the whole
                    page in when the field takes focus and the layout jumps. */}
                {/* autoComplete was "one-time-code", which tells the browser to
                    expect an SMS OTP: it will not offer to save the value and
                    may try to autofill a message code over it. This is a
                    per-dealership code the phone keeps for 30 days, so it is a
                    password as far as a password manager is concerned. */}
                <input
                  id="dealer-code"
                  type={reveal ? 'text' : 'password'}
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                  placeholder="Access code"
                  autoComplete="current-password"
                  aria-invalid={!!codeError}
                  className="block w-full pl-11 pr-14 py-3.5 bg-white/[0.04] border border-white/10 rounded-xl text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] focus:outline-none focus:border-[#4FE3DC]/60 focus:bg-white/[0.06] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide code' : 'Show code'}
                  aria-pressed={reveal}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-lg text-[rgba(232,234,230,0.55)] hover:text-[#E8EAE6] transition-colors"
                >
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsOn && (
                <p className="text-[13px] text-[rgba(232,234,230,0.55)] ml-1">Caps Lock is on.</p>
              )}
            </div>

            {codeError && (
              <div className="bg-[#B86A6A]/12 border border-[#B86A6A]/35 p-3 rounded-xl flex items-start gap-2">
                <AlertCircle size={14} className="text-[#C07676] shrink-0 mt-0.5" />
                <p className="text-[13px] font-medium text-[#DFB6B6] leading-snug">{codeError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={codeBusy || server === 'checking'}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl tl-btn-3d text-[15px] font-semibold tracking-normal disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {codeBusy ? (
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
        )}

        {server !== 'unconfigured' && (
          <p className="mt-6 text-[13px] text-[rgba(232,234,230,0.55)] text-center leading-relaxed">
            Access is issued per dealership. Ask your dealer principal for the code,
            or contact TruSaaS to set your yard up — there is no self-signup.
          </p>
        )}

        {/* Footer. Was four separate 13px items plus a version line at 10%
            opacity — 1.2:1, i.e. not visible at all. One quiet line instead. */}
        <div className="mt-10 flex items-center gap-2 text-[12px] text-[rgba(232,234,230,0.55)]">
          <a
            href="https://tru-saas.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[rgba(232,234,230,0.72)] hover:text-[#4FE3DC] transition-colors"
          >
            TruSaaS
          </a>
          <span aria-hidden="true">·</span>
          <span>Guided capture</span>
          <span aria-hidden="true">·</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}
