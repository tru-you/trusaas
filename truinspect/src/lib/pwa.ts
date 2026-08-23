/** TruInspect PWA helpers — install state + service worker registration */

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const twa = document.referrer.startsWith('android-app://');
  return mq || ios || twa;
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chromeIos = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !chromeIos;
}

/**
 * Field-worker vs manager is decided by SIZE and POINTER, never by how the app
 * was opened. Owner rule: anything above tablet size shows the desktop manager,
 * whether it runs in a browser tab or as an installed PWA — installing must not
 * demote a 27-inch monitor to a phone. Tablets stay field-side via the pointer
 * check (touch-primary = field worker at any size), not via install state.
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
}

/** Desktop with a mouse = manager mode. Tablets (pointer: coarse) stay as field workers. */
export function isDesktopManager(): boolean {
  if (typeof window === 'undefined') return false;
  return !isMobileViewport() && window.matchMedia('(pointer: fine)').matches;
}

export async function registerTruInspectServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  // Dev on localhost is fine for testing install; still register so phone demos work over LAN HTTPS/tunnel
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Prompt reload when a new SW takes over
    // When a new build ships, apply it and reload once — otherwise an installed
    // app keeps serving the cached old shell (this is why a redeploy didn't show
    // on the phone). Guarded so it reloads exactly once, not in a loop.
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage('SKIP_WAITING');
        }
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    // Check for a new version each time the app is opened.
    reg.update().catch(() => undefined);
    return reg;
  } catch (err) {
    console.warn('[TruInspect PWA] Service worker registration failed', err);
    return null;
  }
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

/**
 * Shared install-prompt store.
 *
 * The browser fires beforeinstallprompt exactly once, and early — usually
 * before anything inside Settings has mounted. A component that only starts
 * listening when it renders therefore never sees it, and its install button
 * would sit permanently dead while the app was in fact installable. So the
 * event is captured here at module load and handed out to whoever asks.
 *
 * The event is also single-use: calling prompt() twice on the same one throws.
 * Keeping one copy means the banner and the Settings button cannot both claim
 * it and fight over who gets to install.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

function notifyInstallListeners() {
  installListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a bad subscriber must not stop the others */
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Suppress Chrome's own mini-infobar so the app decides where to ask.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallListeners();
  });
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function subscribeInstallState(fn: () => void): () => void {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

/** True when the browser has offered a real install prompt we can replay. */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Ask the browser to install. Returns what actually happened, so the caller can
 * tell "the user said no" apart from "this browser cannot install" — the two
 * need very different UI, and conflating them is how you end up with a button
 * that silently does nothing on iOS and Firefox.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const evt = deferredPrompt;
  // Consume it up front: the event cannot be replayed, so leaving it in place
  // would let a second click throw.
  deferredPrompt = null;
  notifyInstallListeners();
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'unavailable';
  }
}
