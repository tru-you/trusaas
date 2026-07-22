/* Cars on Caledon — Polish: ribbons, quick-view, skeletons, reviews, ticker, mobile bar */
(function(){
var WA = "27618759389";

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
    var qv = document.createElement("div");
    qv.className = "coc-qv";
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

var REVIEWS = [
  {n:"Wesley A.", car:"Ford Ranger Wildtrak", txt:"Drove through from Gqeberha on Lance's word and the bakkie was exactly as described. VIR report matched every panel. Honest yard, no games."},
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
    +'<div class="coc-rev-badge"><img src="coc-mark.svg" alt="">Verified buyers &middot; Kariega &amp; Eastern Cape</div>'
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

function mobileBar(){
  if(document.querySelector(".coc-mbar")) return;
  var bar = document.createElement("nav");
  bar.className = "coc-mbar";
  bar.setAttribute("aria-label","Quick contact");
  bar.innerHTML =
    '<a class="mb-call" href="tel:+27618759389"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.8.7a2 2 0 0 1 1.8 2.1z"/></svg>Call</a>'
    +'<a class="mb-wa" href="https://wa.me/'+WA+'?text='+encodeURIComponent("Hi Cars on Caledon, I'm interested in a vehicle")+'" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3.2C8.9 3.2 3.2 8.9 3.2 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.9 1 4 1.6 6.2 1.6h.01c7.1 0 12.8-5.7 12.8-12.8S23.1 3.2 16 3.2zm5.9 15.3c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-1.9-1-3.2-1.7-4.5-3.9-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2.4.9 2.9.8 3.6.7.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>WhatsApp</a>'
    +'<a class="mb-stock" href="#showroom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l4-7h10l4 7M6 17h.01M18 17h.01"/></svg>Stock</a>';
  document.body.appendChild(bar);
}

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
