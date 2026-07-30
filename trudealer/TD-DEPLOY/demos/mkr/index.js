const WA = "27662912809";
const fmtR = n => "R " + Number(n||0).toLocaleString("en-ZA");
const monthly = (p, dep, term, rate) => {
  dep = dep || 0.1; term = term || 72; rate = rate || 0.1175;
  const r = rate/12;
  return Math.round(p*(1-dep)*r/(1-Math.pow(1+r,-term)));
};

/* Splash handled by mkr-splash.js (video intro) */

/* ===== STOCK DATA ===== */
let STOCK = MKR.MOCK.slice();

let io;
function observeAll(){
  io = io || new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}}),{threshold:.12});
  document.querySelectorAll(".rv:not(.in)").forEach(el=>io.observe(el));
}

function setStockSource(live, label){
  const el = document.getElementById("stockSource");
  const lbl = document.getElementById("stockSourceLbl");
  if(el) el.classList.toggle("live", !!live);
  if(lbl) lbl.textContent = label;
}

/* Vehicle detail handled by vd-upgrade.js */
/* ===== RENDER GRID ===== */
const grid = document.getElementById("invgrid");
let currentList = [];
function render(list){
  const show = list.length ? list : STOCK.slice(0,6);
  currentList = show;
  grid.innerHTML = show.map((c,i)=>{
    const badgeClass = c.cat==="performance" ? "perf" : (c.cat==="select" ? "gold" : "");
    return '<article class="card rv d'+((i%3)+1)+'" data-idx="'+i+'" '+MKR.dataAttrs(c)+'>'
      +'<div class="card-shine" aria-hidden="true"></div>'
      +'<div class="ph">'
      +'<img class="im" src="'+(c.img||'')+'" alt="'+c.y+' '+c.make+' '+c.name+'" loading="lazy" decoding="async" width="800" height="500">'
      +'<span class="badge '+badgeClass+'">'+(c.tag||"Featured")+'</span>'
      +'<span class="vir">VIR &#9733; '+(c.vir||"4.5")+'</span>'
      +'</div>'
      +'<div class="card-body">'
      +'<div class="yr">'+c.y+' &middot; '+c.make+'</div>'
      +'<h3>'+c.name+'</h3>'
      +'<div class="var">'+(c.variant||"")+'</div>'
      +'<div class="specs"><span>'+(c.km||"&mdash;")+'</span><span>'+(c.tr||"&mdash;")+'</span><span>'+(c.fuel||"&mdash;")+'</span><span>'+(c.body||"&mdash;")+'</span></div>'
      +'<div class="price-row"><div class="pr">'+fmtR(c.price)+'</div><div class="pm">from <b>'+fmtR(monthly(c.price))+'/pm</b></div></div>'
      +MKR.tpTag(c)
      +'<div class="cta-row">'
      +'<button class="btn btn-blue" onclick="event.stopPropagation();openVehicleDetail(currentList['+i+'])">View details</button>'
      +'<a class="btn btn-ghost-blue" href="https://wa.me/'+WA+'?text='+encodeURIComponent("Hi MKR, I\'d like a viewing of the "+c.y+" "+c.make+" "+c.name)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Viewing</a>'
      +'</div></div></article>';
  }).join("");
  observeAll();
}

/* ===== LIVE STOCK ===== */
async function tryLoadLive(){
  setStockSource(false, "Loading yard...");
  const stock = await MKR.loadStock();
  if(stock && stock.live && stock.length){
    STOCK = stock;
    setStockSource(true, STOCK.length+" vehicles in stock");
  } else {
    setStockSource(false, STOCK.length+" vehicles in stock");
  }
  applyFilters();
}

let activeChip = "";
function applyFilters(make,body,maxP,sort){
  make=make||"";body=body||"";maxP=maxP||"";sort=sort||"";
  let list = [...STOCK];
  if(activeChip==="used" || activeChip==="select" || activeChip==="performance") list = list.filter(c=>c.cat===activeChip);
  else if(activeChip) list = list.filter(c=>c.body===activeChip);
  if(make) list = list.filter(c=>c.make===make);
  if(body) list = list.filter(c=>c.body===body);
  if(maxP) list = list.filter(c=>c.price<=+maxP);
  if(sort==="lo") list.sort((a,b)=>a.price-b.price);
  if(sort==="hi") list.sort((a,b)=>b.price-a.price);
  if(!list.length){
    render(STOCK.slice(0,6));
    grid.insertAdjacentHTML("afterbegin",'<p style="grid-column:1/-1;text-align:center;padding:36px 12px;font-size:13px;color:var(--grey);font-weight:600;">No exact matches &mdash; showing featured stock. WhatsApp us to source.</p>');
  } else render(list);
}

document.getElementById("chips").addEventListener("click", e=>{
  const b = e.target.closest(".chip"); if(!b) return;
  document.querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));
  b.classList.add("on"); activeChip = b.dataset.f||"";
  applyFilters();
});
document.getElementById("qsearch").addEventListener("submit", e=>{
  e.preventDefault(); activeChip = "";
  document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on", c.dataset.f===""));
  applyFilters(
    document.getElementById("f-make").value,
    document.getElementById("f-body").value,
    document.getElementById("f-price").value,
    document.getElementById("f-sort").value
  );
  document.getElementById("stock").scrollIntoView({behavior:"smooth"});
});

grid.addEventListener("click", e=>{
  const card = e.target.closest(".card");
  if(!card || e.target.closest("a") || e.target.closest("button")) return;
  const idx = +card.dataset.idx;
  if(currentList[idx]) openVehicleDetail(currentList[idx]);
});

