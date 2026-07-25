import React from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import {
  BeforeInstallPromptEvent,
  isIosSafari,
  isStandaloneDisplay,
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
  appName = 'TruFlow',
  blurb = 'Install on this device for one-tap access — no browser bar, works offline for the app shell.',
  accent = 'var(--blue)',
  dismissKey = 'truflow_pwa_install_dismissed',
}: {
  appName?: string;
  blurb?: string;
  /** Product accent — TruFlow blue, TruLens cyan. Keeps each app on its own colour. */
  accent?: string;
  dismissKey?: string;
}) {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
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

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — offer the manual steps after a beat
    let t: number | undefined;
    if (isIosSafari()) t = window.setTimeout(() => setVisible(true), 1800);

    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBip);
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
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
        setInstalled(true);
      }
      setDeferred(null);
      return;
    }
    if (iosHelp) {
      dismiss();
      return;
    }
    setIosHelp(true);
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-4 md:w-[360px] z-[300]">
      <div
        className="rounded-[18px] border bg-[color:var(--ink-2)] px-4 py-3 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
        style={{ borderColor: `${accent}40` }}
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 p-2 rounded-xl shrink-0"
            style={{ background: `${accent}1A`, border: `1px solid ${accent}40`, color: accent }}
          >
            <Smartphone size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[color:var(--white)]">Install {appName}</p>
            <p className="text-[13px] text-[rgba(232,234,230,0.55)] leading-snug mt-0.5">
              {isIosSafari()
                ? 'Add to your Home Screen to run it full-screen, without the browser bar.'
                : blurb}
            </p>

            {iosHelp && (
              <ol className="mt-2 text-[13px] text-[rgba(232,234,230,0.72)] space-y-1 list-decimal list-inside">
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

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-[13px] font-semibold text-[color:var(--ink)] transition-opacity hover:opacity-90"
                style={{ background: accent }}
              >
                <Download size={12} />
                {deferred ? 'Install' : isIosSafari() ? (iosHelp ? 'Got it' : 'How to install') : 'Install'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="px-3 py-2 rounded-full border border-white/10 text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)] transition-colors"
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
