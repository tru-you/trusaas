/**
 * TruChat UI core — premium glass + motion (web chat + WordPress widget).
 * Depends on: qualifier.js + options.config (or TRUECARS_TRUCHAT_CONFIG / RAY_TRUCHAT_CONFIG).
 */
(function (root) {
  "use strict";

  var DEFAULT_LS_KEY = "ray_truchat_leads_v1";
  var STYLE_ID = "truchat-core-css";

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      /* tokens */
      ".tc-root{--tc-red:#e30613;--tc-red-dark:#9b0410;--tc-gold:#ffffff;--tc-gold-dim:rgba(255,255,255,.08);",
      "--tc-bg:#08090f;--tc-panel:rgba(16,18,28,.92);--tc-border:rgba(255,255,255,.1);--tc-text:#f8fafc;",
      "--tc-muted:#94a3b8;--tc-green:#34d399;--tc-user:rgba(227,6,19,.2);",
      "--tc-ease:cubic-bezier(.22,1,.36,1);--tc-spring:cubic-bezier(.34,1.56,.64,1);",
      "font-family:Inter,system-ui,-apple-system,sans-serif;color:var(--tc-text);box-sizing:border-box;",
      "-webkit-font-smoothing:antialiased}",
      ".tc-root *,.tc-root *::before,.tc-root *::after{box-sizing:border-box}",
      "@media(prefers-reduced-motion:reduce){.tc-root *,.tc-root *::before,.tc-root *::after{",
      "animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}",

      /* keyframes */
      "@keyframes tcShellIn{from{opacity:0;transform:translateY(16px) scale(.96);filter:blur(4px)}",
      "to{opacity:1;transform:none;filter:none}}",
      "@keyframes tcMsgIn{0%{opacity:0;transform:translateY(14px) scale(.96)}100%{opacity:1;transform:none}}",
      "@keyframes tcMsgUser{0%{opacity:0;transform:translateX(16px) scale(.96)}100%{opacity:1;transform:none}}",
      "@keyframes tcFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
      "@keyframes tcDot{0%,80%,100%{opacity:.3;transform:translateY(0) scale(.9)}40%{opacity:1;transform:translateY(-4px) scale(1)}}",
      "@keyframes tcRing{0%{transform:scale(.85);opacity:.7}70%{transform:scale(1.15);opacity:0}100%{opacity:0}}",
      "@keyframes tcLive{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(52,211,153,.5)}50%{opacity:.7;box-shadow:0 0 0 4px rgba(52,211,153,0)}}",
      "@keyframes tcShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}",
      "@keyframes tcGlow{0%,100%{opacity:.35}50%{opacity:.65}}",
      "@keyframes tcWaIn{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}",
      "@keyframes tcBorderSpin{to{--tc-angle:360deg}}",
      "@keyframes tcCarShine{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}",

      /* shell — glass */
      ".tc-shell{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;",
      "background:linear-gradient(165deg,rgba(28,12,16,.95) 0%,rgba(12,14,22,.97) 42%,rgba(10,12,18,.98) 100%);",
      "border:1px solid rgba(255,255,255,.12);border-radius:20px;overflow:hidden;",
      "box-shadow:0 28px 80px -24px rgba(0,0,0,.75),0 0 0 1px rgba(227,6,19,.08),inset 0 1px 0 rgba(255,255,255,.08);",
      "backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);",
      "animation:tcShellIn .45s var(--tc-ease) both}",
      ".tc-shell::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;",
      "background:radial-gradient(ellipse 90% 50% at 50% -10%,rgba(227,6,19,.22),transparent 55%),",
      "radial-gradient(ellipse 40% 30% at 100% 100%,rgba(232,185,35,.06),transparent 50%)}",
      ".tc-shell > *{position:relative;z-index:1}",

      /* header */
      ".tc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;",
      "background:linear-gradient(180deg,rgba(255,255,255,.04),transparent);",
      "border-bottom:1px solid rgba(255,255,255,.08)}",
      ".tc-who{display:flex;align-items:center;gap:11px;min-width:0}",
      ".tc-avatar-wrap{position:relative;width:44px;height:44px;flex-shrink:0}",
      ".tc-avatar-wrap::after{content:'';position:absolute;inset:-3px;border-radius:16px;",
      "border:1.5px solid rgba(227,6,19,.45);animation:tcRing 2.4s ease-out infinite}",
      ".tc-avatar{width:44px;height:44px;border-radius:14px;",
      "background:linear-gradient(145deg,var(--tc-red),var(--tc-red-dark));",
      "display:grid;place-items:center;font-weight:800;font-size:15px;",
      "box-shadow:0 8px 20px -6px rgba(227,6,19,.65);overflow:hidden}",
      ".tc-avatar img{width:100%;height:100%;object-fit:cover;background:#0a0b10;padding:0}",
      ".tc-name{font-weight:700;font-size:14px;line-height:1.2;letter-spacing:-.01em;",
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".tc-name em{font-style:normal;background:linear-gradient(90deg,#fff 20%,#fecaca 100%);",
      "-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
      ".tc-status{font-size:11px;color:var(--tc-green);display:flex;align-items:center;margin-top:2px;font-weight:500}",
      ".tc-status .tc-live{display:inline-block;width:7px;height:7px;border-radius:50%;",
      "background:var(--tc-green);margin-right:7px;animation:tcLive 1.8s ease-in-out infinite}",
      ".tc-status.off{color:var(--tc-muted)}.tc-status.off .tc-live{background:var(--tc-muted);animation:none}",
      ".tc-head-acts{display:flex;gap:6px;flex-shrink:0}",
      ".tc-iconbtn{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);",
      "color:var(--tc-muted);border-radius:11px;width:36px;height:36px;cursor:pointer;font-size:15px;",
      "transition:transform .2s var(--tc-spring),color .15s,background .15s,border-color .15s}",
      ".tc-iconbtn:hover{color:#fff;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);transform:scale(1.08)}",
      ".tc-iconbtn:active{transform:scale(.94)}",

      /* history */
      ".tc-history{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:11px;padding:16px 14px;",
      "min-height:0;scroll-behavior:smooth}",
      ".tc-history::-webkit-scrollbar{width:5px}",
      ".tc-history::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:99px}",

      /* messages */
      ".tc-msg{max-width:92%;padding:12px 14px;border-radius:16px;font-size:13.5px;line-height:1.55;word-wrap:break-word}",
      ".tc-msg.bot{align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);",
      "border-bottom-left-radius:6px;box-shadow:0 4px 16px -8px rgba(0,0,0,.4);",
      "animation:tcMsgIn .42s var(--tc-ease) both}",
      ".tc-msg.user{align-self:flex-end;background:linear-gradient(145deg,rgba(227,6,19,.35),rgba(227,6,19,.18));",
      "border:1px solid rgba(227,6,19,.4);border-bottom-right-radius:6px;",
      "box-shadow:0 6px 18px -10px rgba(227,6,19,.5);animation:tcMsgUser .38s var(--tc-ease) both}",
      ".tc-msg strong{color:#fff;font-weight:700}",
      ".tc-msg a{color:#fca5a5}",

      /* chips */
      ".tc-sugs{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}",
      ".tc-sug{font-size:11.5px;font-weight:600;padding:8px 12px;border-radius:999px;cursor:pointer;",
      "background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);color:#fff;",
      "transition:transform .2s var(--tc-spring),filter .15s,background .15s,box-shadow .2s;",
      "animation:tcFadeUp .45s var(--tc-ease) both}",
      ".tc-sug:nth-child(1){animation-delay:.06s}.tc-sug:nth-child(2){animation-delay:.12s}",
      ".tc-sug:nth-child(3){animation-delay:.18s}.tc-sug:nth-child(4){animation-delay:.24s}",
      ".tc-sug:hover{filter:brightness(1.08);transform:translateY(-2px) scale(1.03);",
      "background:rgba(255,255,255,.14);box-shadow:0 8px 18px -10px rgba(255,255,255,.2)}",
      ".tc-sug:active{transform:scale(.96)}",

      /* stock cards */
      ".tc-cars{display:flex;flex-direction:column;gap:9px;align-self:flex-start;max-width:94%;width:100%}",
      ".tc-car{position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(0,0,0,.35));",
      "border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 12px 11px;",
      "animation:tcFadeUp .45s var(--tc-ease) both;transition:border-color .25s,transform .25s var(--tc-ease),box-shadow .25s}",
      ".tc-car:nth-child(1){animation-delay:.05s}.tc-car:nth-child(2){animation-delay:.12s}",
      ".tc-car:nth-child(3){animation-delay:.19s}.tc-car:nth-child(4){animation-delay:.26s}",
      ".tc-car:hover{border-color:rgba(227,6,19,.4);transform:translateY(-2px);",
      "box-shadow:0 12px 28px -14px rgba(227,6,19,.35)}",
      ".tc-car::after{content:'';position:absolute;top:0;left:0;width:40%;height:100%;",
      "background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);",
      "transform:translateX(-120%);pointer-events:none}",
      ".tc-car:hover::after{animation:tcCarShine .7s ease}",
      ".tc-car b{display:block;font-size:13px;margin-bottom:4px;letter-spacing:-.01em}",
      ".tc-car .m{font-size:11px;color:var(--tc-muted)}",
      ".tc-car .p{font-size:15px;font-weight:800;margin:8px 0 4px;color:#fff}",
      ".tc-car-acts{display:flex;gap:7px;margin-top:10px}",
      ".tc-car-acts button{flex:1;border:none;border-radius:10px;padding:9px;font-size:11px;font-weight:700;",
      "cursor:pointer;transition:transform .18s var(--tc-spring),filter .15s,box-shadow .2s}",
      ".tc-car-acts button:hover{transform:translateY(-2px);filter:brightness(1.08)}",
      ".tc-car-acts button:active{transform:scale(.97)}",
      ".tc-pri{background:linear-gradient(145deg,var(--tc-red),var(--tc-red-dark));color:#fff;",
      "box-shadow:0 6px 16px -8px rgba(227,6,19,.7)}",
      ".tc-sec{background:rgba(255,255,255,.06);color:var(--tc-text);border:1px solid rgba(255,255,255,.12)!important}",

      /* calendar */
      ".tc-cal{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);border-radius:14px;",
      "padding:13px;width:100%;max-width:94%;align-self:flex-start;animation:tcFadeUp .4s var(--tc-ease)}",
      ".tc-cal-t{font-size:12px;font-weight:700;color:#fff;margin-bottom:10px;letter-spacing:.04em;text-transform:uppercase}",
      ".tc-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}",
      ".tc-grid button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--tc-text);",
      "border-radius:10px;padding:9px;font-size:11px;cursor:pointer;font-weight:600;",
      "transition:border-color .15s,background .15s,transform .15s var(--tc-spring)}",
      ".tc-grid button:hover{transform:scale(1.03);border-color:rgba(255,255,255,.2)}",
      ".tc-grid button.sel{border-color:var(--tc-red);background:rgba(227,6,19,.22);box-shadow:0 0 0 1px rgba(227,6,19,.2)}",

      /* typing */
      ".tc-typing{font-size:11px;color:var(--tc-muted);min-height:20px;padding:0 16px 6px;display:flex;align-items:center;gap:8px}",
      ".tc-typing.is-on .tc-dots{display:inline-flex;gap:4px;padding:6px 10px;background:rgba(255,255,255,.05);",
      "border:1px solid rgba(255,255,255,.08);border-radius:12px}",
      ".tc-dots{display:none}",
      ".tc-dots i{width:6px;height:6px;border-radius:50%;background:linear-gradient(180deg,#fff,var(--tc-muted));",
      "display:block;animation:tcDot 1.15s ease-in-out infinite}",
      ".tc-dots i:nth-child(2){animation-delay:.15s}.tc-dots i:nth-child(3){animation-delay:.3s}",
      ".tc-typing-txt{opacity:.85}",

      /* composer */
      ".tc-composer{display:flex;gap:8px;padding:12px 14px 14px;border-top:1px solid rgba(255,255,255,.08);",
      "background:linear-gradient(180deg,transparent,rgba(0,0,0,.25))}",
      ".tc-composer input{flex:1;border-radius:14px;border:1px solid rgba(255,255,255,.1);",
      "background:rgba(0,0,0,.4);color:var(--tc-text);padding:13px 15px;font-size:14px;outline:none;",
      "transition:border-color .2s,box-shadow .25s,background .2s}",
      ".tc-composer input::placeholder{color:#64748b}",
      ".tc-composer input:focus{border-color:rgba(227,6,19,.55);background:rgba(0,0,0,.5);",
      "box-shadow:0 0 0 4px rgba(227,6,19,.14)}",
      ".tc-composer button{border:none;border-radius:14px;min-width:52px;",
      "background:linear-gradient(145deg,var(--tc-red),var(--tc-red-dark));color:#fff;padding:0 16px;",
      "font-weight:800;cursor:pointer;font-size:13px;letter-spacing:.02em;",
      "box-shadow:0 8px 20px -8px rgba(227,6,19,.75);",
      "transition:transform .2s var(--tc-spring),filter .15s,box-shadow .2s}",
      ".tc-composer button:hover{filter:brightness(1.1);transform:scale(1.04);box-shadow:0 10px 24px -8px rgba(227,6,19,.85)}",
      ".tc-composer button:active{transform:scale(.96)}",

      ".tc-foot{text-align:center;font-size:10px;color:#64748b;padding:4px 10px 12px;",
      "letter-spacing:.04em;text-transform:uppercase}",
      ".tc-foot span{color:rgba(227,6,19,.7);font-weight:700}",

      /* WA bar */
      ".tc-wa-bar{display:none;padding:10px 14px;gap:10px;align-items:center;",
      "background:linear-gradient(90deg,rgba(16,185,129,.18),rgba(37,211,102,.1));",
      "border-top:1px solid rgba(52,211,153,.3)}",
      ".tc-wa-bar.show{display:flex;animation:tcWaIn .45s var(--tc-ease)}",
      ".tc-wa-bar span{flex:1;font-size:11.5px;color:#bbf7d0;line-height:1.4;font-weight:500}",
      ".tc-wa-bar button{border:none;border-radius:12px;background:linear-gradient(145deg,#34d399,#059669);",
      "color:#042f1a;font-weight:800;font-size:12px;padding:10px 14px;cursor:pointer;white-space:nowrap;",
      "box-shadow:0 8px 20px -8px rgba(16,185,129,.6);transition:transform .2s var(--tc-spring),filter .15s}",
      ".tc-wa-bar button:hover{filter:brightness(1.08);transform:scale(1.05)}",

      /* intro banner */
      ".tc-intro{align-self:center;text-align:center;padding:8px 14px 4px;max-width:92%;",
      "animation:tcFadeUp .5s var(--tc-ease) both}",
      ".tc-intro .pill{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;",
      "letter-spacing:.08em;text-transform:uppercase;color:#fecaca;",
      "background:rgba(227,6,19,.12);border:1px solid rgba(227,6,19,.3);padding:5px 10px;border-radius:999px;margin-bottom:6px}",
    ].join("");
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function detectVehicleFromPage() {
    try {
      var path = (location.pathname || "").toLowerCase();
      if (path.indexOf("/vehicle/") === -1) return "";
      var h = document.querySelector("h1");
      if (h && h.textContent) return h.textContent.replace(/\s+/g, " ").trim().slice(0, 120);
      var t = document.title || "";
      return t.replace(/\s*[|\-–].*$/, "").trim().slice(0, 120);
    } catch (e) {
      return "";
    }
  }

  function loadLeads(lsKey) {
    try {
      return JSON.parse(localStorage.getItem(lsKey || DEFAULT_LS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveLeadEntry(entry, lsKey) {
    var key = lsKey || DEFAULT_LS_KEY;
    var list = loadLeads(key);
    if (
      list[0] &&
      list[0].source === "chat" &&
      ((entry.phone && list[0].phone === entry.phone) ||
        (!entry.phone && list[0].name === entry.name && Date.now() - new Date(list[0].at).getTime() < 2 * 3600 * 1000))
    ) {
      list[0] = entry;
    } else {
      list.unshift(entry);
    }
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  }

  function postWebhook(url, payload) {
    if (!url) return;
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        mode: "cors",
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function mount(container, options) {
    options = options || {};
    injectCss();
    var CFG = options.config || root.TRUECARS_TRUCHAT_CONFIG || root.RAY_TRUCHAT_CONFIG || {};
    var TQ = root.TruChatQualifier;
    if (!TQ) throw new Error("TruChatQualifier missing — load qualifier.js first");

    var LS_KEY = CFG.leadStorageKey || DEFAULT_LS_KEY;
    var pageVehicle = options.vehicleInterest || CFG.pageVehicle || detectVehicleFromPage();
    var bot = TQ.createQualifier({
      assistantName: CFG.assistantName,
      dealerName: CFG.dealerName,
      address: CFG.address,
      hoursText: CFG.hoursText,
      salesWhatsApp: CFG.personalWhatsApp || CFG.salesWhatsApp,
      catalog: (CFG.catalog || []).slice(),
      brandMap: CFG.brandMap || {},
    });

    if (pageVehicle) {
      bot.getSession().vehicleInterest = pageVehicle;
    }

    container.classList.add("tc-root");
    /* Per-tenant brand (YCG red / True-Cars blue) */
    if (CFG.brandRed || CFG.brandPrimary) {
      var primary = CFG.brandRed || CFG.brandPrimary;
      var dark = CFG.brandRedDark || CFG.brandPrimaryDark || primary;
      container.style.setProperty("--tc-red", primary);
      container.style.setProperty("--tc-red-dark", dark);
      container.style.setProperty("--tc-user", "color-mix(in srgb, " + primary + " 22%, transparent)");
    }
    container.innerHTML =
      '<div class="tc-shell">' +
      '<div class="tc-head">' +
      '<div class="tc-who">' +
      '<div class="tc-avatar-wrap"><div class="tc-avatar" id="tcAv">R</div></div>' +
      "<div><div class=\"tc-name\"><em>" +
      esc(CFG.assistantName || "Assistant") +
      "</em> · " +
      esc(CFG.dealerName || "Showroom") +
      '</div><div class="tc-status" id="tcStatus"><span class="tc-live" aria-hidden="true"></span>Online · showroom assistant</div></div>' +
      "</div>" +
      '<div class="tc-head-acts">' +
      (options.onClose
        ? '<button type="button" class="tc-iconbtn" id="tcClose" aria-label="Close" title="Close">✕</button>'
        : "") +
      "</div></div>" +
      '<div class="tc-history" id="tcHist" role="log" aria-live="polite" aria-relevant="additions" aria-atomic="false" aria-label="Conversation with ' +
      esc(CFG.assistantName || "the assistant") +
      '"></div>' +
      '<div class="tc-typing" id="tcTyping"><span class="tc-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="tc-typing-txt"></span></div>' +
      '<div class="tc-wa-bar" id="tcWaBar"><span>You\'re ready — continue with the yard on WhatsApp</span>' +
      '<button type="button" id="tcWaBtn">Open WhatsApp</button></div>' +
      '<div class="tc-composer"><input id="tcIn" type="text" placeholder="Ask about stock, finance, trade-in…" autocomplete="off" enterkeyhint="send" />' +
      '<button type="button" id="tcSend" aria-label="Send">Send</button></div>' +
      (options.showFoot !== false
        ? '<div class="tc-foot">' + esc(CFG.brandLine || CFG.dealerName || "") +
          (CFG.showCredit === false ? "" : ' · <span>TruChat</span> by TruSaaS') + "</div>"
        : "") +
      "</div>";

    if (CFG.logoUrl) {
      container.querySelector("#tcAv").innerHTML =
        '<img src="' + esc(CFG.logoUrl) + '" alt="" />';
    }

    var history = container.querySelector("#tcHist");
    var typingEl = container.querySelector("#tcTyping");
    var input = container.querySelector("#tcIn");
    var waBar = container.querySelector("#tcWaBar");
    var lastSavedSig = "";
    var destroyed = false;
    var handoffPrompted = false;

    /* Backend (LLM) mode — active when CFG.chatApi is set. Falls back to the
       local qualifier engine if the endpoint is unreachable. */
    var useBackend = !!CFG.chatApi;
    var history = []; // [{role, content}] sent to the backend each turn
    var remoteSession = {}; // server-maintained lead/session state
    var waMessage = ""; // server-built first-person WhatsApp message
    var waPhone = ""; // dealer WhatsApp number (digits)

    function isOpenHours() {
      var now = new Date();
      var day = now.getDay();
      var mins = now.getHours() * 60 + now.getMinutes();
      if (day >= 1 && day <= 5) return mins >= 450 && mins <= 1050;
      if (day === 6) return mins >= 450 && mins <= 780;
      return false;
    }

    function updateStatus() {
      var el = container.querySelector("#tcStatus");
      if (!el) return;
      if (isOpenHours()) {
        el.className = "tc-status";
        el.innerHTML = '<span class="tc-live" aria-hidden="true"></span>Online · showroom open';
      } else {
        el.className = "tc-status off";
        el.innerHTML = '<span class="tc-live" aria-hidden="true"></span>After hours · still online';
      }
    }

    function setTyping(on, label) {
      if (on) {
        typingEl.classList.add("is-on");
        var t = typingEl.querySelector(".tc-typing-txt");
        if (t) t.textContent = label || (CFG.assistantName || "Assistant") + " is typing";
      } else {
        typingEl.classList.remove("is-on");
        var t2 = typingEl.querySelector(".tc-typing-txt");
        if (t2) t2.textContent = "";
      }
    }

    function persistLead(force) {
      var s = bot.getSession();
      var hasSignal =
        force ||
        s.qualified ||
        (s.phone && s.phone.length > 5) ||
        (s.tradeInDetails && s.tradeInDetails !== "Awaiting input...") ||
        s.testDriveDate ||
        s.inspectionDate ||
        (s.vehicleInterest && s.vehicleInterest !== "Browsing");
      if (!hasSignal) return;

      var sig = [s.name, s.phone, s.vehicleInterest, s.qualified, s.testDriveDate, s.inspectionDate].join("|");
      if (!force && sig === lastSavedSig) return;
      lastSavedSig = sig;

      var entry = {
        at: new Date().toISOString(),
        name: s.name,
        phone: s.phone,
        vehicleInterest: s.vehicleInterest,
        tradeInDetails: s.tradeInDetails,
        testDriveDate: s.testDriveDate,
        inspectionDate: s.inspectionDate,
        financeInterest: s.financeInterest,
        qualified: s.qualified,
        ticket: bot.buildTicket(),
        source: "chat",
        pageUrl: location.href,
        session: JSON.parse(JSON.stringify(s)),
      };
      saveLeadEntry(entry, LS_KEY);
      if (s.qualified || force) {
        var names = (s.name || "").trim().split(/\s+/);
        postWebhook(CFG.leadWebhook, {
          dealerSlug: CFG.dealerSlug || "",
          firstName: names[0] || "TruChat",
          lastName: names.slice(1).join(" ") || "Lead",
          phone: s.phone || "",
          email: "",
          source: "TruChat Widget",
          notes: entry.ticket || ("TruChat lead — interest: " + (s.vehicleInterest || "general"))
        });
      }
      if (typeof options.onLead === "function") options.onLead(entry);
    }

    function addBotText(text, suggestions) {
      var div = document.createElement("div");
      div.className = "tc-msg bot";
      div.innerHTML = esc(text).replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      if (suggestions && suggestions.length) {
        var sug = document.createElement("div");
        sug.className = "tc-sugs";
        suggestions.forEach(function (label) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "tc-sug";
          b.textContent = label;
          b.onclick = function () {
            userSay(label);
          };
          sug.appendChild(b);
        });
        div.appendChild(sug);
      }
      history.appendChild(div);
      history.scrollTop = history.scrollHeight;
    }

    function addUserText(text) {
      var div = document.createElement("div");
      div.className = "tc-msg user";
      div.textContent = text;
      history.appendChild(div);
      history.scrollTop = history.scrollHeight;
    }

    function addCatalog(vehicles) {
      var wrap = document.createElement("div");
      wrap.className = "tc-cars";
      (vehicles || []).forEach(function (v) {
        var card = document.createElement("div");
        card.className = "tc-car";
        var label = v.year + " " + v.brand + " " + v.model;
        card.innerHTML =
          "<b>" +
          esc(label) +
          '</b><div class="m">' +
          esc(v.km || "") +
          (v.fuel ? " · " + esc(v.fuel) : "") +
          '</div><div class="p">R ' +
          Number(v.price || 0).toLocaleString("en-ZA") +
          '</div><div class="tc-car-acts">' +
          '<button type="button" class="tc-sec" data-a="finance">Finance</button>' +
          '<button type="button" class="tc-pri" data-a="test_drive">Test drive</button></div>';
        card.querySelectorAll("button").forEach(function (btn) {
          btn.onclick = function () {
            var a = btn.getAttribute("data-a");
            if (useBackend) {
              // Keep everything in the LLM flow — send a natural request.
              userSay(a === "finance" ? "I'd like finance options on the " + label : "I'd like to test drive the " + label);
              return;
            }
            handleOut(bot.selectVehicleAction(label, a));
          };
        });
        wrap.appendChild(card);
      });
      history.appendChild(wrap);
      history.scrollTop = history.scrollHeight;
    }

    function addScheduler(scheduleType, days) {
      var box = document.createElement("div");
      box.className = "tc-cal";
      box.innerHTML =
        '<div class="tc-cal-t">' +
        (scheduleType === "test_drive" ? "Pick a test drive" : "Pick a valuation slot") +
        '</div><div class="tc-grid" data-g="days"></div><div class="tc-grid" data-g="slots" style="display:none;margin-top:8px"></div>';
      var grid = box.querySelector('[data-g="days"]');
      var slots = box.querySelector('[data-g="slots"]');
      (days || []).forEach(function (d) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = d.label;
        b.onclick = function () {
          grid.querySelectorAll("button").forEach(function (x) {
            x.classList.remove("sel");
          });
          b.classList.add("sel");
          slots.style.display = "grid";
          slots.innerHTML = "";
          bot.slotsFor(d.isSaturday).forEach(function (hr) {
            var s = document.createElement("button");
            s.type = "button";
            s.textContent = hr;
            s.onclick = function () {
              slots.querySelectorAll("button").forEach(function (x) {
                x.classList.remove("sel");
              });
              s.classList.add("sel");
              box.style.opacity = "0.75";
              box.style.pointerEvents = "none";
              handleOut(bot.confirmSlot(scheduleType, d.label, hr));
            };
            slots.appendChild(s);
          });
        };
        grid.appendChild(b);
      });
      history.appendChild(box);
      history.scrollTop = history.scrollHeight;
    }

    function handleOut(out) {
      (out.replies || []).forEach(function (r) {
        if (r.type === "text") addBotText(r.text, r.suggestions);
        if (r.type === "catalog") addCatalog(r.vehicles);
        if (r.type === "schedule") addScheduler(r.scheduleType, r.days);
      });
      persistLead(false);
      if ((out.handoffReady || (bot.getSession() && bot.getSession().qualified)) && !handoffPrompted) {
        handoffPrompted = true;
        waBar.classList.add("show");
        addBotText(
          "Perfect — you're **qualified**. Tap **Open WhatsApp** and the yard gets your full ticket instantly.",
          ["Continue on WhatsApp"]
        );
      } else if (bot.getSession() && bot.getSession().qualified) {
        waBar.classList.add("show");
      }
    }

    /* ---- Backend (LLM) mode -------------------------------------------- */

    /** Build a WhatsApp ticket from the server-maintained session. */
    function remoteTicket() {
      var s = remoteSession || {};
      var dealer = (CFG.dealerName || "Your Car Guy").toUpperCase();
      var msg = "🚗 *" + dealer + " — CHAT LEAD* 🚗\n\n";
      if (s.name) msg += "👤 *Name:* " + s.name + "\n";
      msg += "📞 *Phone:* " + (s.phone || "Not provided") + "\n";
      if (s.email) msg += "✉️ *Email:* " + s.email + "\n";
      if (s.vehicleInterest) msg += "⭐ *Interest:* " + s.vehicleInterest + "\n";
      if (s.appointment) msg += "🗓️ *Booking:* " + s.appointment + "\n";
      if (s.tradeInDetails) msg += "🔄 *Trade-in:* " + s.tradeInDetails + "\n";
      if (s.financeInterest) msg += "💰 *Finance:* Interested\n";
      if (CFG.showCredit !== false) msg += "\n— sent via *TruChat* by TruSaaS";
      return msg;
    }

    function remoteWhatsappUrl() {
      var phone = waPhone || String(CFG.personalWhatsApp || CFG.salesWhatsApp || "").replace(/\D/g, "");
      var text = waMessage || remoteTicket();
      return "https://api.whatsapp.com/send?phone=" + phone + "&text=" + encodeURIComponent(text);
    }

    /** Render the backend's reply + structured actions. */
    function handleBackendResult(res) {
      if (res.session) remoteSession = res.session;
      var reply = res.reply || "";
      var actions = res.actions || [];

      if (reply) {
        addBotText(reply, res.suggestions || []);
        history.push({ role: "assistant", content: reply });
      }
      actions.forEach(function (a) {
        if (a.type === "stock" && a.vehicles) addCatalog(a.vehicles);
        if (a.type === "whatsapp") {
          if (a.text) waMessage = a.text;
          if (a.phone) waPhone = a.phone;
        }
      });

      // Reveal the WhatsApp bar whenever a handoff is offered…
      var showWa = actions.some(function (a) {
        return a.type === "whatsapp" || a.type === "booked" || a.type === "lead";
      });
      if (showWa) waBar.classList.add("show");

      // …but only give the "you're all set" nudge once the lead is actually qualified
      // (a booking or captured lead) — not for a plain "what's your number?" answer.
      var qualified = (remoteSession && remoteSession.qualified) ||
        actions.some(function (a) { return a.type === "booked" || a.type === "lead"; });
      if (qualified && !handoffPrompted) {
        handoffPrompted = true;
        addBotText("You're all set — tap **Open WhatsApp** and the yard gets your full details instantly.", ["Continue on WhatsApp"]);
      }
    }

    function sendToBackend(t) {
      history.push({ role: "user", content: t });
      setTyping(true);
      fetch(CFG.chatApi, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ messages: history, session: remoteSession, catalog: CFG.catalog || [] }),
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (destroyed) return;
          setTyping(false);
          handleBackendResult(res);
        })
        .catch(function () {
          if (destroyed) return;
          setTyping(false);
          // Offline fallback → local keyword engine so the widget still responds.
          handleOut(bot.process(t));
        });
    }

    function userSay(text) {
      if (destroyed || !text || !String(text).trim()) return;
      var t = String(text).trim();
      if (t.toLowerCase() === "continue on whatsapp" || t.toLowerCase() === "open handoff") {
        var url = useBackend ? remoteWhatsappUrl() : bot.whatsappHandoffUrl();
        if (!useBackend) persistLead(true);
        window.open(url, "_blank", "noopener");
        return;
      }
      addUserText(t);
      if (useBackend) {
        sendToBackend(t);
        return;
      }
      setTyping(true);
      var delay = 420 + Math.min(400, t.length * 8);
      setTimeout(function () {
        if (destroyed) return;
        setTyping(false);
        handleOut(bot.process(t));
      }, delay);
    }

    function send() {
      userSay(input.value);
      input.value = "";
      input.focus();
    }

    container.querySelector("#tcSend").onclick = send;
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });
    container.querySelector("#tcWaBtn").onclick = function () {
      if (useBackend) {
        window.open(remoteWhatsappUrl(), "_blank", "noopener");
        return;
      }
      persistLead(true);
      window.open(bot.whatsappHandoffUrl(), "_blank", "noopener");
    };
    var closeBtn = container.querySelector("#tcClose");
    if (closeBtn && options.onClose) closeBtn.onclick = options.onClose;

    async function loadStock() {
      var urls = [CFG.stockApi].concat(CFG.stockApiFallback || []).filter(Boolean);
      for (var i = 0; i < urls.length; i++) {
        try {
          var res = await fetch(urls[i], { cache: "no-store", mode: "cors" });
          if (!res.ok) continue;
          var data = await res.json();
          var list = data.vehicles || [];
          if (!list.length) continue;
          var mapped = list.slice(0, 12).map(function (v) {
            return {
              id: v.stockNumber || v.id,
              brand: String(v.make || "").toUpperCase(),
              model: v.model || v.trim || "",
              year: v.year,
              price: v.price || v.retailPrice || 0,
              km: (v.mileage || v.km || "") + (v.mileage ? " km" : ""),
              fuel: v.fuelType || v.fuel || "",
            };
          });
          if (mapped.length) {
            bot.setCatalog(mapped);
            return;
          }
        } catch (e) {}
      }
    }

    function startChat() {
      var intro = document.createElement("div");
      intro.className = "tc-intro";
      intro.innerHTML = '<div class="pill">✦ Live showroom assistant</div>';
      history.appendChild(intro);

      var greet =
        CFG.greeting ||
        "Hi — I'm **" +
          (CFG.assistantName || "your assistant") +
          "** at **" +
          (CFG.dealerName || "the showroom") +
          "**. Stock, test drives, trade-ins, hours — what do you need?";
      var sugs = CFG.suggestions || ["Browse stock", "Trade-in valuation", "Showroom hours", "Finance help"];
      if (pageVehicle) {
        greet =
          "Hi — I'm **" +
          (CFG.assistantName || "your assistant") +
          "** at **" +
          (CFG.dealerName || "the showroom") +
          "**.\n\nYou're looking at **" +
          pageVehicle +
          "**. Want a test drive, finance options, or something else from the floor?";
        sugs = ["Test drive this car", "Finance help", "Browse other stock", "Trade-in"];
      }
      setTimeout(function () {
        addBotText(greet, sugs);
        if (useBackend) history.push({ role: "assistant", content: greet });
      }, 180);
    }

    updateStatus();
    var hourTimer = setInterval(updateStatus, 30000);
    loadStock().finally(startChat);

    return {
      bot: bot,
      focus: function () {
        input.focus();
      },
      destroy: function () {
        destroyed = true;
        clearInterval(hourTimer);
        container.innerHTML = "";
      },
    };
  }

  root.TruChatUI = {
    mount: mount,
    LS_KEY: DEFAULT_LS_KEY,
    detectVehicleFromPage: detectVehicleFromPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
