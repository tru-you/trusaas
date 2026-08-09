/**
 * Closable "install this app" prompt for the TrueState property apps.
 *
 * Same behaviour as the React banner in the capture apps: Android and
 * Chrome fire beforeinstallprompt so we can install programmatically; iOS
 * Safari never does, so the only honest option there is to show the Add to
 * Home Screen steps. Dismissal sticks for the session, and nothing shows at
 * all once the app is already running standalone.
 *
 * Configure per app before loading:
 *   window.TRU_INSTALL = { appName: 'Flow Prop', accent: '#0E9D98', key: 'flowprop_pwa' }
 */
(function () {
  var cfg = window.TRU_INSTALL || {};
  var APP = cfg.appName || 'this app';
  var ACCENT = cfg.accent || '#0E9D98';
  var KEY = (cfg.key || 'tru_pwa') + '_install_dismissed';

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf('android-app://') === 0
    );
  }
  function isIosSafari() {
    var ua = navigator.userAgent;
    var iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return iOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  }
  function dismissed() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function remember() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }

  if (isStandalone() || dismissed()) return;

  var deferred = null;
  var iosHelp = false;
  var el = null;

  function render() {
    if (el) el.remove();
    el = document.createElement('div');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Install ' + APP);
    el.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
      'font-family:Inter,system-ui,-apple-system,sans-serif;';
    var steps = iosHelp
      ? '<ol style="margin:8px 0 0;padding-left:18px;color:rgba(10,20,32,0.55);font-size:12px;line-height:1.7">' +
        '<li>Tap <b>Share</b></li><li>Scroll and tap <b>Add to Home Screen</b></li>' +
        '<li>Tap <b>Add</b>, then open ' + APP + ' from your home screen</li></ol>'
      : '';
    var label = deferred ? 'Install' : isIosSafari() ? (iosHelp ? 'Got it' : 'How to install') : 'Install';

    el.innerHTML =
      '<div style="max-width:380px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(10,20,32,0.10);' +
      'border-radius:18px;padding:14px;box-shadow:0 24px 60px -30px rgba(10,20,32,0.15)">' +
        '<div style="font-size:13px;font-weight:600;color:#0A1420">Install ' + APP + '</div>' +
        '<div style="font-size:12px;color:rgba(10,20,32,0.55);margin-top:2px;line-height:1.45">' +
          (isIosSafari()
            ? 'Add to your Home Screen to run it full-screen, without the browser bar.'
            : 'Install on this device for one-tap access — no browser bar.') +
        '</div>' + steps +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
          '<button id="tru-install-go" style="flex:1;border:0;border-radius:999px;padding:9px 12px;' +
          'background:' + ACCENT + ';color:#FFFFFF;font-size:12px;font-weight:600;cursor:pointer">' + label + '</button>' +
          '<button id="tru-install-x" aria-label="Dismiss" style="border:1px solid rgba(10,20,32,0.10);' +
          'background:transparent;border-radius:999px;padding:9px 14px;color:rgba(10,20,32,0.55);' +
          'font-size:12px;cursor:pointer">✕</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);

    el.querySelector('#tru-install-x').addEventListener('click', function () {
      remember();
      el.remove();
      el = null;
    });
    el.querySelector('#tru-install-go').addEventListener('click', function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function (c) {
          if (c.outcome === 'accepted' && el) { el.remove(); el = null; }
          deferred = null;
        });
        return;
      }
      if (iosHelp) { remember(); el.remove(); el = null; return; }
      iosHelp = true;
      render();
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    render();
  });
  window.addEventListener('appinstalled', function () {
    if (el) { el.remove(); el = null; }
  });

  // iOS gets the manual route after a short delay
  if (isIosSafari()) setTimeout(render, 1800);
})();
