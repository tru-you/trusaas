import React from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import {
  canPromptInstall,
  isIosSafari,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstallState,
} from '../lib/pwa';

/**
 * Closable "install this app" prompt.
 *
 * Two paths, because the platforms differ: Android/Chrome fires
 * beforeinstallprompt and we can install programmatically; iOS Safari never
 * does, so the only honest option is to show the Add to Home Screen steps.
 *
 * Dismissal is remembered for the session, and the whole thing disappears once
 * the app is already running standalone — nobody should be told to install
 * something they've installed.
 */
export default function PwaInstallBanner({
  appName = 'PropInspect',
  blurb = 'Install on this device for one-tap access — no browser bar, works offline for the app shell.',
  accent = '#0B7C72',
  dismissKey = 'propinspect_pwa_install_dismissed',
}: {
  appName?: string;
  blurb?: string;
  /** Product accent — readable on the light card. */
  accent?: string;
  dismissKey?: string;
}) {
  /* The prompt event lives in lib/pwa, captured at module load. It is
     single-use, so the banner and the Settings install button have to draw on
     one copy — two independent listeners would each hold the same event and the
     second prompt() call would throw. */
  const [deferred, setDeferred] = React.useState(canPromptInstall());
  const [visible, setVisible] = React.useState(false);
  const [iosHelp, setIosHelp] = React.useState(false);
  const [installed, setInstalled] = React.useState(isStandaloneDisplay());

  React.useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(dismissKey) === '1';
    } catch {
      /* private browsing */
    }
    if (dismissed) return;

    // Already captured before this mounted — the common case, since the browser
    // fires it early.
    if (canPromptInstall()) setVisible(true);

    const unsub = subscribeInstallState(() => {
      const ready = canPromptInstall();
      setDeferred(ready);
      if (ready) setVisible(true);
    });
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — offer the manual steps after a beat
    let t: number | undefined;
    if (isIosSafari()) t = window.setTimeout(() => setVisible(true), 1800);

    return () => {
      if (t) window.clearTimeout(t);
      unsub();
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [dismissKey]);

  if (installed || !visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
    setIosHelp(false);
  };

  const handleInstall = async () => {
    if (deferred) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        setVisible(false);
        setInstalled(true);
      }
      setDeferred(false);
      return;
    }
    if (iosHelp) {
      dismiss();
      return;
    }
    setIosHelp(true);
  };

  return (
    <div className="absolute bottom-3 left-2 right-2 z-[100] pointer-events-auto">
      <div className="rounded-2xl border border-[rgba(20,20,31,0.10)] bg-white/95 backdrop-blur-md shadow-2xl shadow-[rgba(20,20,31,0.12)] px-3 py-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 p-2 rounded-xl shrink-0"
            style={{ background: `${accent}1A`, border: `1px solid ${accent}40`, color: accent }}
          >
            <Smartphone size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#14141F] tracking-wide">Install {appName}</p>
            <p className="text-[13px] text-[rgba(20,20,31,0.55)] leading-snug mt-0.5">
              {isIosSafari()
                ? 'Add to your Home Screen to run it full-screen, without the browser bar.'
                : blurb}
            </p>

            {iosHelp && (
              <ol className="mt-2 text-[13px] text-[#14141F] space-y-1 list-decimal list-inside">
                <li>
                  Tap <Share size={10} className="inline" style={{ color: accent }} /> <b>Share</b>
                </li>
                <li>
                  Scroll down and tap <b>Add to Home Screen</b>
                </li>
                <li>
                  Tap <b>Add</b> — then open {appName} from your home screen
                </li>
              </ol>
            )}

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: accent }}
              >
                <Download size={12} />
                {deferred ? 'Install app' : isIosSafari() ? (iosHelp ? 'Got it' : 'How to install') : 'Install'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="px-3 py-2 rounded-xl border border-[rgba(20,20,31,0.10)] text-[rgba(20,20,31,0.55)] hover:text-[#14141F] text-[13px] font-bold transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
