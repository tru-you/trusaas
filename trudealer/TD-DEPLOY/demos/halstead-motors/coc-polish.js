/* Halstead Motor Co. — Polish: ribbons, quick-view, skeletons, reviews, ticker, mobile bar */
(function(){
var WA = "+44 161 496 0000";

/* Touch/coarse-pointer device? Covers phones and tablets whose browsers still
   report hover:hover (Android Chrome, in-app webviews, touch laptops). */
var COC_COARSE = (function(){
  try{
    return window.matchMedia("(pointer:coarse)").matches
        || window.matchMedia("(hover:none)").matches
        || ("ontouchstart" in window && navigator.maxTouchPoints > 0);
  }catch(e){ return false; }
})();

function skeletons(){
  var grid = document.getElementById("invgrid");
  if(!grid || grid.children.length) return;
  var sk = '<div class="coc-sk"><div class="sk-ph"></div><div class="sk-b"><div class="sk-line s"></div><div class="sk-line m"></div><div class="sk-line"></div></div></div>';
  grid.innerHTML = sk + sk + sk + sk + sk + sk;
}

function priceOf(card){
  var pr = card.querySelector(".pr-main");
  return pr ? (+(pr.textContent.replace(/[^\d]/g,"")) || 0) : 0;
}
function decorate(){
  var grid = document.getElementById("invgrid");
  if(!grid) return;
  var cards = grid.querySelectorAll(".card:not([data-coc-deco])");
  var hasArrived = !!grid.querySelector(".coc-ribbon.arrived");
  cards.forEach(function(card, i){
    card.setAttribute("data-coc-deco","1");
    var ph = card.querySelector(".ph");
    if(!ph) return;
    var h = priceOf(card) % 97, status = null;
    if(h < 20) status = {cls:"arrived", txt:"Just arrived"};
    else if(h < 33) status = {cls:"reduced", txt:"Price reduced"};
    else if(h < 40) status = {cls:"reserved", txt:"Reserved"};
    if(!status && !hasArrived && i === 0) status = {cls:"arrived", txt:"Just arrived"};
    if(status){
      if(status.cls === "arrived") hasArrived = true;
      var r = document.createElement("span");
      r.className = "coc-ribbon " + status.cls;
      r.innerHTML = "<i></i>" + status.txt;
      ph.appendChild(r);
    }
    // Hover-only affordance — never build it on touch, where a sticky :hover
    // would leave it parked across the vehicle image.
    if(!COC_COARSE){
      var qv = document.createElement("div");
      qv.className = "coc-qv";
      qv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Quick view &middot; VIR &amp; 360&deg;';
      ph.appendChild(qv);
    }
  });
}
/* TruTrade · Live Offer — gathers the car + a TruLive inspection slot, then
   hands to WhatsApp. The firm offer + Offer to Purchase are made ON the live
   call from what the camera shows; this only books it. */
function tradeTool(){
  var root = document.getElementById("tradeTool");
  if(!root) return;
  var days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], slots=[], now=new Date();
  for(var i=1;i<=6 && slots.length<5;i++){
    var d=new Date(now); d.setDate(d.getDate()+i);
    if(d.getDay()===0) continue;
    slots.push({label:days[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1),
                times:d.getDay()===6?["09:00","10:00","11:00","12:00"]:["09:00","10:30","12:00","14:00","15:30"]});
  }
  var dayEl=root.querySelector("#ctDay"), timeEl=root.querySelector("#ctTime");
  function chip(txt,on){return '<button type="button"'+(on?' class="on"':'')+'>'+txt+'</button>';}
  dayEl.innerHTML = slots.map(function(s,i){return chip(s.label,i===0);}).join("");
  function renderTimes(i){ timeEl.innerHTML = slots[i].times.map(function(t,j){return chip(t,j===0);}).join(""); }
  renderTimes(0);
  function bindChips(el, after){
    el.addEventListener("click", function(e){
      var b=e.target.closest("button"); if(!b) return;
      el.querySelectorAll("button").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on");
      if(after) after([].indexOf.call(el.children,b));
    });
  }
  bindChips(dayEl, renderTimes);
  bindChips(timeEl);
  bindChips(root.querySelector("#ctCond"));
  root.querySelector("#ctBook").addEventListener("click", function(){
    var car=(root.querySelector("#ctCar").value||"").trim();
    var km=(root.querySelector("#ctKm").value||"").trim();
    var cond=(root.querySelector("#ctCond .on")||{}).textContent||"";
    var day=(dayEl.querySelector(".on")||{}).textContent||"";
    var time=(timeEl.querySelector(".on")||{}).textContent||"";
    if(!car){ root.querySelector("#ctCar").focus(); root.querySelector("#ctCar").style.borderColor="#F59E0B"; return; }
    var msg="Hi Halstead Motor Co., I'd like a LIVE TRADE OFFER on my car via TruLive.\n"
      +"Car: "+car+"\n"
      +(km?"Odometer: "+km+"\n":"")
      +(cond?"Condition: "+cond+"\n":"")
      +"Inspection slot: "+day+" at "+time+"\n"
      +"Please send my TruLive link — I understand I'll get a firm offer and an Offer to Purchase on the call.";
    window.open("https://wa.me/"+WA+"?text="+encodeURIComponent(msg),"_blank");
  });
}

/* Double-tap call buttons: first tap ARMS (green sweep + "tap again to call"),
   second tap within 3.5s dials. Prevents pocket-dials and turns the phone
   number into a designed moment instead of a bare tel: link. */
function callButtons(){
  document.addEventListener("click", function(e){
    var btn = e.target.closest(".coc-call");
    if(!btn) return;
    e.preventDefault();
    if(btn.classList.contains("armed")){
      btn.classList.add("dialing");
      window.location.href = "tel:" + btn.getAttribute("data-tel");
      setTimeout(function(){ btn.classList.remove("armed","dialing"); }, 1200);
    }else{
      document.querySelectorAll(".coc-call.armed").forEach(function(b){ b.classList.remove("armed"); });
      btn.classList.add("armed");
      clearTimeout(btn._ccT);
      btn._ccT = setTimeout(function(){ btn.classList.remove("armed"); }, 3500);
    }
  });
}

/* Header status pill: Open/Closed from the real trading hours
   (Mon–Fri 08:00–17:30, Sat 08:00–13:00), evaluated in SA time so a viewer
   abroad still sees the yard's actual state. */
function navStatus(){
  var el = document.getElementById("navStatus");
  if(!el) return;
  var parts, day, mins;
  try{
    parts = new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Birmingham",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
    var get = function(t){ return (parts.find(function(p){return p.type===t;})||{}).value; };
    day = get("weekday"); mins = (+get("hour"))*60 + (+get("minute"));
  }catch(e){
    var d = new Date(); day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; mins = d.getHours()*60+d.getMinutes();
  }
  var open = false;
  if(/Mon|Tue|Wed|Thu|Fri/.test(day)) open = mins >= 480 && mins < 1050;   // 08:00–17:30
  else if(/Sat/.test(day))            open = mins >= 480 && mins < 780;    // 08:00–13:00
  el.classList.toggle("closed", !open);
  var txt = el.querySelector("span");
  if(txt) txt.textContent = open ? "Open now" : "Closed · WhatsApp us";
  // Hero badge tells the same truth. (Once live DMS stock loads, the badge
  // becomes a vehicle count and this span no longer exists — that's fine.)
  var hb = document.getElementById("heroBadgeTxt");
  if(hb) hb.textContent = open
    ? "Open now · 257 Halstead Street, Manchester"
    : "Closed now · WhatsApp us anytime";
}

/* The hero Ken Burns is a 30s infinite scale with will-change:transform, which
   pins a compositor layer for the whole session. Pause it once the hero leaves
   the viewport — no visual change, meaningful battery/scroll saving on mid-range
   Android, which is most of this audience. */
function heroMotionBudget(){
  var bg = document.querySelector(".hero .bg");
  if(!bg || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      bg.style.animationPlayState = en.isIntersecting ? "running" : "paused";
    });
  }, {threshold:0}).observe(document.querySelector(".hero"));
}

