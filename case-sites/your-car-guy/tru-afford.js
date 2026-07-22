/**
 * TruAfford — soft affordability / pre-qual widget (TrueSaas)
 * Drop-in: <script src="tru-afford.js" data-dealer="Your Car Guy" data-wa="27834659921" data-brand="ycg"></script>
 * Soft estimate only — not a hard credit bureau check.
 */
(function () {
  "use strict";
  if (window.__TruAffordLoaded) return;
  window.__TruAffordLoaded = true;

  var scr = document.currentScript || document.querySelector("script[src*='tru-afford']");
  var cfg = {
    dealer: (scr && scr.getAttribute("data-dealer")) || "Your Car Guy",
    wa: (scr && scr.getAttribute("data-wa")) || "27834659921",
    brand: (scr && scr.getAttribute("data-brand")) || "ycg",
    rate: parseFloat((scr && scr.getAttribute("data-rate")) || "0.1175"),
    position: (scr && scr.getAttribute("data-position")) || "right", // right | left
    offsetBottom: (scr && scr.getAttribute("data-bottom")) || "88px", // clear WhatsApp FAB
    z: (scr && scr.getAttribute("data-z")) || "999990"
  };

  var ID = "tru-afford";
  var state = {
    open: false,
    step: 1,
    income: 25000,
    expenses: 12000,
    deposit: 10,
    term: 72,
    employment: "permanent",
    name: "",
    phone: "",
    result: null
  };

  function money(n) {
    return "R " + Math.round(n || 0).toLocaleString("en-ZA");
  }

  function calc() {
    var net = Math.max(0, state.income - state.expenses);
    // Conservative vehicle affordability band on disposable income
    var empFactor = { permanent: 1, contract: 0.9, self: 0.82, other: 0.75 }[state.employment] || 0.85;
    var maxInstalment = Math.max(0, net * 0.32 * empFactor);
    var minInstalment = Math.max(0, net * 0.22 * empFactor);
    var r = cfg.rate / 12;
    var n = state.term;
    function principal(instalment) {
      if (r <= 0) return instalment * n;
      return instalment * (1 - Math.pow(1 + r, -n)) / r;
    }
    var loanMax = principal(maxInstalment);
    var loanMin = principal(minInstalment);
    var dep = state.deposit / 100;
    // Vehicle price ≈ loan / (1 - deposit)
    var priceMax = dep < 0.95 ? loanMax / (1 - dep) : loanMax;
    var priceMin = dep < 0.95 ? loanMin / (1 - dep) : loanMin;
    // Soft score band (not a bureau score)
    var ratio = state.income > 0 ? (state.expenses / state.income) : 1;
    var band = "Fair";
    if (net >= 15000 && ratio <= 0.55 && state.employment === "permanent") band = "Strong";
    else if (net >= 8000 && ratio <= 0.7) band = "Good";
    else if (net < 3500) band = "Tight";
    return {
      net: net,
      maxInstalment: maxInstalment,
      minInstalment: minInstalment,
      priceMax: Math.min(priceMax, 2500000),
      priceMin: Math.max(0, priceMin),
      loanMax: loanMax,
      band: band,
      depositAmt: priceMax * dep
    };
  }

  /* TrueSaas brand: signal purple → indigo → blue + teal trust */
  var CSS = [
    "#" + ID + "-root{",
    "--ta-signal:#7C3AED;--ta-signal-bright:#A78BFA;--ta-signal-deep:#5B21B6;",
    "--ta-blue:#3B82F6;--ta-blue-bright:#60A5FA;--ta-blue-deep:#1D4ED8;",
    "--ta-teal:#14B8A6;--ta-teal-bright:#5EEAD4;",
    "--ta-grad:linear-gradient(115deg,#7C3AED 0%,#6366F1 48%,#2563EB 100%);",
    "--ta-ink:#06070c;--ta-ok:#22C55E;",
    "--ta-glass:rgba(10,11,18,.82);--ta-border:rgba(255,255,255,.12);--ta-text:#F4F4F1;--ta-muted:#94A3B8;",
    "--ta-ease:cubic-bezier(.22,1,.36,1);--ta-spring:cubic-bezier(.34,1.4,.64,1);",
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box}",
    "#" + ID + "-root *,#" + ID + "-root *::before,#" + ID + "-root *::after{box-sizing:border-box}",
    "#" + ID + "-root{position:fixed;z-index:" + cfg.z + ";bottom:" + cfg.offsetBottom + ";",
    cfg.position === "left" ? "left:16px;right:auto;" : "right:16px;left:auto;",
    "display:flex;flex-direction:column;align-items:flex-end;gap:10px;max-width:min(400px,calc(100vw - 24px));pointer-events:none}",
    "#" + ID + "-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}",
    "#" + ID + "-root .ta-launcher{",
    "pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;",
    "border-radius:100px;background:linear-gradient(145deg,rgba(17,18,26,.92),rgba(10,11,18,.96));",
    "border:1px solid rgba(124,58,237,.28);color:#fff;",
    "box-shadow:0 12px 36px -10px rgba(0,0,0,.55),0 0 24px -8px rgba(124,58,237,.35),inset 0 1px 0 rgba(255,255,255,.1);",
    "backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);",
    "transition:transform .35s var(--ta-spring),box-shadow .35s var(--ta-ease);max-width:240px;text-align:left}",
    "#" + ID + "-root .ta-launcher:hover{transform:translateY(-3px) scale(1.02);",
    "box-shadow:0 18px 40px -10px rgba(124,58,237,.4),0 0 32px -6px rgba(124,58,237,.3),inset 0 1px 0 rgba(255,255,255,.14)}",
    "#" + ID + "-root .ta-launcher:active{transform:scale(.97)}",
    "#" + ID + "-root .ta-ico{",
    "width:40px;height:40px;border-radius:50%;flex-shrink:0;",
    "background:var(--ta-grad);",
    "display:grid;place-items:center;box-shadow:0 6px 18px -4px rgba(124,58,237,.55);position:relative}",
    "#" + ID + "-root .ta-ico::after{content:'';position:absolute;inset:-4px;border-radius:50%;",
    "border:2px solid rgba(124,58,237,.45);animation:taPulse 2.2s ease-out infinite}",
    "@keyframes taPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}",
    "#" + ID + "-root .ta-ico svg{width:20px;height:20px}",
    "#" + ID + "-root .ta-ltitle{display:block;font-size:13px;font-weight:700;line-height:1.2;letter-spacing:.01em}",
    "#" + ID + "-root .ta-lsub{display:block;font-size:10px;color:#a8b0c0;line-height:1.35;margin-top:2px;max-width:160px}",
    "#" + ID + "-root .ta-badge{font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;",
    "color:var(--ta-signal-bright);margin-top:3px;display:block}",
    "#" + ID + "-root.is-open .ta-launcher{display:none}",
    "#" + ID + "-root .ta-panel{",
    "pointer-events:auto;display:none;flex-direction:column;width:min(390px,calc(100vw - 24px));",
    "max-height:min(78vh,640px);border-radius:20px;overflow:hidden;",
    "background:var(--ta-glass);backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);",
    "border:1px solid var(--ta-border);color:var(--ta-text);",
    "box-shadow:0 28px 70px -20px rgba(0,0,0,.65),0 0 40px -16px rgba(124,58,237,.2),inset 0 1px 0 rgba(255,255,255,.1);",
    "opacity:0;transform:translateY(16px) scale(.96);transition:opacity .35s var(--ta-ease),transform .4s var(--ta-spring)}",
    "#" + ID + "-root.is-open .ta-panel{display:flex;opacity:1;transform:none}",
    "#" + ID + "-root .ta-head{",
    "padding:14px 14px 12px;display:flex;align-items:center;gap:10px;",
    "background:var(--ta-grad);",
    "border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}",
    "#" + ID + "-root .ta-head b{display:block;font-size:14px;font-weight:800}",
    "#" + ID + "-root .ta-head span{font-size:11px;opacity:.9}",
    "#" + ID + "-root .ta-x{",
    "margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);",
    "color:#fff;font-size:18px;display:grid;place-items:center;transition:background .2s,transform .25s var(--ta-spring)}",
    "#" + ID + "-root .ta-x:hover{background:rgba(255,255,255,.26);transform:scale(1.05)}",
    "#" + ID + "-root .ta-steps{display:flex;gap:4px;padding:10px 14px 0;flex-shrink:0}",
    "#" + ID + "-root .ta-step-dot{flex:1;height:3px;border-radius:4px;background:rgba(255,255,255,.1);transition:background .3s}",
    "#" + ID + "-root .ta-step-dot.on{background:var(--ta-grad)}",
    "#" + ID + "-root .ta-body{padding:12px 14px 14px;overflow-y:auto;flex:1;min-height:0}",
    "#" + ID + "-root .ta-view{display:none;animation:taIn .4s var(--ta-ease) both}",
    "#" + ID + "-root .ta-view.on{display:block}",
    "@keyframes taIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    "#" + ID + "-root .ta-h{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0 0 6px;line-height:1.25}",
    "#" + ID + "-root .ta-p{font-size:12.5px;color:var(--ta-muted);line-height:1.5;margin:0 0 14px}",
    "#" + ID + "-root .ta-soft{",
    "display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;margin-bottom:14px;",
    "background:rgba(20,184,166,.1);border:1px solid rgba(20,184,166,.3);font-size:11.5px;color:#99f6e4;line-height:1.45}",
    "#" + ID + "-root .ta-soft svg{width:16px;height:16px;flex-shrink:0;margin-top:1px;stroke:var(--ta-teal-bright)}",
    "#" + ID + "-root label{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ta-muted);margin:0 0 6px}",
    "#" + ID + "-root .ta-field{margin-bottom:14px}",
    "#" + ID + "-root .ta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}",
    "#" + ID + "-root .ta-row output{font-weight:800;font-size:13px;color:#fff}",
    "#" + ID + "-root input[type=range]{width:100%;appearance:none;height:4px;border-radius:4px;outline:none;",
    "background:linear-gradient(90deg,var(--ta-signal) 0%,var(--ta-blue) var(--fill,50%),rgba(255,255,255,.12) var(--fill,50%))}",
    "#" + ID + "-root input[type=range]::-webkit-slider-thumb{appearance:none;width:20px;height:20px;border-radius:50%;",
    "background:#fff;border:4px solid var(--ta-signal);box-shadow:0 2px 10px rgba(124,58,237,.45);cursor:grab}",
    "#" + ID + "-root input[type=text],#" + ID + "-root input[type=tel],#" + ID + "-root select{",
    "width:100%;padding:12px 13px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);",
    "background:rgba(255,255,255,.06);color:#fff;font:600 14px Inter,system-ui,sans-serif;outline:none;",
    "transition:border-color .2s,box-shadow .2s}",
    "#" + ID + "-root input:focus,#" + ID + "-root select:focus{",
    "border-color:rgba(124,58,237,.55);box-shadow:0 0 0 3px rgba(124,58,237,.22)}",
    "#" + ID + "-root select option{background:#11121a;color:#fff}",
    "#" + ID + "-root .ta-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
    "#" + ID + "-root .ta-pills{display:flex;flex-wrap:wrap;gap:6px}",
    "#" + ID + "-root .ta-pill{",
    "padding:9px 12px;border-radius:100px;font-size:11.5px;font-weight:700;",
    "border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:var(--ta-muted);",
    "transition:all .25s var(--ta-ease)}",
    "#" + ID + "-root .ta-pill.on{background:var(--ta-grad);color:#fff;border-color:transparent;",
    "box-shadow:0 8px 18px -8px rgba(124,58,237,.5)}",
    "#" + ID + "-root .ta-actions{display:flex;gap:8px;margin-top:6px}",
    "#" + ID + "-root .ta-btn{",
    "flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;",
    "padding:12px 14px;border-radius:12px;font-weight:800;font-size:13px;",
    "transition:transform .3s var(--ta-spring),box-shadow .3s,filter .2s;position:relative;overflow:hidden}",
    "#" + ID + "-root .ta-btn:active{transform:scale(.97)}",
    "#" + ID + "-root .ta-btn-primary{",
    "background:var(--ta-grad);color:#fff;",
    "box-shadow:0 10px 26px -10px rgba(124,58,237,.55),inset 0 1px 0 rgba(255,255,255,.2)}",
    "#" + ID + "-root .ta-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px);",
    "box-shadow:0 14px 32px -10px rgba(124,58,237,.55),0 0 24px -8px rgba(124,58,237,.35)}",
    "#" + ID + "-root .ta-btn-ghost{",
    "background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.14)}",
    "#" + ID + "-root .ta-btn-ghost:hover{background:rgba(255,255,255,.1)}",
    "#" + ID + "-root .ta-btn-wa{",
    "background:linear-gradient(145deg,#34d399,#059669);color:#fff;",
    "box-shadow:0 10px 26px -10px rgba(16,185,129,.45)}",
    "#" + ID + "-root .ta-result{",
    "border-radius:16px;padding:16px;margin-bottom:12px;",
    "background:linear-gradient(160deg,rgba(124,58,237,.2),rgba(37,99,235,.12),rgba(255,255,255,.03));",
    "border:1px solid rgba(124,58,237,.25)}",
    "#" + ID + "-root .ta-band{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;",
    "letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;margin-bottom:10px;",
    "background:rgba(20,184,166,.14);color:var(--ta-teal-bright);border:1px solid rgba(20,184,166,.32)}",
    "#" + ID + "-root .ta-band.tight{background:rgba(245,158,11,.12);color:#fcd34d;border-color:rgba(245,158,11,.3)}",
    "#" + ID + "-root .ta-big{font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.1;margin:4px 0 2px;",
    "background:linear-gradient(120deg,#A78BFA,#A78BFA 55%,#5EEAD4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
    "#" + ID + "-root .ta-range{font-size:12px;color:var(--ta-muted);margin-bottom:12px}",
    "#" + ID + "-root .ta-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
    "#" + ID + "-root .ta-metric{padding:10px;border-radius:12px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06)}",
    "#" + ID + "-root .ta-metric .k{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ta-muted)}",
    "#" + ID + "-root .ta-metric .v{font-size:14px;font-weight:800;margin-top:3px}",
    "#" + ID + "-root .ta-fine{font-size:10px;color:rgba(148,163,184,.75);line-height:1.45;margin-top:12px}",
    "#" + ID + "-root .ta-foot{padding:10px 14px 12px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;",
    "font-size:10px;color:var(--ta-muted);text-align:center}",
    "#" + ID + "-root .ta-foot b{color:var(--ta-signal-bright)}",
    "@media (max-width:420px){#" + ID + "-root{right:12px;left:12px;align-items:stretch}",
    "#" + ID + "-root .ta-launcher{max-width:none;width:100%;justify-content:flex-start}",
    "#" + ID + "-root .ta-panel{width:100%;max-height:min(82vh,680px)}}",
    "@media (prefers-reduced-motion:reduce){#" + ID + "-root *{animation:none!important;transition-duration:.01ms!important}}"
  ].join("");

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function fillRange(input) {
    if (!input) return;
    var min = +input.min, max = +input.max, val = +input.value;
    var pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty("--fill", pct + "%");
  }

  function mount() {
    var style = document.createElement("style");
    style.id = ID + "-css";
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = el(
      '<div id="' + ID + '-root" aria-live="polite">' +
        '<div class="ta-panel" role="dialog" aria-label="Check affordability" aria-hidden="true">' +
          '<div class="ta-head">' +
            '<div class="ta-ico" style="width:36px;height:36px">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3.5"/></svg>' +
            "</div>" +
            "<div><b>Check Affordability</b><span>" + cfg.dealer + " · Soft pre-qual</span></div>" +
            '<button type="button" class="ta-x" id="' + ID + '-close" aria-label="Close">×</button>' +
          "</div>" +
          '<div class="ta-steps" id="' + ID + '-steps" aria-hidden="true">' +
            '<div class="ta-step-dot on"></div><div class="ta-step-dot"></div><div class="ta-step-dot"></div><div class="ta-step-dot"></div>' +
          "</div>" +
          '<div class="ta-body" id="' + ID + '-body"></div>' +
          '<div class="ta-foot">Powered by <b>TrueSaas TruAfford</b> · Soft estimate only · Not a credit bureau check</div>' +
        "</div>" +
        '<button type="button" class="ta-launcher" id="' + ID + '-open" aria-label="Check affordability">' +
          '<span class="ta-ico">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>' +
          "</span>" +
          "<span>" +
            '<span class="ta-ltitle">Check Affordability</span>' +
            '<span class="ta-lsub">What you qualify for in ~60s. No hard credit check.</span>' +
            '<span class="ta-badge">TruAfford · Soft</span>' +
          "</span>" +
        "</button>" +
      "</div>"
    );
    document.body.appendChild(root);

    document.getElementById(ID + "-open").addEventListener("click", open);
    document.getElementById(ID + "-close").addEventListener("click", close);
    render();
  }

  function open() {
    state.open = true;
    var root = document.getElementById(ID + "-root");
    root.classList.add("is-open");
    root.querySelector(".ta-panel").setAttribute("aria-hidden", "false");
    render();
  }
  function close() {
    state.open = false;
    var root = document.getElementById(ID + "-root");
    root.classList.remove("is-open");
    root.querySelector(".ta-panel").setAttribute("aria-hidden", "true");
  }

  function setStep(n) {
    state.step = n;
    render();
  }

  function renderSteps() {
    var dots = document.querySelectorAll("#" + ID + "-steps .ta-step-dot");
    dots.forEach(function (d, i) {
      d.classList.toggle("on", i < state.step);
    });
  }

  function render() {
    renderSteps();
    var body = document.getElementById(ID + "-body");
    if (!body) return;
    var html = "";
    if (state.step === 1) {
      html =
        '<div class="ta-view on">' +
        '<div class="ta-h">Know your budget before you fall in love with a car.</div>' +
        '<p class="ta-p">A soft affordability estimate for ' + cfg.dealer + " — no hard bureau pull, no score damage claim. Instant range, then WhatsApp the team.</p>" +
        '<div class="ta-soft">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        "<div><b>Soft pre-qual only.</b> This is not a credit application and not a formal quote. Banks make the final call.</div>" +
        "</div>" +
        '<div class="ta-actions"><button type="button" class="ta-btn ta-btn-primary" data-go="2">Start check →</button></div>' +
        "</div>";
    } else if (state.step === 2) {
      html =
        '<div class="ta-view on">' +
        '<div class="ta-h">Your monthly numbers</div>' +
        '<p class="ta-p">We’ll estimate instalment and vehicle price bands from disposable income.</p>' +
        '<div class="ta-field"><div class="ta-row"><label>Net monthly income</label><output id="o-inc">' + money(state.income) + "</output></div>" +
        '<input type="range" id="r-inc" min="8000" max="120000" step="500" value="' + state.income + '"></div>' +
        '<div class="ta-field"><div class="ta-row"><label>Monthly expenses</label><output id="o-exp">' + money(state.expenses) + "</output></div>" +
        '<input type="range" id="r-exp" min="2000" max="80000" step="500" value="' + state.expenses + '"></div>' +
        '<div class="ta-grid2">' +
        '<div class="ta-field"><div class="ta-row"><label>Deposit</label><output id="o-dep">' + state.deposit + "%</output></div>" +
        '<input type="range" id="r-dep" min="0" max="40" step="5" value="' + state.deposit + '"></div>' +
        '<div class="ta-field"><div class="ta-row"><label>Term</label><output id="o-term">' + state.term + " mo</output></div>" +
        '<input type="range" id="r-term" min="12" max="96" step="12" value="' + state.term + '"></div>' +
        "</div>" +
        '<div class="ta-actions">' +
        '<button type="button" class="ta-btn ta-btn-ghost" data-go="1">Back</button>' +
        '<button type="button" class="ta-btn ta-btn-primary" data-go="3">Next →</button>' +
        "</div></div>";
    } else if (state.step === 3) {
      html =
        '<div class="ta-view on">' +
        '<div class="ta-h">Employment profile</div>' +
        '<p class="ta-p">Helps us adjust the soft band — still not a bureau score.</p>' +
        '<div class="ta-field"><label>Employment type</label><div class="ta-pills" id="emp-pills">' +
        pill("permanent", "Permanent") +
        pill("contract", "Contract") +
        pill("self", "Self-employed") +
        pill("other", "Other") +
        "</div></div>" +
        '<div class="ta-actions">' +
        '<button type="button" class="ta-btn ta-btn-ghost" data-go="2">Back</button>' +
        '<button type="button" class="ta-btn ta-btn-primary" data-go="4">See my range →</button>' +
        "</div></div>";
    } else if (state.step === 4) {
      var r = state.result || calc();
      state.result = r;
      var bandClass = r.band === "Tight" ? " tight" : "";
      html =
        '<div class="ta-view on">' +
        '<div class="ta-result">' +
        '<div class="ta-band' + bandClass + '">Soft band · ' + r.band + "</div>" +
        '<div style="font-size:11px;color:var(--ta-muted);font-weight:700">Estimated vehicle budget</div>' +
        '<div class="ta-big">' + money(r.priceMin) + " – " + money(r.priceMax) + "</div>" +
        '<div class="ta-range">Indicative range at ~' + (cfg.rate * 100).toFixed(2) + "% over " + state.term + " months · " + state.deposit + "% deposit</div>" +
        '<div class="ta-metrics">' +
        '<div class="ta-metric"><div class="k">Monthly from</div><div class="v">' + money(r.minInstalment) + "</div></div>" +
        '<div class="ta-metric"><div class="k">Monthly up to</div><div class="v">' + money(r.maxInstalment) + "</div></div>" +
        '<div class="ta-metric"><div class="k">Disposable</div><div class="v">' + money(r.net) + "</div></div>" +
        '<div class="ta-metric"><div class="k">Deposit ≈</div><div class="v">' + money(r.depositAmt) + "</div></div>" +
        "</div></div>" +
        '<div class="ta-field"><label>Your name</label><input type="text" id="ta-name" placeholder="Full name" value="' + esc(state.name) + '" autocomplete="name"></div>' +
        '<div class="ta-field"><label>Mobile</label><input type="tel" id="ta-phone" placeholder="06…" value="' + esc(state.phone) + '" autocomplete="tel"></div>' +
        '<div class="ta-actions">' +
        '<button type="button" class="ta-btn ta-btn-ghost" data-go="3">Back</button>' +
        '<button type="button" class="ta-btn ta-btn-wa" id="ta-wa">WhatsApp result</button>' +
        "</div>" +
        '<p class="ta-fine">Estimate only. Final rate, term and approval subject to bank / FSP credit assessment. ' +
        cfg.dealer + " and TrueSaas are not offering credit by this tool alone. Illustrative rate " +
        (cfg.rate * 100).toFixed(2) + "% linked, excl. fees & insurance.</p>" +
        "</div>";
    }
    body.innerHTML = html;
    bindStep();
  }

  function pill(val, label) {
    return '<button type="button" class="ta-pill' + (state.employment === val ? " on" : "") + '" data-emp="' + val + '">' + label + "</button>";
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function bindStep() {
    bodyClick();
    ["r-inc", "r-exp", "r-dep", "r-term"].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      fillRange(input);
      input.addEventListener("input", function () {
        if (id === "r-inc") {
          state.income = +input.value;
          document.getElementById("o-inc").textContent = money(state.income);
        }
        if (id === "r-exp") {
          state.expenses = +input.value;
          document.getElementById("o-exp").textContent = money(state.expenses);
        }
        if (id === "r-dep") {
          state.deposit = +input.value;
          document.getElementById("o-dep").textContent = state.deposit + "%";
        }
        if (id === "r-term") {
          state.term = +input.value;
          document.getElementById("o-term").textContent = state.term + " mo";
        }
        fillRange(input);
      });
    });
    document.querySelectorAll("[data-emp]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.employment = b.getAttribute("data-emp");
        render();
      });
    });
    var wa = document.getElementById("ta-wa");
    if (wa) {
      wa.addEventListener("click", function () {
        state.name = (document.getElementById("ta-name") || {}).value || "";
        state.phone = (document.getElementById("ta-phone") || {}).value || "";
        state.result = calc();
        var r = state.result;
        var msg = [
          "Hi " + cfg.dealer + " — TruAfford soft estimate",
          "Name: " + (state.name || "—"),
          "Phone: " + (state.phone || "—"),
          "Net income: " + money(state.income),
          "Expenses: " + money(state.expenses),
          "Deposit: " + state.deposit + "% · Term: " + state.term + " months",
          "Employment: " + state.employment,
          "Soft band: " + r.band,
          "Budget range: " + money(r.priceMin) + " – " + money(r.priceMax),
          "Instalment band: " + money(r.minInstalment) + " – " + money(r.maxInstalment) + "/pm",
          "(Soft estimate only — not a credit application)"
        ].join("\n");
        window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
      });
    }
  }

  function bodyClick() {
    document.querySelectorAll("#" + ID + "-body [data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = +btn.getAttribute("data-go");
        if (n === 4) state.result = calc();
        setStep(n);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.TruAfford = { open: open, close: close, config: cfg };
})();
