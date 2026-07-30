/* Ridgeline Vehicle Detail Upgrade — Tru3D, VIR, TruLens AI, TruPrice, Booking */
(function(){

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

window.openVehicleDetail = function(car){
  var _fmtR = window.fmtR || Ridgeline.fmtR || function(n){return "$"+Number(n||0).toLocaleString("en-US");};
  var _monthly = window.monthly || Ridgeline.monthly || function(p,d,t){d=d||.1;t=t||72;var r=.1175/12;return Math.round(p*(1-d)*r/(1-Math.pow(1+r,-t)));};
  var _WA = window.WA || "15125550142";

  var wa = encodeURIComponent("Hi Ridgeline, I'm interested in the "+car.y+" "+car.make+" "+car.name+" ("+_fmtR(car.price)+") - "+car.tag+". Is it still available?");
  var waReserve = encodeURIComponent("Hi Ridgeline, I'd like to reserve the "+car.y+" "+car.make+" "+car.name+" ("+_fmtR(car.price)+") with the $2 500 refundable deposit");
  var waFinance = encodeURIComponent("Hi Ridgeline, I'd like to apply for finance on the "+car.y+" "+car.make+" "+car.name+" ("+_fmtR(car.price)+")");
  var catClass = car.cat==="performance"?"background:linear-gradient(145deg,#ef4444,#b91c1c)":car.cat==="select"?"background:linear-gradient(145deg,var(--gold-light),var(--gold));color:var(--ink)":"background:linear-gradient(145deg,var(--blue-bright),var(--blue))";
  var bodyName = {suv:"SUV",truck:"Truck",hatch:"Hatchback",sedan:"Sedan",coupe:"Coupe"}[car.body]||car.body;
  var pm = _monthly(car.price);
  var virScore = Math.round((parseFloat(car.vir||"4.5")/5)*100);
  // TruPrice: real comparison against the car's own truPrice benchmark (not a
  // hash of its own listing price) — same mechanism as the True-Cars flagship.
  var tpDelta = (typeof Ridgeline !== "undefined" && Ridgeline.priceDelta) ? Ridgeline.priceDelta(car) : { below: false, amount: 0, pct: 0 };
  var tpRatio = car.price / (car.truPrice || car.price || 1);
  var tpPos = Math.min(96, Math.max(4, ((tpRatio - 0.85) / 0.30) * 100));
  var tpVerdict = !tpDelta.below
    ? "Fair market price"
    : (tpDelta.pct >= 8 ? "Great deal — " : "Good price — ") + _fmtR(tpDelta.amount) + " below TruPrice";
  var tpColor = tpDelta.below ? "var(--gold-light,#E8B76A)" : "var(--grey,#7A8494)";
  var mockPanels = 12, mockFindings = MOCK_DMG.length, mockRepairCost = "$"+((Math.floor((car.price%89)/89*8)+4)*100);

  var vdContent = document.getElementById("vdContent");
  var vdOverlay = document.getElementById("vdOverlay");

  vdContent.innerHTML =
    '<div>'
    +'<div class="vd-gallery">'
    +'<div class="vd-hero-img">'
    +'<div class="im" style="background-image:linear-gradient(180deg,transparent 60%,rgba(10,22,38,.3)),url(\''+car.img+'\')"></div>'
    +'<div class="vd-vir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z"/></svg>VIR &#9733; '+(car.vir||"4.5")+'</div>'
    +'<div class="vd-cat" style="'+catClass+'">'+(car.tag||"Featured")+'</div>'
    +'</div>'
    +'<div class="vd-thumbs">'
    +'<div class="vd-thumb on"><div class="im" style="background-image:url(\''+car.img+'\')"></div></div>'
    +'<div class="vd-thumb"><div class="im" style="background:linear-gradient(135deg,var(--graphite),var(--carbon))"></div></div>'
    +'<div class="vd-thumb"><div class="im" style="background:linear-gradient(135deg,var(--carbon),var(--graphite))"></div></div>'
    +'</div></div>'

    +'<div class="vd-3d">'
    +'<div class="vd-3d-top">'
    +'<div><div class="vd-3d-title">'+car.y+' '+car.make+' '+car.name+'</div>'
    +'<div class="vd-3d-odo">Odometer: '+(car.km||"—")+'</div></div>'
    +'<div class="vd-3d-actions">'
    +'<button id="vdTagBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>Tags</button>'
    +'<button><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Watch</button>'
    +'<button><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>Fav</button>'
    +'</div></div>'

    +'<div class="vd-stage" id="vdStage">'
    +'<div class="vd-tt-disc"></div><div class="vd-tt-ring"></div>'
    +'<div class="vd-stage-car"><div class="im im-a" style="background-image:url(\''+car.img+'\')"></div><div class="im im-b" style="background-image:url(\''+car.img+'\')"></div></div>'
    +'<button class="vd-tag-toggle" id="vdTagToggle">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>'
    +'<span class="tt-off">Show tags</span><span class="tt-on" style="display:none">Hide tags</span></button>'
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
    +'<div class="vd-3d-thumb on">Front</div>'
    +'<div class="vd-3d-thumb">Side</div>'
    +'<div class="vd-3d-thumb">Rear</div>'
    +'<div class="vd-3d-thumb">Interior</div>'
    +'<div class="vd-3d-thumb">Engine</div>'
    +'</div></div>'

    +'<div class="vd-vir-report">'
    +'<div class="vd-vir-eyebrow" style="display:flex;align-items:center;gap:8px"><img src="demo-logo.svg" alt="" style="width:22px;height:22px;border-radius:6px;object-fit:cover">Verified Inspection Report</div>'
    +'<div class="vd-vir-score">'
    +'<div class="vd-score-ring">'
    +'<svg width="88" height="88" viewBox="0 0 88 88"><circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>'
    +'<circle id="vdScoreArc" cx="44" cy="44" r="38" fill="none" stroke="url(#vdsg)" stroke-width="7" stroke-linecap="round" stroke-dasharray="239" stroke-dashoffset="239" style="transition:stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)"/>'
    +'<defs><linearGradient id="vdsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--blue-bright)"/><stop offset="1" stop-color="var(--blue)"/></linearGradient></defs></svg>'
    +'<div class="val"><b id="vdScoreVal">0</b><span>/ 100</span></div></div>'
    +'<div><div class="vd-vir-verdict">'+(virScore>=90?"Excellent condition":virScore>=75?"Good condition":"Fair condition")+'</div>'
    +'<p class="vd-vir-desc">Independently inspected across 128 checkpoints. Findings tagged on the Tru3D orbit above.</p></div></div>'
    +'<div class="vd-vir-checks">'
    +MOCK_CHECKS.map(function(c){return '<div class="vd-vir-check '+(c.ok?"ok":"warn")+'">'+(c.ok?svgCheck():svgWarn())+c.label+'</div>';}).join("")
    +'</div>'
    +'<div class="vd-dmg-list">'
    +MOCK_DMG.map(function(d,i){return '<div class="vd-dmg'+(d.type==="note"?" note":"")+'">'
      +'<div class="di">'+(i+1)+'</div><div><b>'+d.loc+'</b><p>'+d.note+'</p></div></div>';}).join("")
    +'</div>'

    +'<div class="vd-tchek">'
    +'<div class="vd-tchek-head">'
    +'<div class="vd-tchek-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>AI Damage Analysis</div>'
    +'<div class="vd-tchek-powered">TruVIR &middot; Powered by <b>TruLens AI</b></div></div>'
    +'<p class="vd-tchek-desc">Every panel, surface and interior zone scanned by TruLens AI — detecting damage at 95% accuracy, classifying severity, and estimating repair cost before the vehicle reaches the showroom floor.</p>'
    +'<div class="vd-tchek-grid">'
    +'<div class="vd-tchek-stat"><div class="vd-tchek-icon ok">'+svgCheck()+'</div><div><div class="vd-tchek-val">'+mockPanels+' / '+mockPanels+'</div><div class="vd-tchek-lbl">Panels clear</div></div></div>'
    +'<div class="vd-tchek-stat"><div class="vd-tchek-icon warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg></div><div><div class="vd-tchek-val">'+mockFindings+' minor</div><div class="vd-tchek-lbl">Cosmetic findings</div></div></div>'
    +'<div class="vd-tchek-stat"><div class="vd-tchek-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.9 4.9l2.8 2.8m8.5 8.5l2.8 2.8M2 12h4m12 0h4M4.9 19.1l2.8-2.8m8.5-8.5l2.8-2.8"/></svg></div><div><div class="vd-tchek-val">'+mockRepairCost+'</div><div class="vd-tchek-lbl">Est. repair cost</div></div></div>'
    +'</div>'
    +'<div class="vd-tchek-conf"><div class="vd-tchek-conf-bar"><div class="vd-tchek-conf-fill" style="width:95%"></div></div><span>95% AI confidence &middot; TruLens AI</span></div>'
    +'</div>'
    +'</div>'
    +'</div>'

    +'<div class="vd-buy">'
    +'<div class="vd-crumb">Ridgeline Motors / '+(car.tag||"Featured")+' / '+car.make+'</div>'
    +'<h1>'+car.y+' '+car.make+' '+car.name+'</h1>'
    +'<div class="vd-variant">'+(car.variant||"")+' &middot; '+bodyName+'</div>'
    +'<div class="vd-price-block"><div class="vd-price">'+_fmtR(car.price)+'</div>'
    +'<div class="vd-pm">From <b>'+_fmtR(pm)+'/pm</b> over 72 months</div></div>'

    +'<div class="vd-truprice">'
    +'<div class="vd-tp-verdict" style="color:'+tpColor+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'+tpVerdict+'</div>'
    +'<div class="vd-tp-bar"><i style="width:'+tpPos+'%'+(tpDelta.below?'':';background:linear-gradient(90deg,var(--grey,#7A8494),var(--blue))')+'"></i><div class="vd-tp-marker" style="left:'+tpPos+'%'+(tpDelta.below?'':';border-color:var(--grey,#7A8494)')+'"></div></div>'
    +'<div class="vd-tp-labels"><span>Below market</span><span>Market avg</span><span>Above market</span></div>'
    +'</div>'

    +'<div class="vd-spec-grid">'
    +'<div class="vd-spec"><div class="l">Year</div><div class="v">'+car.y+'</div></div>'
    +'<div class="vd-spec"><div class="l">Mileage</div><div class="v">'+(car.km||"—")+'</div></div>'
    +'<div class="vd-spec"><div class="l">Fuel</div><div class="v">'+(car.fuel||"—")+'</div></div>'
    +'<div class="vd-spec"><div class="l">Transmission</div><div class="v">'+(car.tr||"—")+'</div></div>'
    +'<div class="vd-spec"><div class="l">Body</div><div class="v">'+bodyName+'</div></div>'
    +'<div class="vd-spec"><div class="l">VIR Grade</div><div class="v">&#9733; '+(car.vir||"4.5")+' / 5.0</div></div>'
    +'<div class="vd-spec"><div class="l">Colour</div><div class="v">'+(car.colour||"See images")+'</div></div>'
    +'<div class="vd-spec"><div class="l">Category</div><div class="v">'+(car.tag||"Featured")+'</div></div>'
    +'</div>'

    +'<div class="vd-actions">'
    +'<a class="btn btn-blue" style="width:100%;justify-content:center;padding:14px;font-size:14px;border-radius:14px;background:linear-gradient(135deg,var(--blue),var(--blue-deep));color:#fff;border:none" href="https://wa.me/'+_WA+'?text='+waReserve+'" target="_blank" rel="noopener">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M9 12l2 2 4-5"/><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/></svg>'
    +'<span>Reserve this car &middot; $2 500 refundable</span></a>'
    +'<div class="row2">'
    +'<a class="btn btn-dark" href="https://wa.me/'+_WA+'?text='+encodeURIComponent("Hi Ridgeline, I'd like a test drive of the "+car.y+" "+car.make+" "+car.name)+'" target="_blank" rel="noopener">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M3 12h18M3 12l4-7h10l4 7M6 17h.01M18 17h.01"/></svg>'
    +'Test drive</a>'
    +'<button class="btn btn-dark" id="vdLvsBtn">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'
    +'Book LVS</button>'
    +'</div>'
    +'<a class="btn btn-wa" href="https://wa.me/'+_WA+'?text='+wa+'" target="_blank" rel="noopener" style="width:100%;justify-content:center">'
    +'<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.3.4-.1.7.2.3.8 1.4 1.8 2.2 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2.1 1c.3.2.5.3.6.4.1.2.1.7-.1 1.3-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.2c.1.2.1.4 0 .6l-.4.6-.5.5z"/></svg>'
    +'Text — I\'m interested</a>'
    +'<a class="btn btn-ghost" href="https://wa.me/'+_WA+'?text='+waFinance+'" target="_blank" rel="noopener" style="width:100%;justify-content:center">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M2 17l5-5 4 4 7-8M18 8h3v3"/></svg>'
    +'Apply for finance</a>'
    +'<button class="btn btn-ghost" id="vdShareBtn" style="width:100%;justify-content:center">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
    +'Share this car</button>'
    +'<a class="btn btn-ghost" href="#sell" onclick="closeVehicleDetail()" style="width:100%;justify-content:center">'
    +'Trade in my current car &rarr;</a>'
    +'</div>'

    +'<div class="vd-calc">'
    +'<h3>Finance estimator</h3>'
    +'<div class="sub">Indicative &middot; 11.75% linked rate &middot; VAF Bridge structures vary</div>'
    +'<div class="vd-calc-out"><div class="m" id="vdCalcM">'+_fmtR(pm)+'<small>/pm</small></div></div>'
    +'<div class="cr"><div class="top"><span>Deposit</span><b id="vdDepV">10%</b></div>'
    +'<input type="range" id="vdDep" min="0" max="40" step="5" value="10" data-price="'+car.price+'"></div>'
    +'<div class="cr"><div class="top"><span>Term</span><b id="vdTermV">72 months</b></div>'
    +'<input type="range" id="vdTerm" min="24" max="84" step="6" value="72"></div>'
    +'</div>'
    +'<div class="vd-trust">'
    +'<span><i style="background:var(--wa)"></i>Available now</span>'
    +'<span><i style="background:var(--blue)"></i>Nationwide delivery</span>'
    +'<span><i style="background:var(--gold)"></i>ASE Certified</span>'
    +'</div></div>'

    +'<div class="vd-mbar">'
    +'<div class="mb-price"><b>'+_fmtR(car.price)+'</b><span>'+_fmtR(pm)+'/pm</span></div>'
    +'<a class="mb-reserve" href="https://wa.me/'+_WA+'?text='+waReserve+'" target="_blank" rel="noopener">Reserve</a>'
    +'<a class="mb-wa" href="https://wa.me/'+_WA+'?text='+wa+'" target="_blank" rel="noopener">Text</a>'
    +'</div>';

  vdOverlay.classList.add("open");
  vdOverlay.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  vdOverlay.scrollTop = 0;
  window._vdCar = car;

  // finance calc
  var vdDep = document.getElementById("vdDep");
  var vdTerm = document.getElementById("vdTerm");
  if(vdDep && vdTerm){
    function vdCalc(){
      var d = +vdDep.value/100, t = +vdTerm.value, p = +vdDep.dataset.price;
      document.getElementById("vdDepV").textContent = vdDep.value+"%";
      document.getElementById("vdTermV").textContent = t+" months";
      document.getElementById("vdCalcM").innerHTML = _fmtR(_monthly(p,d,t))+"<small>/pm</small>";
      [vdDep,vdTerm].forEach(function(el){el.style.setProperty("--fill",((el.value-el.min)/(el.max-el.min)*100)+"%");});
    }
    vdDep.addEventListener("input",vdCalc);
    vdTerm.addEventListener("input",vdCalc);
    vdCalc();
  }

  // tag toggle
  var tagToggle = document.getElementById("vdTagToggle");
  var tagBtn = document.getElementById("vdTagBtn");
  var stage = document.getElementById("vdStage");
  function toggleTags(){
    stage.classList.toggle("tags-on");
    var on = stage.classList.contains("tags-on");
    tagToggle.classList.toggle("on",on);
    tagToggle.querySelector(".tt-off").style.display = on?"none":"inline";
    tagToggle.querySelector(".tt-on").style.display = on?"inline":"none";
    if(tagBtn) tagBtn.classList.toggle("on",on);
  }
  if(tagToggle) tagToggle.addEventListener("click",toggleTags);
  if(tagBtn) tagBtn.addEventListener("click",toggleTags);

  // drag-to-spin mock
  var dragX=0,deg=0,dragging=false;
  if(stage){
    stage.addEventListener("pointerdown",function(e){dragging=true;dragX=e.clientX;stage.classList.add("grabbing");stage.setPointerCapture(e.pointerId);});
    stage.addEventListener("pointermove",function(e){
      if(!dragging)return;
      deg=(deg+(e.clientX-dragX)*.5)%360;if(deg<0)deg+=360;
      dragX=e.clientX;
      document.getElementById("vdDeg").textContent=Math.round(deg)+"°";
      // cross-fade to the mirrored angle through the "far side" of the orbit
      stage.classList.toggle("flip", deg>=90&&deg<270);
      // subtle perspective drift sells the turntable illusion
      var carEl=stage.querySelector(".vd-stage-car");
      if(carEl){var rad=deg*Math.PI/180;carEl.style.transform="translateX("+(Math.sin(rad)*3)+"%) scale("+(1-Math.abs(Math.sin(rad))*.04)+")";}
    });
    stage.addEventListener("pointerup",function(){dragging=false;stage.classList.remove("grabbing");});
  }

  // tag pin popups
  document.querySelectorAll(".vd-tag-pin").forEach(function(pin){
    pin.addEventListener("click",function(e){
      e.stopPropagation();
      document.querySelectorAll(".vd-tag-popup").forEach(function(p){p.remove();});
      var idx = +this.dataset.idx;
      var d = MOCK_DMG[idx]||MOCK_DMG[0];
      var popup = document.createElement("div");
      popup.className = "vd-tag-popup damage";
      popup.style.cssText = "top:"+(parseFloat(this.style.top)-5)+"%;left:"+(parseFloat(this.style.left)+6)+"%;";
      popup.innerHTML = '<div class="vdp-head"><span class="vdp-type damage">Cosmetic</span><span class="vdp-close">&times;</span></div>'
        +'<div class="vdp-title">'+d.loc+'</div><div class="vdp-note">'+d.note+'</div>';
      stage.appendChild(popup);
      popup.querySelector(".vdp-close").addEventListener("click",function(){popup.remove();});
    });
  });

  // LVS booking modal
  var lvsBtn = document.getElementById("vdLvsBtn");
  if(lvsBtn) lvsBtn.addEventListener("click",function(){openBookingModal(car);});

  // VIR score ring — animate arc + count up from 0
  var arc = document.getElementById("vdScoreArc");
  var scoreVal = document.getElementById("vdScoreVal");
  if(arc && scoreVal){
    setTimeout(function(){arc.style.strokeDashoffset = Math.round(239-(239*virScore/100));},60);
    var t0 = Date.now();
    var cnt = setInterval(function(){
      var p = Math.min(1,(Date.now()-t0)/1100);
      var e = 1-Math.pow(1-p,3);
      scoreVal.textContent = Math.round(virScore*e);
      if(p>=1) clearInterval(cnt);
    },30);
  }

  // share this car — copy Text-ready message
  var shareBtn = document.getElementById("vdShareBtn");
  if(shareBtn){
    shareBtn.addEventListener("click",function(){
      var shareText = "Check out this "+car.y+" "+car.make+" "+car.name+" at Ridgeline Motors — "+_fmtR(car.price)+" (from "+_fmtR(pm)+"/pm). VIR-inspected, nationwide delivery. https://wa.me/"+_WA;
      function done(){
        var toast = document.createElement("div");
        toast.className = "vd-share-toast";
        toast.textContent = "Copied — paste it to anyone on Text";
        document.body.appendChild(toast);
        setTimeout(function(){toast.classList.add("show");},20);
        setTimeout(function(){toast.classList.remove("show");setTimeout(function(){toast.remove();},400);},2600);
      }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(shareText).then(done,function(){
          window.open("https://wa.me/?text="+encodeURIComponent(shareText),"_blank");
        });
      }else{
        window.open("https://wa.me/?text="+encodeURIComponent(shareText),"_blank");
      }
    });
  }
};

window.closeVehicleDetail = function(){
  var vdOverlay = document.getElementById("vdOverlay");
  vdOverlay.classList.remove("open");
  vdOverlay.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
};

window.openBookingModal = function(car){
  var _fmtR = window.fmtR || Ridgeline.fmtR || function(n){return "$"+Number(n||0).toLocaleString("en-US");};
  var _WA = window.WA || "15125550142";
  var bg = document.getElementById("vdBookingBg");
  if(!bg){
    bg = document.createElement("div");
    bg.className = "vd-booking-bg";
    bg.id = "vdBookingBg";
    document.body.appendChild(bg);
  }
  var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var slots = [];
  var now = new Date();
  for(var i=1;i<=6;i++){
    var d = new Date(now);d.setDate(d.getDate()+i);
    if(d.getDay()===0) continue;
    var label = days[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1);
    var times = d.getDay()===6?["09:00","10:00","11:00"]:["09:00","10:00","11:00","14:00","15:00","16:00"];
    slots.push({label:label,times:times});
  }
  bg.innerHTML = '<div class="vd-booking">'
    +'<div class="vd-booking-head"><div style="display:flex;align-items:center;gap:10px"><img src="demo-logo.svg" alt="Ridgeline" style="width:34px;height:34px;border-radius:9px;object-fit:cover;flex-shrink:0"><h3>Book a live video viewing</h3></div><span class="vd-booking-close" id="vdBookingClose">&times;</span></div>'
    +'<div class="sub">We\'ll walk this car live on video — cold start, engine bay, underbody — you direct the camera.</div>'
    +'<div class="vd-booking-car"><div class="bk-img" style="background-image:url(\''+car.img+'\')"></div>'
    +'<div><div class="bk-name">'+car.y+' '+car.make+' '+car.name+'</div><div class="bk-price">'+_fmtR(car.price)+'</div></div></div>'
    +'<div class="vd-slot-label">Select a day</div>'
    +'<div class="vd-slot-grid" id="vdDayGrid">'
    +slots.map(function(s,i){return '<div class="vd-slot'+(i===0?" on":"")+'" data-day="'+i+'"><div class="day">'+s.label.split(" ")[0]+'</div>'+s.label.split(" ")[1]+'</div>';}).join("")
    +'</div>'
    +'<div class="vd-slot-label">Select a time</div>'
    +'<div class="vd-slot-grid" id="vdTimeGrid">'
    +slots[0].times.map(function(t,i){return '<div class="vd-slot'+(i===0?" on":"")+'" data-time="'+t+'">'+t+'</div>';}).join("")
    +'</div>'
    +'<button class="vd-booking-confirm" id="vdBookConfirm">Confirm &amp; Text</button>'
    +'<div class="vd-booking-note">You\'ll be connected to our showroom team on Text to confirm the viewing. No charge, no obligation.</div>'
    +'</div>';
  bg.classList.add("open");
  bg.querySelector("#vdBookingClose").addEventListener("click",function(){bg.classList.remove("open");});
  bg.addEventListener("click",function(e){if(e.target===bg) bg.classList.remove("open");});

  var dayGrid = bg.querySelector("#vdDayGrid");
  var timeGrid = bg.querySelector("#vdTimeGrid");
  var selDay = 0;

  function bindTimeSlots(){
    timeGrid.querySelectorAll(".vd-slot").forEach(function(ts){
      ts.addEventListener("click",function(){timeGrid.querySelectorAll(".vd-slot").forEach(function(x){x.classList.remove("on");});this.classList.add("on");});
    });
  }
  dayGrid.querySelectorAll(".vd-slot").forEach(function(s){
    s.addEventListener("click",function(){
      dayGrid.querySelectorAll(".vd-slot").forEach(function(x){x.classList.remove("on");});
      this.classList.add("on");
      selDay = +this.dataset.day;
      timeGrid.innerHTML = slots[selDay].times.map(function(t,i){return '<div class="vd-slot'+(i===0?" on":"")+'" data-time="'+t+'">'+t+'</div>';}).join("");
      bindTimeSlots();
    });
  });
  bindTimeSlots();

  bg.querySelector("#vdBookConfirm").addEventListener("click",function(){
    var dayEl = dayGrid.querySelector(".vd-slot.on");
    var timeEl = timeGrid.querySelector(".vd-slot.on");
    var dayTxt = dayEl?dayEl.textContent.trim():"";
    var timeTxt = timeEl?timeEl.dataset.time||timeEl.textContent.trim():"";
    var msg = encodeURIComponent("Hi Ridgeline, I'd like to book a live video viewing of the "+car.y+" "+car.make+" "+car.name+" ("+_fmtR(car.price)+") on "+dayTxt+" at "+timeTxt+". Please confirm.");
    window.open("https://wa.me/"+_WA+"?text="+msg,"_blank");
    bg.classList.remove("open");
  });
};

// Wire up close/escape on any page that has the overlay
document.addEventListener("DOMContentLoaded",function(){
  var vdClose = document.getElementById("vdClose");
  var vdOverlay = document.getElementById("vdOverlay");
  if(vdClose) vdClose.addEventListener("click", closeVehicleDetail);
  if(vdOverlay){
    vdOverlay.addEventListener("click", function(e){if(e.target===vdOverlay) closeVehicleDetail();});
    document.addEventListener("keydown", function(e){if(e.key==="Escape"&&vdOverlay.classList.contains("open")) closeVehicleDetail();});
  }
});

})();