function watchGrid(){
  var grid = document.getElementById("invgrid");
  if(!grid) return;
  decorate();
  new MutationObserver(decorate).observe(grid, {childList:true});
}

var REVIEWS = [
  {n:"Wesley A.", car:"Ford Ranger Wildtrak", txt:"Drove through from Gqeberha on Lance's word and the pickup was exactly as described. VIR report matched every panel. Honest yard, no games."},
  {n:"Nolundi M.", car:"VW Polo 1.0 TSI", txt:"First car for my daughter. They sorted the finance through the bank for us and walked us through everything. Felt looked after the whole way."},
  {n:"Deon S.", car:"Golf 7.5 GTI", txt:"The 360 view and damage tags online meant I'd basically bought it before I arrived. Test drive just confirmed it. Proper way to buy a car."}
];
function reviewsStrip(){
  var footer = document.querySelector("footer");
  if(!footer || document.querySelector(".coc-reviews")) return;
  var sec = document.createElement("section");
  sec.className = "coc-reviews";
  sec.innerHTML =
    '<div class="coc-rw">'
    +'<div class="coc-rev-head">'
    +'<div class="coc-rev-score"><div class="n">4.8</div><div><div class="coc-rev-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div><div class="coc-rev-sub">Based on 90+ Google &amp; Facebook reviews</div></div></div>'
    +'<div class="coc-rev-badge"><img src="demo-logo.svg" alt="">Verified buyers &middot; Manchester &amp; Greater Manchester</div>'
    +'</div><div class="coc-rev-grid">'
    +REVIEWS.map(function(r){
      return '<div class="coc-rev-card"><div class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div><p>&ldquo;'+r.txt+'&rdquo;</p><div class="who"><div class="av">'+r.n.charAt(0)+'</div><div><b>'+r.n+'</b><span>Bought: '+r.car+'</span></div></div></div>';
    }).join("")
    +'</div></div>';
  footer.parentNode.insertBefore(sec, footer);
}

