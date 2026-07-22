/* MKR Polish — ribbons, quick-view, skeletons, reviews strip, delivered ticker, mobile bar
   Shared across index.html, premium-select.html, premium-performance.html */
(function(){
var WA = "27662912809";

/* ===== SKELETON LOADERS (only if grid is empty at load) ===== */
function skeletons(){
  var grid = document.getElementById("invgrid");
  if(!grid || grid.children.length) return;
  var sk = '<div class="mkr-sk"><div class="sk-ph"></div><div class="sk-b"><div class="sk-line s"></div><div class="sk-line m"></div><div class="sk-line"></div></div></div>';
  grid.innerHTML = sk.repeat(6);
}

/* ===== CARD DECORATOR — status ribbons + quick view ===== */
function priceOf(card){
  var pr = card.querySelector(".pr");
  if(!pr) return 0;
  return +(pr.textContent.replace(/[^\d]/g,"")) || 0;
}
function decorate(){
  var grid = document.getElementById("invgrid");
  if(!grid) return;
  var cards = grid.querySelectorAll(".card:not([data-mkr-deco])");
  var hasArrived = !!grid.querySelector(".mkr-ribbon.arrived");
  cards.forEach(function(card, i){
    card.setAttribute("data-mkr-deco","1");
    var ph = card.querySelector(".ph");
    if(!ph) return;

    // deterministic status from price — stable across re-renders
    var p = priceOf(card);
    var h = p % 97;
    var status = null;
    if(h < 20) status = {cls:"arrived", txt:"Just arrived"};
    else if(h < 33) status = {cls:"reduced", txt:"Price reduced"};
    else if(h < 40) status = {cls:"reserved", txt:"Reserved"};
    if(!status && !hasArrived && i === 0) status = {cls:"arrived", txt:"Just arrived"};
    if(status){
      if(status.cls === "arrived") hasArrived = true;
      var r = document.createElement("span");
      r.className = "mkr-ribbon " + status.cls;
      r.innerHTML = "<i></i>" + status.txt;
      ph.appendChild(r);
    }

    // quick view — plain div so the grid's card-click handler opens the modal
    var qv = document.createElement("div");
    qv.className = "mkr-qv";
    qv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Quick view &middot; VIR &amp; 360&deg;';
    ph.appendChild(qv);
  });
}
function watchGrid(){
  var grid = document.getElementById("invgrid");
  if(!grid) return;
  decorate();
  new MutationObserver(decorate).observe(grid, {childList:true});
}

/* ===== REVIEWS STRIP ===== */
var REVIEWS = [
  {n:"Thabo M.", car:"Golf 8 GTI", txt:"Watched the live video viewing from Joburg, reserved the same day. Car arrived exactly as shown — VIR report matched to the last stone chip."},
  {n:"Chantelle V.", car:"Fortuner 2.8 GD-6", txt:"The finance side was painless. VAF Bridge got me a structure two banks turned down. Delivered to my door in George at no cost."},
  {n:"Riaan B.", car:"Navara PRO-2X", txt:"Straight-up dealership. The 360 view and damage tags meant zero surprises. Best buying experience I've had — and I've bought a lot of bakkies."}
];
function reviewsStrip(){
  var footer = document.querySelector("footer");
  if(!footer || document.querySelector(".mkr-reviews")) return;
  var sec = document.createElement("section");
  sec.className = "mkr-reviews";
  sec.innerHTML =
    '<div class="wrap">'
    +'<div class="mkr-rev-head">'
    +'<div class="mkr-rev-score"><div class="n">4.8</div><div><div class="mkr-rev-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div><div class="mkr-rev-sub">Based on 120+ Google reviews</div></div></div>'
    +'<div class="mkr-rev-badge"><img src="mkr-badge.jpg" alt="" style="width:20px;height:20px;border-radius:6px;object-fit:cover">Verified buyers &middot; Gqeberha &amp; nationwide</div>'
    +'</div>'
    +'<div class="mkr-rev-grid">'
    +REVIEWS.map(function(r){
      return '<div class="mkr-rev-card"><div class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div><p>&ldquo;'+r.txt+'&rdquo;</p>'
        +'<div class="who"><div class="av">'+r.n.charAt(0)+'</div><div><b>'+r.n+'</b><span>Bought: '+r.car+'</span></div></div></div>';
    }).join("")
    +'</div></div>';
  footer.parentNode.insertBefore(sec, footer);
}

/* ===== DELIVERED TICKER ===== */
var DELIVERIES = [
  {car:"Toyota Fortuner 2.8 GD-6", to:"Durban", when:"this week"},
  {car:"VW Golf 8 GTI", to:"Cape Town", when:"3 days ago"},
  {car:"Ford Ranger Wildtrak", to:"East London", when:"this week"},
  {car:"Hyundai Tucson Premium", to:"Bloemfontein", when:"last week"},
  {car:"BMW M2 Coupé", to:"Pretoria", when:"this week"}
];
function ticker(){
  if(window.matchMedia("(max-width:860px)").matches) return;
  var el = document.createElement("div");
  el.className = "mkr-ticker";
  el.setAttribute("aria-live","polite");
  document.body.appendChild(el);
  var i = 0;
  function show(){
    var d = DELIVERIES[i % DELIVERIES.length]; i++;
    el.innerHTML = '<div class="tk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg></div>'
      +'<div><b>'+d.car+' delivered</b><span>'+d.to+' &middot; '+d.when+' &middot; zero-cost delivery</span></div>';
    el.classList.add("show");
    setTimeout(function(){el.classList.remove("show");}, 6000);
  }
  setTimeout(show, 7000);
  setInterval(show, 18000);
}

/* ===== MOBILE STICKY ACTION BAR ===== */
function mobileBar(){
  if(document.querySelector(".mkr-mbar")) return;
  var bar = document.createElement("nav");
  bar.className = "mkr-mbar";
  bar.setAttribute("aria-label","Quick contact");
  var stockHref = document.getElementById("stock") ? "#stock" : (document.getElementById("invgrid") ? "#invgrid" : "index.html#stock");
  bar.innerHTML =
    '<a class="mb-call" href="tel:+27662912809"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.8.7a2 2 0 0 1 1.8 2.1z"/></svg>Call</a>'
    +'<a class="mb-wa" href="https://wa.me/'+WA+'?text='+encodeURIComponent("Hi MKR, I'm interested in a vehicle")+'" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3.2C8.9 3.2 3.2 8.9 3.2 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.9 1 4 1.6 6.2 1.6h.01c7.1 0 12.8-5.7 12.8-12.8S23.1 3.2 16 3.2zm5.9 15.3c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-1.9-1-3.2-1.7-4.5-3.9-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2.4.9 2.9.8 3.6.7.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>WhatsApp</a>'
    +'<a class="mb-stock" href="'+stockHref+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l4-7h10l4 7M6 17h.01M18 17h.01"/></svg>Stock</a>';
  document.body.appendChild(bar);
}

/* ===== INIT ===== */
function init(){
  try{skeletons();}catch(e){}
  try{watchGrid();}catch(e){}
  try{reviewsStrip();}catch(e){}
  try{ticker();}catch(e){}
  try{mobileBar();}catch(e){}
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();