/* ===== FINANCE CALC ===== */
const rP=document.getElementById("r-price"), rD=document.getElementById("r-dep"), rT=document.getElementById("r-term");
function fill(el){ if(!el) return; el.style.setProperty("--fill", ((el.value-el.min)/(el.max-el.min)*100)+"%"); }
function calc(){
  if(!rP) return;
  const P=+rP.value, dep=+rD.value/100, n=+rT.value, r=.1175/12;
  const m=Math.round(P*(1-dep)*r/(1-Math.pow(1+r,-n)));
  document.getElementById("o-price").textContent=fmtR(P);
  document.getElementById("o-dep").textContent=rD.value+"%";
  document.getElementById("o-term").textContent=n+" months";
  document.getElementById("o-monthly").innerHTML=fmtR(m)+'<small> /pm</small>';
  [rP,rD,rT].forEach(fill);
}
if(rP){ [rP,rD,rT].forEach(el=>el.addEventListener("input", calc)); calc(); }

/* ===== NAV ===== */
document.getElementById("burger").addEventListener("click", ()=>document.getElementById("mmenu").classList.toggle("open"));
document.querySelectorAll("#mmenu a").forEach(a=>a.addEventListener("click", ()=>document.getElementById("mmenu").classList.remove("open")));

/* ===== SCROLL ===== */
(function(){
  const header = document.getElementById("siteHeader");
  const prog = document.getElementById("scrollProgress");
  const sections = ["portals","stock","sell","finance","trust","visit"].map(id=>document.getElementById(id)).filter(Boolean);
  const navLinks = document.querySelectorAll(".nav-links a");
  function onScroll(){
    const y = window.scrollY||0;
    header.classList.toggle("scrolled", y>20);
    if(prog){
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      prog.style.transform = 'scaleX('+Math.min(1, y/max)+')';
    }
    let cur = "portals";
    const mid = y + 130;
    sections.forEach(s=>{ if(s.offsetTop <= mid) cur = s.id; });
    navLinks.forEach(a=>{
      const href = (a.getAttribute("href")||"").replace("#","");
      a.classList.toggle("active", href===cur);
    });
  }
  window.addEventListener("scroll", onScroll, {passive:true});
  onScroll();
})();

/* ===== INIT ===== */
render(STOCK);
setStockSource(false, STOCK.length+" vehicles in stock");
tryLoadLive();
observeAll();

/* ===== INTERACTIONS ===== */
(function(){
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce) return;

  document.addEventListener("pointermove", e=>{
    const btn = e.target.closest(".btn");
    if(!btn) return;
    const r = btn.getBoundingClientRect();
    btn.style.setProperty("--mx", ((e.clientX-r.left)/r.width*100)+"%");
    btn.style.setProperty("--my", ((e.clientY-r.top)/r.height*100)+"%");
  }, {passive:true});

  document.addEventListener("click", e=>{
    const btn = e.target.closest(".btn, .chip");
    if(!btn) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const span = document.createElement("span");
    span.className = "ripple";
    span.style.width = span.style.height = size+"px";
    span.style.left = (e.clientX - r.left - size/2)+"px";
    span.style.top = (e.clientY - r.top - size/2)+"px";
    if(btn.classList.contains("chip")){
      span.style.position="absolute"; span.style.borderRadius="50%";
      span.style.background="rgba(11,91,215,.25)"; span.style.pointerEvents="none";
      span.style.animation="btnRipple .55s var(--ease) forwards";
      if(getComputedStyle(btn).position==="static") btn.style.position="relative";
      btn.style.overflow="hidden";
    }
    btn.appendChild(span);
    setTimeout(()=>span.remove(), 700);
  });

  if(!fine) return;

  function bindTilt(sel){
    document.querySelectorAll(sel).forEach(card=>{
      if(card.dataset.tiltBound) return;
      card.dataset.tiltBound = "1";
      card.addEventListener("pointermove", e=>{
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.transform = "perspective(900px) rotateX("+((.5-py)*10)+"deg) rotateY("+((px-.5)*12)+"deg) translateY(-8px)";
        card.style.setProperty("--mx", (px*100)+"%");
        card.style.setProperty("--my", (py*100)+"%");
      });
      card.addEventListener("pointerleave", ()=>{card.style.transform="";});
    });
  }
  bindTilt(".card, .portal-card");
  const gridEl = document.getElementById("invgrid");
  if(gridEl) new MutationObserver(()=>bindTilt(".card")).observe(gridEl, {childList:true});

  /* hero particles removed — the orbs and the Ken Burns drift already carry the hero */
  const spotlight = document.getElementById("heroSpotlight");
  const hero = document.querySelector(".hero");
  if(spotlight && hero){
    hero.addEventListener("mousemove", e=>{
      const rect = hero.getBoundingClientRect();
      spotlight.style.setProperty("--mx", (e.clientX - rect.left)+"px");
      spotlight.style.setProperty("--my", (e.clientY - rect.top)+"px");
      spotlight.classList.add("active");
    });
    hero.addEventListener("mouseleave", ()=>spotlight.classList.remove("active"));
  }
  const heroTitle = document.getElementById("heroTitle");
  if(heroTitle){
    heroTitle.style.opacity = "0";
    heroTitle.style.transform = "translateY(18px)";
    heroTitle.style.transition = "opacity .9s var(--ease), transform .9s var(--ease)";
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      heroTitle.style.opacity = "1";
      heroTitle.style.transform = "none";
    }));
  }
})();
if(window.MKR_TRUCHAT_CONFIG){
  window.TRUECARS_TRUCHAT_CONFIG = window.MKR_TRUCHAT_CONFIG;
}