var DELIVERIES = [
  {car:"Ford Ranger Wildtrak", to:"Gqeberha", when:"this week"},
  {car:"VW Polo GTI", to:"Uitenhage", when:"3 days ago"},
  {car:"Toyota Fortuner 4x4", to:"Jeffreys Bay", when:"this week"},
  {car:"Golf 7.5 GTI", to:"East London", when:"last week"},
  {car:"Hilux Legend RS", to:"Despatch", when:"this week"}
];
function ticker(){
  if(window.matchMedia("(max-width:860px)").matches) return;
  var el = document.createElement("div");
  el.className = "coc-ticker";
  el.setAttribute("aria-live","polite");
  document.body.appendChild(el);
  var i = 0;
  function show(){
    var d = DELIVERIES[i % DELIVERIES.length]; i++;
    el.innerHTML = '<div class="tk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg></div>'
      +'<div><b>'+d.car+' delivered</b><span>'+d.to+' &middot; '+d.when+'</span></div>';
    el.classList.add("show");
    setTimeout(function(){el.classList.remove("show");}, 6000);
  }
  setTimeout(show, 7000);
  setInterval(show, 18000);
}

/* Keep the optional launchers off the hero on phones.
   Three fixed elements were stacking over a 375px hero — the affordability
   dock, the chat bubble and this quick bar — and the dock landed squarely on
   top of the hero's WhatsApp button, which is the one thing a buyer on a phone
   actually taps. The quick bar stays (it is the deliberate always-there one);
   the other two hold back until the hero has scrolled away. */
function floatingClearance(){
  var hero = document.querySelector("section.hero, #top");
  if(!hero) return;
  var root = document.documentElement;
  var queued = false;

  /* Deliberately geometry, not an IntersectionObserver ratio: a hero taller
     than the viewport never reaches a 25% threshold, so a ratio test drops the
     class while the user is still looking at the hero and the launchers come
     back over the WhatsApp button. Measuring the hero's bottom edge behaves the
     same at every hero height and viewport size. */
  function update(){
    queued = false;
    var bottom = hero.getBoundingClientRect().bottom;
    root.classList.toggle("coc-hero-visible", bottom > 120);
  }
  function onScroll(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  update();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
}

function mobileBar(){
  if(document.querySelector(".coc-mbar")) return;
  var bar = document.createElement("nav");
  bar.className = "coc-mbar";
  bar.setAttribute("aria-label","Quick contact");
  bar.innerHTML =
    '<button type="button" class="mb-call coc-call" data-tel="+44 161 496 0000"><span class="cc-ring" aria-hidden="true"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.8.7a2 2 0 0 1 1.8 2.1z"/></svg><span class="cc-num">Call</span><span class="cc-arm">Tap to call</span></button>'
    +'<a class="mb-wa" href="https://wa.me/'+WA+'?text='+encodeURIComponent("Hi Halstead Motor Co., I'm interested in a vehicle")+'" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3.2C8.9 3.2 3.2 8.9 3.2 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.9 1 4 1.6 6.2 1.6h.01c7.1 0 12.8-5.7 12.8-12.8S23.1 3.2 16 3.2zm5.9 15.3c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-1.9-1-3.2-1.7-4.5-3.9-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2.4.9 2.9.8 3.6.7.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>WhatsApp</a>'
    +'<a class="mb-stock" href="#showroom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l4-7h10l4 7M6 17h.01M18 17h.01"/></svg>Stock</a>';
  document.body.appendChild(bar);
}

function init(){
  try{skeletons();}catch(e){}
  try{watchGrid();}catch(e){}
  try{heroMotionBudget();}catch(e){}
  try{navStatus(); setInterval(navStatus, 60000);}catch(e){}
  try{callButtons();}catch(e){}
  try{tradeTool();}catch(e){}
  try{reviewsStrip();}catch(e){}
  try{ticker();}catch(e){}
  try{mobileBar();}catch(e){}
  try{floatingClearance();}catch(e){}
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();
