import React from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import {
  BeforeInstallPromptEvent,
  isIosSafari,
  isStandaloneDisplay,
} from '../lib/pwa';

const DISMISS_KEY = 'proplens_pwa_install_dismissed';

/**
 * Android/Chrome: native beforeinstallprompt → Install.
 * iOS Safari: show "Add to Home Screen" steps (no programmatic install).
 */
export default function PwaInstallBanner() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [iosHelp, setIosHelp] = React.useState(false);
  const [installed, setInstalled] = React.useState(isStandaloneDisplay());

  React.useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }

    const dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
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

    // iOS never fires beforeinstallprompt — show soft tip after a short delay
    if (isIosSafari() && !dismissed) {
      const t = window.setTimeout(() => setVisible(true), 1800);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBip);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
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
    // iOS path — show steps, then dismiss on second tap
    if (iosHelp) {
      dismiss();
      return;
    }
    setIosHelp(true);
  };

  return (
    <div className="absolute bottom-3 left-2 right-2 z-[100] pointer-events-auto">
      <div className="rounded-2xl border border-[rgba(10,20,32,0.10)] bg-white/95 backdrop-blur-md shadow-2xl shadow-[rgba(10,20,32,0.08)] px-3 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-xl bg-[#0E9D98]/15 border border-[#0E9D98]/25 text-[#0E9D98] shrink-0">
            <Smartphone size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#0A1420] tracking-wide ">
              Install PropLens
            </p>
            <p className="text-[13px] text-[rgba(10,20,32,0.55)] leading-snug mt-0.5">
              {isIosSafari()
                ? 'Add to Home Screen for a full-screen property app (no browser chrome).'
                : 'Install on this phone for one-tap access on site — works offline for the app shell.'}
            </p>
            {iosHelp && (
              <ol className="mt-2 text-[13px] text-[#0A1420] space-y-1 list-decimal list-inside">
                <li className="flex items-start gap-1">
                  <span>
                    Tap <Share size={10} className="inline text-[#0E9D98]" /> <b>Share</b>
                  </span>
                </li>
                <li>
                  Scroll and tap <b>Add to Home Screen</b>
                </li>
                <li>
                  Tap <b>Add</b> — open PropLens from your home screen
                </li>
              </ol>
            )}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl tl-btn-3d bg-[#0E9D98] hover:bg-[#0E9D98]/90 text-white text-[13px] font-semibold tracking-normal"
              >
                <Download size={12} />
                {deferred ? 'Install app' : isIosSafari() ? (iosHelp ? 'Got it' : 'How to install') : 'Install'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)] text-[13px] font-bold"
                aria-label="Dismiss"
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
