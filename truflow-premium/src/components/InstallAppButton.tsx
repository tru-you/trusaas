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
 * it is dismissible — once someone taps the X it is gone for the session, and
 * there was then no way to install at all. A dealer who dismissed it on Monday
 * had no route to the app on Tuesday.
 *
 * Every branch says something true. The failure worth avoiding is a button that
 * looks live on a browser which cannot install, does nothing when tapped, and
 * leaves the user assuming the app is broken.
 */
export default function InstallAppButton({
  appName = 'TruFlow',
  accent = 'var(--cyan-bright)',
}: {
  appName?: string;
  accent?: string;
}) {
  const [installed, setInstalled] = React.useState(isStandaloneDisplay());
  const [available, setAvailable] = React.useState(canPromptInstall());
  const [showIosSteps, setShowIosSteps] = React.useState(false);
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
      setShowIosSteps((v) => !v);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'accepted') setInstalled(true);
    // "dismissed" leaves the prompt consumed and unavailable, so say so rather
    // than leaving a button that now quietly does nothing.
    if (outcome === 'dismissed') setDismissedPrompt(true);
    if (outcome === 'unavailable') setShowIosSteps(true);
  };

  if (installed) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[rgba(232,234,230,0.72)]">
        <Check size={14} style={{ color: accent }} />
        {appName} is installed on this device.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleClick}
          className="btn btn-primary text-[13px] font-bold inline-flex items-center gap-2"
        >
          <Download size={14} />
          {available ? `Install ${appName}` : 'How to install'}
        </button>
        <span className="text-[13px] text-[rgba(232,234,230,0.72)]">
          Runs full-screen with no browser bar, and opens from the home screen.
        </span>
      </div>

      {dismissedPrompt && (
        <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
          Install was cancelled. Your browser only offers the prompt once per visit — reload the page
          to get it back, or use your browser menu → <b className="text-[color:var(--white)]">Install app</b>.
        </p>
      )}

      {showIosSteps && (
        <div className="rounded-xl border border-white/10 bg-[color:var(--ink-2)] p-4">
          <div className="flex items-center gap-2 text-[13px] font-bold text-[color:var(--white)] mb-2">
            <Smartphone size={14} style={{ color: accent }} />
            {ios ? 'On iPhone or iPad' : 'From your browser menu'}
          </div>
          {ios ? (
            <ol className="text-[13px] text-[rgba(232,234,230,0.72)] space-y-1 list-decimal list-inside">
              <li>
                Tap <Share size={11} className="inline" style={{ color: accent }} /> <b>Share</b> in the
                Safari toolbar
              </li>
              <li>
                Scroll down and tap <b>Add to Home Screen</b>
              </li>
              <li>
                Tap <b>Add</b>, then open {appName} from the home screen
              </li>
            </ol>
          ) : (
            <ol className="text-[13px] text-[rgba(232,234,230,0.72)] space-y-1 list-decimal list-inside">
              <li>
                Open your browser menu (<b>⋮</b> or <b>⋯</b>)
              </li>
              <li>
                Choose <b>Install app</b>, <b>Add to Home screen</b>, or <b>Create shortcut</b>
              </li>
            </ol>
          )}
          <p className="text-[13px] text-[rgba(232,234,230,0.55)] mt-3 leading-relaxed">
            {ios
              ? 'Safari never offers a one-tap install, so this is the only way on iOS — Chrome and Edge on iPhone cannot install it at all.'
              : 'Installing needs an HTTPS page, and some browsers only offer it after a few visits. Firefox on desktop does not support installing at all.'}
          </p>
        </div>
      )}
    </div>
  );
}
