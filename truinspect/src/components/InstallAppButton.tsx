import React from 'react';
import { Check, Download, Share, Smartphone } from 'lucide-react';
import {
  canPromptInstall,
  isIosSafari,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstallState,
} from '../lib/pwa';

/**
 * "Install this app", as a permanent control rather than a banner.
 *
 * The banner only appears when the browser volunteers beforeinstallprompt, and
 * it is dismissible — once closed it is gone for the session, leaving no route
 * to install at all. An inspector who dismissed it on Monday had no way back on
 * Tuesday.
 *
 * Every branch says something true. The failure worth avoiding is a button that
 * looks live on a browser which cannot install, does nothing when tapped, and
 * leaves the inspector assuming the app is broken.
 */
export default function InstallAppButton({ appName = 'TruInspect' }: { appName?: string }) {
  const [installed, setInstalled] = React.useState(isStandaloneDisplay());
  const [available, setAvailable] = React.useState(canPromptInstall());
  const [showSteps, setShowSteps] = React.useState(false);
  const [dismissedPrompt, setDismissedPrompt] = React.useState(false);

  React.useEffect(() => {
    const unsub = subscribeInstallState(() => {
      setAvailable(canPromptInstall());
      setInstalled(isStandaloneDisplay());
    });
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      unsub();
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ios = isIosSafari();

  const handleClick = async () => {
    if (ios || !available) {
      setShowSteps((v) => !v);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'accepted') setInstalled(true);
    if (outcome === 'dismissed') setDismissedPrompt(true);
    if (outcome === 'unavailable') setShowSteps(true);
  };

  if (installed) {
    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-1">
        <div className="text-[13px] tracking-normal text-indigo-300/80 font-bold">App</div>
        <p className="text-[13px] text-neutral-300 flex items-center gap-2">
          <Check size={14} className="text-indigo-400 shrink-0" />
          {appName} is installed on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
      <div className="text-[13px] tracking-normal text-indigo-300/80 font-bold">App</div>
      <p className="text-[13px] text-neutral-400 leading-relaxed">
        Install {appName} on this phone to run it full-screen, with no browser bar.
      </p>

      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tracking-normal text-indigo-100 bg-indigo-500/20 border border-indigo-500/40 hover:bg-indigo-500/30 transition-all"
      >
        <Download size={14} />
        {available ? `Install ${appName}` : 'How to install'}
      </button>

      {dismissedPrompt && (
        <p className="text-[13px] text-neutral-400 leading-relaxed">
          Install was cancelled. The browser only offers that prompt once per visit — reload to get it
          back, or use the browser menu.
        </p>
      )}

      {showSteps && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="flex items-center gap-2 text-[13px] font-bold text-neutral-200 mb-2">
            <Smartphone size={13} className="text-indigo-400" />
            {ios ? 'On iPhone or iPad' : 'From your browser menu'}
          </div>
          {ios ? (
            <ol className="text-[13px] text-neutral-400 space-y-1 list-decimal list-inside">
              <li>
                Tap <Share size={11} className="inline text-indigo-400" /> <b>Share</b> in Safari
              </li>
              <li>
                Scroll down and tap <b>Add to Home Screen</b>
              </li>
              <li>
                Tap <b>Add</b>, then open {appName} from the home screen
              </li>
            </ol>
          ) : (
            <ol className="text-[13px] text-neutral-400 space-y-1 list-decimal list-inside">
              <li>
                Open the browser menu (<b>⋮</b>)
              </li>
              <li>
                Tap <b>Install app</b> or <b>Add to Home screen</b>
              </li>
            </ol>
          )}
          <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed">
            {ios
              ? 'Safari never offers a one-tap install, so this is the only way on iOS — Chrome and Edge on iPhone cannot install it at all.'
              : 'Installing needs an HTTPS page, and some browsers only offer it after a few visits.'}
          </p>
        </div>
      )}
    </div>
  );
}
