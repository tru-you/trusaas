/* Cars on Caledon — Vehicle Detail Modal logic (self-contained)
   Tru3D · VIR · TruLens AI · TruPrice · Finance · Booking. Mock data. */
(function(){
var WA = "27618759389";
var DEALER = "Cars on Caledon";
var VD_THUMB_CAP = 8;   // cap detail-gallery thumbnails — a 20-photo car was rendering all 20 into a grid on mobile
var VD_LAST_FOCUS = null;   // element that opened the dialog; focus returns here

/* Keep Tab inside the dialog while it is open. Without this the tab order
   continues into the page behind the overlay, which is invisible to the user. */
function vdTrapFocus(e){
  if(e.key !== "Tab") return;
  var ov = document.getElementById("vdOverlay");
  if(!ov || !ov.classList.contains("open")) return;
  var SEL = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  /* The mobile action bar is portalled onto <body> (see vdPortalMbar), so it is
     NOT inside the overlay — include it explicitly or Reserve/WhatsApp become
     unreachable by keyboard and the trap bounces focus away from them. */
  var mbar = document.querySelector("body > .vd-mbar");
  var f = [].slice.call(ov.querySelectorAll(SEL));
  if(mbar) f = f.concat([].slice.call(mbar.querySelectorAll(SEL)));
  f = f.filter(function(el){ return el.offsetParent !== null || el === document.activeElement; });
  if(!f.length) return;
  var first = f[0], last = f[f.length - 1];
  var inScope = ov.contains(document.activeElement) || (mbar && mbar.contains(document.activeElement));
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  else if(!inScope){ e.preventDefault(); first.focus(); }
}
document.addEventListener("keydown", vdTrapFocus, true);

function fmtR(n){return "R"+Number(n||0).toLocaleString("en-ZA").replace(/,/g," ");}
/* A DMS unit may have no photos yet — never paint url('') (broken/blank).
   Falls back to the same branded navy panel the grid cards use. */
function phStyle(img, overlay){
  if(img) return "background-image:"+(overlay?overlay+",":"")+"url('"+img+"')";
  return "background:radial-gradient(100% 80% at 26% 14%,rgba(46,84,190,.45),transparent 62%),linear-gradient(150deg,#0B1020 0%,#12203F 50%,#0A0F1C 100%)";
}
function monthly(p,d,t){d=(d==null?.1:d);t=t||72;var r=.1175/12;return Math.round(p*(1-d)*r/(1-Math.pow(1+r,-t)));}

/* Build a real, shareable URL for a single car so a pasted link opens a page
   showing THAT car (photo, price, specs, finance) — not the generic dealer chat.
   Keyed on the DMS stock number (car.tag) so it stays stable. */
var SITE = "https://www.carsoncaledon.co.za";
function carShareUrl(car){
  var img = car.img || (Array.isArray(car.images) ? car.images.filter(Boolean)[0] : "") || "";
  var q = [];
  function add(k,v){ if(v!=null && v!=="") q.push(k+"="+encodeURIComponent(v)); }
  add("stock",   car.tag);
  add("year",    car.yr);
  add("make",    car.make);
  add("name",    car.name);
  add("variant", car.variant);
  add("price",   car.price);
  add("km",      car.km);
  add("trans",   car.tr);
  add("fuel",    car.fuel);
  add("body",    car.body);
  add("img",     img);
  return SITE + "/vehicle/?" + q.join("&");
}

var MOCK_DMG = [
  {loc:"Front bumper",note:"Light stone chips — 2mm area, clear-coat only. No respray needed.",type:"warn"},
  {loc:"Rear left quarter",note:"Minor parking scuff, 15mm. Polish-grade — no paint break.",type:"warn"}
];
var MOCK_CHECKS = [
  {label:"Full service history",ok:true},{label:"No accident / structural",ok:true},
  {label:"Cambelt / chain verified",ok:true},{label:"Tyres 70%+ tread",ok:true},
  {label:"Diagnostics: 0 fault codes",ok:true},{label:"Minor cosmetic marks",ok:false}
];

function svgCheck(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';}
function svgWarn(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z"/></svg>';}

/* Move the freshly-rendered .vd-mbar out of the modal shell and onto <body>,
   discarding any bar left over from a previously-opened car. */
function vdPortalMbar(ov){
  var stale = document.querySelector("body > .vd-mbar");
  if(stale) stale.remove();
  var bar = ov.querySelector(".vd-mbar");
  if(bar) document.body.appendChild(bar);
}
function vdRemoveMbar(){
  var bar = document.querySelector("body > .vd-mbar");
  if(bar) bar.remove();
}

function ensureOverlay(){
  var ov = document.getElementById("vdOverlay");
  if(ov) return ov;
  ov = document.createElement("div");
  ov.className = "vd-overlay";
  ov.id = "vdOverlay";
  ov.setAttribute("role","dialog");
  ov.setAttribute("aria-label","Vehicle detail");
  ov.setAttribute("aria-hidden","true");
  ov.innerHTML = '<button class="vd-close" id="vdClose" aria-label="Close">&#10005;</button>'
    +'<div class="vd-shell"><div class="vd-grid" id="vdContent"></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click",function(e){if(e.target===ov) closeVehicleDetail();});
  ov.querySelector("#vdClose").addEventListener("click",closeVehicleDetail);
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&ov.classList.contains("open")) closeVehicleDetail();});
  return ov;
}

window.openVehicleDetail = function(car){
  if(!car) return;
  var ov = ensureOverlay();
  var vdContent = ov.querySelector("#vdContent");

  var wa = encodeURIComponent("Hi "+DEALER+", I'm interested in the "+car.yr+" "+car.make+" "+car.name+" ("+fmtR(car.price)+"). Is it still available?");
  var waReserve = encodeURIComponent("Hi "+DEALER+", I'd like to reserve the "+car.yr+" "+car.make+" "+car.name+" ("+fmtR(car.price)+") with a refundable deposit");
  var waFinance = encodeURIComponent("Hi "+DEALER+", I'd like to apply for finance on the "+car.yr+" "+car.make+" "+car.name+" ("+fmtR(car.price)+")");
  var waTest = encodeURIComponent("Hi "+DEALER+", I'd like a test drive of the "+car.yr+" "+car.make+" "+car.name);
  var waVir = encodeURIComponent("Hi "+DEALER+", please send me the full inspection report for the "+car.yr+" "+car.make+" "+car.name+(car.tag?" (stock "+car.tag+")":""));

  var catLabel = car.category==="select"?"Select":car.category==="performance"?"Performance":(car.tag||"Featured");
  var catClass = car.category==="performance"
    ? "background:linear-gradient(135deg,#F59E0B,#DC2626)"
    : car.category==="select"
      ? "background:linear-gradient(135deg,#6E9BFF,#2E54BE)"
      : "background:linear-gradient(135deg,#6E9BFF,#2E54BE)";
  var bodyName = car.body || "Vehicle";
  var pm = monthly(car.price);
  var virScore = (typeof car.vir === "number") ? car.vir : null;
  var tpDelta = (typeof priceDelta !== "undefined") ? priceDelta(car) : { below: false, amount: 0, pct: 0 };
  var tpRatio = car.price / (car.truPrice || car.price || 1);
  var tpPos = Math.min(96, Math.max(4, ((tpRatio - 0.85) / 0.30) * 100));
  var tpVerdict = !tpDelta.below
    ? "Fair market price"
    : (tpDelta.pct >= 8 ? "Great deal — " : "Good price — ") + fmtR(tpDelta.amount) + " below TruPrice";
  var tpColor = tpDelta.below ? "#16A34A" : "#7A8494";
  var gallery = (Array.isArray(car.images) && car.images.filter(Boolean).length)
    ? car.images.filter(Boolean)
    : (car.img ? [car.img] : []);
  var realReport = Array.isArray(car.virReport) && car.virReport.length ? car.virReport : [];
  var realDamage = Array.isArray(car.damage) && car.damage.length ? car.damage : [];
  var passCount = realReport.filter(function(s){return s.status==="Pass";}).length;
  var attentionCount = realReport.filter(function(s){return s.status==="Attention";}).length;
  var verdict = virScore===null?"Not yet inspected":virScore>=94?"Excellent condition":virScore>=88?"Very good condition":virScore>=70?"Good condition":"Fair condition";

  vdContent.innerHTML =
    // ===== LEFT COLUMN =====
    '<div>'
    +'<div class="vd-gallery">'
    +'<div class="vd-hero-img">'
    +'<div class="im" style="'+phStyle(car.img,"linear-gradient(180deg,transparent 60%,rgba(10,16,32,.35))")+'"></div>'
    +'<div class="vd-vir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z"/></svg>'+(car.conditionLabel || 'Inspected')+'</div>'
    +'<div class="vd-cat" style="'+catClass+'">'+catLabel+'</div>'
    +'</div>'
    +(gallery.length > 1
      ? '<div class="vd-thumbs">'
        +gallery.slice(0, VD_THUMB_CAP).map(function(src,i){
            var isLast = (i === VD_THUMB_CAP - 1) && gallery.length > VD_THUMB_CAP;
            var more = isLast ? '<span class="vd-thumb-more">+'+(gallery.length - VD_THUMB_CAP + 1)+'</span>' : '';
            return '<div class="vd-thumb'+(i===0?' on':'')+'" data-thumb="'+i+'"><div class="im" style="'+phStyle(src)+'"></div>'+more+'</div>';
          }).join("")
        +'</div>'
      : '')
    +'</div>'

    // ===== TRU3D =====
    +'<div class="vd-3d">'
    +'<div class="vd-3d-top">'
    +'<div><div class="vd-3d-title">'+car.yr+' '+car.make+' '+car.name+'</div>'
    +'<div class="vd-3d-odo">Odometer: '+(car.km||"—")+'</div></div>'
    +'<div class="vd-3d-actions">'
    +'<button id="vdTagBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>Tags</button>'
    +'<button><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Watch</button>'
    +'</div></div>'
    +'<div class="vd-stage" id="vdStage">'
    +'<div class="vd-tt-disc"></div><div class="vd-tt-ring"></div>'
    +'<div class="vd-stage-car"><div class="im im-a" style="'+phStyle(car.img)+'"></div><div class="im im-b" style="'+phStyle(car.img)+'"></div></div>'
    +'<button class="vd-tag-toggle" id="vdTagToggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg><span class="tt-off">Show tags</span><span class="tt-on" style="display:none">Hide tags</span></button>'
    +'<div class="vd-tag-pin warn" style="top:42%;left:22%" data-idx="0">!</div>'
    +'<div class="vd-tag-pin warn" style="top:55%;left:78%" data-idx="1">!</div>'
    +'<div class="vd-grade-pin" style="top:30%;left:35%"><span class="g"><em>A</em></span></div>'
    +'<div class="vd-grade-pin" style="top:30%;left:65%"><span class="g"><em>A</em></span></div>'
    +'<div class="vd-grade-pin" style="top:60%;left:35%"><span class="g"><em>A+</em></span></div>'
    +'<div class="vd-grade-pin" style="top:60%;left:65%"><span class="g"><em>B+</em></span></div>'
    +'<div class="vd-badge-360">360&deg;</div>'
    +'<div class="vd-spin-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.5 20A9 9 0 1 0 4 10l-3 0"/></svg>Drag to spin</div>'
    +'<div class="vd-deg" id="vdDeg">0&deg;</div>'
    +'</div>'
    +'<div class="vd-3d-thumbs">'
    +'<div class="vd-3d-thumb on">Front</div><div class="vd-3d-thumb">Side</div><div class="vd-3d-thumb">Rear</div><div class="vd-3d-thumb">Interior</div><div class="vd-3d-thumb">Engine</div>'
    +'</div></div>'

    // ===== INSPECTION — "Inspected" + condition summary + request full report =====
    /* Retail model, and the standard every TruSaaS dealer site now uses: the
       page states the car was inspected and its plain condition summary; the
       full graded report is dealer-delivered on request, NOT rendered inline
       (no /100 score, no per-section detail). VIR data still flows in the feed
       so the dealer can produce that report. */
    +((virScore!==null || car.conditionLabel || realReport.length || realDamage.length)
    ? '<div class="vd-vir-report">'
    +'<div class="vd-vir-eyebrow"><img src="coc-mark.svg" alt="">Verified Inspection Report</div>'
    +'<div class="vd-vir-verdict">Inspected</div>'
    +'<p class="vd-vir-desc">'+(car.conditionLabel || (realDamage.length ? 'Visible damage reported &middot; '+realDamage.length+' item'+(realDamage.length===1?'':'s') : 'No damage reported'))+(realReport.length?' &middot; '+realReport.length+' sections checked':'')+'</p>'
    +'<a class="vd-btn vd-btn-ghost" style="margin-top:12px" href="https://wa.me/'+WA+'?text='+waVir+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>Request full inspection report</a>'
    +'</div>'
    : '')
    +'</div>'

    // ===== RIGHT COLUMN =====
    +'<div class="vd-buy">'
    +'<div class="vd-crumb">'+DEALER+' / '+catLabel+' / '+car.make+'</div>'
    +'<h1>'+car.yr+' '+car.make+' '+car.name+'</h1>'
    +'<div class="vd-variant">'+(car.variant||"")+' &middot; '+bodyName+(car.color?' &middot; '+car.color:'')+'</div>'
    +(car.description?'<p class="vd-desc" style="font-size:13px;color:rgba(255,255,255,.55);margin-top:8px;line-height:1.6;">'+car.description+'</p>':'')
    +'<div class="vd-price-block"><div class="vd-price">'+fmtR(car.price)+'</div>'
    +'<div class="vd-pm">From <b>'+fmtR(pm)+'/pm</b> over 72 months</div></div>'

    +'<div class="vd-truprice">'
    +'<div class="vd-tp-verdict" style="color:'+tpColor+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'+tpVerdict+'</div>'
    +'<div class="vd-tp-bar"><i style="width:'+tpPos+'%'+(tpDelta.below?'':';background:linear-gradient(90deg,#7A8494,#2E54BE)')+'"></i><div class="vd-tp-marker" style="left:'+tpPos+'%'+(tpDelta.below?'':';border-color:#7A8494')+'"></div></div>'
    +'<div class="vd-tp-labels"><span>Below market</span><span>Market avg</span><span>Above market</span></div>'
    +'</div>'

    +'<div class="vd-spec-grid">'
    +'<div class="vd-spec"><div class="l">Year</div><div class="v">'+car.yr+'</div></div>'
    +'<div class="vd-spec"><div class="l">Mileage</div><div class="v">'+(car.km||"—")+'</div></div>'
    +'<div class="vd-spec"><div class="l">Fuel</div><div class="v">'+(car.fuel||"—")+'</div></div>'
    +'<div class="vd-spec"><div class="l">Transmission</div><div class="v">'+(car.tr||"—")+'</div></div>'
    +'<div class="vd-spec"><div class="l">Body</div><div class="v">'+bodyName+'</div></div>'
    +(car.color?'<div class="vd-spec"><div class="l">Colour</div><div class="v">'+car.color+'</div></div>':'')
    +'<div class="vd-spec"><div class="l">Condition</div><div class="v">'+((virScore!==null||car.conditionLabel||realReport.length||realDamage.length)?'Inspected':'—')+'</div></div>'
    +'</div>'

    +'<div class="vd-actions">'
    +'<a class="vd-btn vd-btn-primary" href="https://wa.me/'+WA+'?text='+waReserve+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-5"/><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/></svg>Reserve this car &middot; refundable deposit</a>'
    +'<div class="row2">'
    +'<a class="vd-btn vd-btn-dark" href="https://wa.me/'+WA+'?text='+waTest+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l4-7h10l4 7M6 17h.01M18 17h.01"/></svg>Test drive</a>'
    +'<button class="vd-btn vd-btn-dark" id="vdLvsBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>Book LVS</button>'
    +'</div>'
    +'<a class="vd-btn vd-btn-wa" href="https://wa.me/'+WA+'?text='+wa+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.3.4-.1.7.2.3.8 1.4 1.8 2.2 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2.1 1c.3.2.5.3.6.4.1.2.1.7-.1 1.3-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.2c.1.2.1.4 0 .6l-.4.6-.5.5z"/></svg>WhatsApp — I\'m interested</a>'
    +'<a class="vd-btn vd-btn-ghost" href="https://wa.me/'+WA+'?text='+waFinance+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 17l5-5 4 4 7-8M18 8h3v3"/></svg>Apply for finance</a>'
    +'<button class="vd-btn vd-btn-ghost" id="vdShareBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Share this car</button>'
    +'</div>'

    +'<div class="vd-calc">'
    +'<h3>Finance estimator</h3>'
    +'<div class="sub">Indicative &middot; 11.75% linked rate &middot; structures vary</div>'
    +'<div class="vd-calc-out"><div class="m" id="vdCalcM">'+fmtR(pm)+'<small>/pm</small></div></div>'
    +'<div class="cr"><div class="top"><span>Deposit</span><b id="vdDepV">10%</b></div><input type="range" id="vdDep" min="0" max="40" step="5" value="10" data-price="'+car.price+'"></div>'
    +'<div class="cr"><div class="top"><span>Term</span><b id="vdTermV">72 months</b></div><input type="range" id="vdTerm" min="24" max="84" step="6" value="72"></div>'
    +'</div>'
    +'<div class="vd-trust">'
    +'<span><i style="background:#25D366"></i>Available now</span>'
    +'<span><i style="background:#6E9BFF"></i>Bank finance</span>'
    +'<span><i style="background:#D9B166"></i>Trade-ins welcome</span>'
    +'</div></div>'

    // ===== MOBILE BAR =====
    +'<div class="vd-mbar">'
    +'<div class="mb-price"><b>'+fmtR(car.price)+'</b><span>'+fmtR(pm)+'/pm</span></div>'
    +'<a class="mb-reserve" href="https://wa.me/'+WA+'?text='+waReserve+'" target="_blank" rel="noopener">Reserve</a>'
    +'<a class="mb-wa" href="https://wa.me/'+WA+'?text='+wa+'" target="_blank" rel="noopener">WhatsApp</a>'
    +'</div>';

  ov.classList.add("open");
  ov.setAttribute("aria-hidden","false");
  ov.setAttribute("aria-modal","true");
  document.body.classList.add("vd-lock");
  ov.scrollTop = 0;

  /* Portal the mobile action bar to <body>.
     It is position:fixed, but .vd-shell carries a transform for its entrance
     animation, and a transformed ancestor becomes the containing block for
     fixed descendants — so bottom:0 resolved to the bottom of the 2400px-tall
     shell instead of the viewport, parking the Reserve/WhatsApp bar mid-screen.
     Lifting it out of the shell means no ancestor can trap it, now or after
     some future wrapper picks up a filter/transform/contain. Styling for the
     portalled position lives in coc-fixes.css (FIX 16). */
  vdPortalMbar(ov);

  // Remember what opened the dialog so focus can be handed back on close,
  // then move focus in — otherwise keyboard users tab behind the overlay.
  VD_LAST_FOCUS = document.activeElement;
  // The overlay transitions visibility over .35s, and focus() is a no-op while
  // the element is still visibility:hidden — so wait for the transition to land.
  var closeBtn = ov.querySelector("#vdClose");
  if(closeBtn){
    var focused = false;
    var takeFocus = function(){
      if(focused) return;
      if(getComputedStyle(ov).visibility === "hidden") return;
      focused = true;
      ov.removeEventListener("transitionend", takeFocus);
      closeBtn.focus();
    };
    ov.addEventListener("transitionend", takeFocus);
    setTimeout(takeFocus, 420);   // fallback if transitionend never fires
  }

  // finance calc
  var vdDep = document.getElementById("vdDep"), vdTerm = document.getElementById("vdTerm");
  function vdCalc(){
    var d=+vdDep.value/100, t=+vdTerm.value, p=+vdDep.dataset.price;
    document.getElementById("vdDepV").textContent = vdDep.value+"%";
    document.getElementById("vdTermV").textContent = t+" months";
    document.getElementById("vdCalcM").innerHTML = fmtR(monthly(p,d,t))+"<small>/pm</small>";
    [vdDep,vdTerm].forEach(function(el){el.style.setProperty("--fill",((el.value-el.min)/(el.max-el.min)*100)+"%");});
  }
  if(vdDep&&vdTerm){vdDep.addEventListener("input",vdCalc);vdTerm.addEventListener("input",vdCalc);vdCalc();}

  // gallery thumbs — swap the hero image, keep everything else (VIR badge, category chip) in place
  var heroImgEl = ov.querySelector(".vd-hero-img .im");
  ov.querySelectorAll(".vd-thumb").forEach(function(thumb){
    thumb.addEventListener("click",function(){
      var src = gallery[+this.dataset.thumb];
      if(!src || !heroImgEl) return;
      ov.querySelectorAll(".vd-thumb").forEach(function(t){t.classList.remove("on");});
      this.classList.add("on");
      heroImgEl.setAttribute("style", phStyle(src,"linear-gradient(180deg,transparent 60%,rgba(10,16,32,.35))"));
    });
  });

  // tag toggle
  var tagToggle=document.getElementById("vdTagToggle"), tagBtn=document.getElementById("vdTagBtn"), stage=document.getElementById("vdStage");
  function toggleTags(){
    stage.classList.toggle("tags-on");
    var on=stage.classList.contains("tags-on");
    tagToggle.classList.toggle("on",on);
    tagToggle.querySelector(".tt-off").style.display=on?"none":"inline";
    tagToggle.querySelector(".tt-on").style.display=on?"inline":"none";
    if(tagBtn) tagBtn.classList.toggle("on",on);
  }
  if(tagToggle) tagToggle.addEventListener("click",toggleTags);
  if(tagBtn) tagBtn.addEventListener("click",toggleTags);

  // drag to spin + cross-fade
  var dragX=0,deg=0,dragging=false;
  if(stage){
    stage.addEventListener("pointerdown",function(e){dragging=true;dragX=e.clientX;stage.classList.add("grabbing");stage.setPointerCapture(e.pointerId);});
    stage.addEventListener("pointermove",function(e){
      if(!dragging)return;
      deg=(deg+(e.clientX-dragX)*.5)%360;if(deg<0)deg+=360;dragX=e.clientX;
      document.getElementById("vdDeg").textContent=Math.round(deg)+"°";
      stage.classList.toggle("flip", deg>=90&&deg<270);
      var carEl=stage.querySelector(".vd-stage-car");
      if(carEl){var rad=deg*Math.PI/180;carEl.style.transform="translateX("+(Math.sin(rad)*3)+"%) scale("+(1-Math.abs(Math.sin(rad))*.04)+")";}
    });
    stage.addEventListener("pointerup",function(){dragging=false;stage.classList.remove("grabbing");});
  }

  // tag popups
  ov.querySelectorAll(".vd-tag-pin").forEach(function(pin){
    pin.addEventListener("click",function(e){
      e.stopPropagation();
      ov.querySelectorAll(".vd-tag-popup").forEach(function(p){p.remove();});
      var d=MOCK_DMG[+this.dataset.idx]||MOCK_DMG[0];
      var popup=document.createElement("div");
      popup.className="vd-tag-popup damage";
      popup.style.cssText="top:"+(parseFloat(this.style.top)-5)+"%;left:"+(parseFloat(this.style.left)+6)+"%;";
      popup.innerHTML='<div class="vdp-head"><span class="vdp-type damage">Cosmetic</span><span class="vdp-close">&times;</span></div><div class="vdp-title">'+d.loc+'</div><div class="vdp-note">'+d.note+'</div>';
      stage.appendChild(popup);
      popup.querySelector(".vdp-close").addEventListener("click",function(){popup.remove();});
    });
  });

  // LVS booking
  var lvsBtn=document.getElementById("vdLvsBtn");
  if(lvsBtn) lvsBtn.addEventListener("click",function(){openCocBooking(car);});

  // VIR ring animation — only when a real score exists
  var arc=document.getElementById("vdScoreArc"), scoreVal=document.getElementById("vdScoreVal");
  if(arc&&scoreVal&&virScore!==null){
    setTimeout(function(){arc.style.strokeDashoffset=Math.round(239-(239*virScore/100));},60);
    var t0=Date.now();
    var cnt=setInterval(function(){
      var p=Math.min(1,(Date.now()-t0)/1100), e=1-Math.pow(1-p,3);
      scoreVal.textContent=Math.round(virScore*e);
      if(p>=1) clearInterval(cnt);
    },30);
  }

  // share — hand over a real, clickable link to THIS car
  var shareBtn=document.getElementById("vdShareBtn");
  if(shareBtn) shareBtn.addEventListener("click",function(){
    var shareUrl=carShareUrl(car);
    var label=(car.yr+" "+car.make+" "+car.name).replace(/\s+/g," ").trim();
    var blurb="Check out this "+label+" at "+DEALER+" — "+fmtR(car.price)+" (from "+fmtR(pm)+"/pm). Inspected, finance available.";
    var txt=blurb+" "+shareUrl;
    function toast(){
      var t=document.createElement("div");t.className="vd-share-toast";t.textContent="Link copied — paste it to anyone on WhatsApp";
      document.body.appendChild(t);setTimeout(function(){t.classList.add("show");},20);
      setTimeout(function(){t.classList.remove("show");setTimeout(function(){t.remove();},400);},2600);
    }
    // Native share sheet (mobile) is the best experience — pass url separately
    if(navigator.share){
      navigator.share({title:label+" — "+DEALER,text:blurb,url:shareUrl}).catch(function(){});
      return;
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(toast,function(){window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");});
    }else{window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");}
  });
};

window.closeVehicleDetail = function(){
  var ov=document.getElementById("vdOverlay");
  if(!ov) return;
  ov.classList.remove("open");
  ov.setAttribute("aria-hidden","true");
  ov.removeAttribute("aria-modal");
  document.body.classList.remove("vd-lock");
  vdRemoveMbar();   // it lives on <body> now, so closing the overlay won't hide it
  // hand focus back to whatever opened it
  if(VD_LAST_FOCUS && document.contains(VD_LAST_FOCUS)){
    try{ VD_LAST_FOCUS.focus(); }catch(e){}
  }
  VD_LAST_FOCUS = null;
};

window.openCocBooking = function(car){
  var bg=document.getElementById("vdBookingBg");
  if(!bg){bg=document.createElement("div");bg.className="vd-booking-bg";bg.id="vdBookingBg";document.body.appendChild(bg);}
  var days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], slots=[], now=new Date();
  for(var i=1;i<=6;i++){
    var d=new Date(now);d.setDate(d.getDate()+i);
    if(d.getDay()===0) continue;
    var label=days[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1);
    var times=d.getDay()===6?["09:00","10:00","11:00"]:["09:00","10:00","11:00","14:00","15:00","16:00"];
    slots.push({label:label,times:times});
  }
  bg.innerHTML='<div class="vd-booking">'
    +'<div class="vd-booking-head"><div style="display:flex;align-items:center;gap:10px"><img src="coc-mark.svg" alt=""><h3>Book a workshop viewing</h3></div><span class="vd-booking-close" id="vdBookingClose">&times;</span></div>'
    +'<div class="sub">Drive in to 257 Caledon Street — we\'ll have the car ready for a walk-around, cold start and test drive.</div>'
    +'<div class="vd-booking-car"><div class="bk-img" style="'+phStyle(car.img)+'"></div><div><div class="bk-name">'+car.yr+' '+car.make+' '+car.name+'</div><div class="bk-price">'+fmtR(car.price)+'</div></div></div>'
    +'<div class="vd-slot-label">Select a day</div><div class="vd-slot-grid" id="vdDayGrid">'
    +slots.map(function(s,i){return '<div class="vd-slot'+(i===0?" on":"")+'" data-day="'+i+'"><div class="day">'+s.label.split(" ")[0]+'</div>'+s.label.split(" ")[1]+'</div>';}).join("")
    +'</div><div class="vd-slot-label">Select a time</div><div class="vd-slot-grid" id="vdTimeGrid">'
    +slots[0].times.map(function(t,i){return '<div class="vd-slot'+(i===0?" on":"")+'" data-time="'+t+'">'+t+'</div>';}).join("")
    +'</div>'
    +'<label class="vd-trade-opt" for="vdTradeChk"><input type="checkbox" id="vdTradeChk">'
    +'<span><b>I have a trade-in</b> — TruInspect it on the same visit and hand me a firm workshop offer, market-related.</span></label>'
    +'<button class="vd-booking-confirm" id="vdBookConfirm">Confirm &amp; WhatsApp</button>'
    +'<div class="vd-booking-note">We\'ll confirm the workshop slot on WhatsApp. No charge, no obligation.</div>'
    +'</div>';
  bg.classList.add("open");
  bg.querySelector("#vdBookingClose").addEventListener("click",function(){bg.classList.remove("open");});
  bg.addEventListener("click",function(e){if(e.target===bg) bg.classList.remove("open");});
  var dayGrid=bg.querySelector("#vdDayGrid"), timeGrid=bg.querySelector("#vdTimeGrid"), selDay=0;
  function bindTimes(){timeGrid.querySelectorAll(".vd-slot").forEach(function(ts){ts.addEventListener("click",function(){timeGrid.querySelectorAll(".vd-slot").forEach(function(x){x.classList.remove("on");});this.classList.add("on");});});}
  dayGrid.querySelectorAll(".vd-slot").forEach(function(s){s.addEventListener("click",function(){
    dayGrid.querySelectorAll(".vd-slot").forEach(function(x){x.classList.remove("on");});this.classList.add("on");
    selDay=+this.dataset.day;
    timeGrid.innerHTML=slots[selDay].times.map(function(t,i){return '<div class="vd-slot'+(i===0?" on":"")+'" data-time="'+t+'">'+t+'</div>';}).join("");
    bindTimes();
  });});
  bindTimes();
  bg.querySelector("#vdBookConfirm").addEventListener("click",function(){
    var dayEl=dayGrid.querySelector(".vd-slot.on"), timeEl=timeGrid.querySelector(".vd-slot.on");
    var dayTxt=dayEl?dayEl.textContent.trim():"", timeTxt=timeEl?(timeEl.dataset.time||timeEl.textContent.trim()):"";
    var trade=bg.querySelector("#vdTradeChk");
    var msg=encodeURIComponent("Hi "+DEALER+", I'd like to book a workshop viewing of the "+car.yr+" "+car.make+" "+car.name+" ("+fmtR(car.price)+") on "+dayTxt+" at "+timeTxt+"."
      +(trade&&trade.checked?" I also have a trade-in — please TruInspect it on the same visit and hand me a firm workshop offer.":"")
      +" Please confirm.");
    window.open("https://wa.me/"+WA+"?text="+msg,"_blank");
    bg.classList.remove("open");
  });
};

// ===== wire grid card clicks =====
document.addEventListener("DOMContentLoaded",function(){
  ensureOverlay();
  var grid=document.getElementById("invgrid");
  if(!grid) return;
  grid.addEventListener("click",function(e){
    var btn=e.target.closest("[data-vd]");
    if(btn){
      var l=window.COC_SHOWN||[];
      if(l[+btn.getAttribute("data-vd")]) openVehicleDetail(l[+btn.getAttribute("data-vd")]);
      return;
    }
    if(e.target.closest("a")||e.target.closest(".cta-row")||e.target.closest(".fav-btn")) return;
    var card=e.target.closest(".card");
    if(!card) return;
    var idx=+card.getAttribute("data-idx");
    var list=window.COC_SHOWN||[];
    if(list[idx]) openVehicleDetail(list[idx]);
  });
});
})();
