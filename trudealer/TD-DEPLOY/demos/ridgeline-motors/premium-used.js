const WA="15125550142";
const CAT="used";
const fmtR=n=>"$"+Number(n||0).toLocaleString("en-US");
const monthly=(p,dep,term,rate)=>{dep=dep||.1;term=term||72;rate=rate||.1175;const r=rate/12;return Math.round(p*(1-dep)*r/(1-Math.pow(1+r,-term)));};

/* STOCK */
let STOCK=Ridgeline.MOCK.filter(c=>c.cat===CAT);
let currentList=[];
const grid=document.getElementById("invgrid");

let io;
function observeAll(){io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}}),{threshold:.12});document.querySelectorAll(".rv:not(.in)").forEach(el=>io.observe(el));}

function setStockSource(live,label){const el=document.getElementById("stockSource"),lbl=document.getElementById("stockSourceLbl");if(el)el.classList.toggle("live",!!live);if(lbl)lbl.textContent=label;}

/* Vehicle detail handled by vd-upgrade.js */

/* RENDER */
function render(list){
  const show=list.length?list:STOCK.slice(0,6);
  currentList=show;
  grid.innerHTML=show.map((c,i)=>'<article class="card rv d'+((i%3)+1)+'" data-idx="'+i+'"><div class="card-shine" aria-hidden="true"></div><div class="ph"><div class="im" style="background-image:linear-gradient(180deg,transparent 50%,rgba(10,22,38,.4)),url(\''+(c.img||'')+'\')"></div><span class="badge">Premium Used</span><span class="vir">VIR &#9733; '+(c.vir||"4.5")+'</span></div><div class="card-body"><div class="yr">'+c.y+' &middot; '+c.make+'</div><h3>'+c.name+'</h3><div class="var">'+(c.variant||"")+'</div><div class="specs"><span>'+(c.km||"&mdash;")+'</span><span>'+(c.tr||"&mdash;")+'</span><span>'+(c.fuel||"&mdash;")+'</span><span>'+(c.body||"&mdash;")+'</span></div><div class="price-row"><div class="pr">'+fmtR(c.price)+'</div><div class="pm">from <b>'+fmtR(monthly(c.price))+'/pm</b></div></div>'+Ridgeline.tpTag(c)+'<div class="cta-row"><button class="btn btn-gold" onclick="event.stopPropagation();openVehicleDetail(currentList['+i+'])">View details</button><a class="btn btn-ghost-blue" href="https://wa.me/'+WA+'?text='+encodeURIComponent("Hi Ridgeline, I'd like a viewing of the "+c.y+" "+c.make+" "+c.name)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Viewing</a></div></div></article>').join("");
  observeAll();
}

/* LIVE STOCK */
async function tryLoadLive(){
  setStockSource(false,"Loading Used stock...");
  const stock=await Ridgeline.loadStock("used");
  if(stock&&stock.length){STOCK=stock;setStockSource(true,STOCK.length+" Used vehicles");}
  else{STOCK=Ridgeline.MOCK.filter(c=>c.cat===CAT);setStockSource(false,STOCK.length+" Used vehicles");}
  applyFilters();
}

let activeChip="";
function applyFilters(){
  let list=[...STOCK];
  if(activeChip)list=list.filter(c=>c.body===activeChip);
  if(!list.length){render(STOCK.slice(0,6));grid.insertAdjacentHTML("afterbegin",'<p style="grid-column:1/-1;text-align:center;padding:36px 12px;font-size:13px;color:var(--grey);font-weight:600;">No exact matches — showing all Used stock.</p>');}
  else render(list);
}

document.getElementById("chips").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;document.querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));b.classList.add("on");activeChip=b.dataset.f||"";applyFilters();});

grid.addEventListener("click",e=>{const card=e.target.closest(".card");if(!card||e.target.closest("a")||e.target.closest("button"))return;const idx=+card.dataset.idx;if(currentList[idx])openVehicleDetail(currentList[idx]);});

/* NAV */
document.getElementById("burger").addEventListener("click",()=>document.getElementById("mmenu").classList.toggle("open"));
document.querySelectorAll("#mmenu a").forEach(a=>a.addEventListener("click",()=>document.getElementById("mmenu").classList.remove("open")));

/* SCROLL */
(function(){const h=document.getElementById("siteHeader"),p=document.getElementById("scrollProgress");function onScroll(){const y=window.scrollY||0;h.classList.toggle("scrolled",y>20);if(p){const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);p.style.width=Math.min(100,(y/max)*100)+"%";}}window.addEventListener("scroll",onScroll,{passive:true});onScroll();})();

/* INIT */
render(STOCK);
setStockSource(false,STOCK.length+" Used vehicles");
tryLoadLive();
observeAll();

/* INTERACTIONS */
(function(){const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduce)return;
document.addEventListener("pointermove",e=>{const btn=e.target.closest(".btn");if(!btn)return;const r=btn.getBoundingClientRect();btn.style.setProperty("--mx",((e.clientX-r.left)/r.width*100)+"%");btn.style.setProperty("--my",((e.clientY-r.top)/r.height*100)+"%");},{passive:true});
document.addEventListener("click",e=>{const btn=e.target.closest(".btn, .chip");if(!btn)return;const r=btn.getBoundingClientRect();const size=Math.max(r.width,r.height);const span=document.createElement("span");span.className="ripple";span.style.width=span.style.height=size+"px";span.style.left=(e.clientX-r.left-size/2)+"px";span.style.top=(e.clientY-r.top-size/2)+"px";if(btn.classList.contains("chip")){span.style.position="absolute";span.style.borderRadius="50%";span.style.background="rgba(95,114,133,.25)";span.style.pointerEvents="none";span.style.animation="btnRipple .55s var(--ease) forwards";if(getComputedStyle(btn).position==="static")btn.style.position="relative";btn.style.overflow="hidden";}btn.appendChild(span);setTimeout(()=>span.remove(),700);});
const fine=window.matchMedia("(hover: hover) and (pointer: fine)").matches;if(!fine)return;
function bindTilt(sel){document.querySelectorAll(sel).forEach(card=>{if(card.dataset.tiltBound)return;card.dataset.tiltBound="1";card.addEventListener("pointermove",e=>{const r=card.getBoundingClientRect();const px=(e.clientX-r.left)/r.width;const py=(e.clientY-r.top)/r.height;card.style.transform="perspective(900px) rotateX("+((.5-py)*10)+"deg) rotateY("+((px-.5)*12)+"deg) translateY(-8px)";card.style.setProperty("--mx",(px*100)+"%");card.style.setProperty("--my",(py*100)+"%");});card.addEventListener("pointerleave",()=>{card.style.transform="";});});}
bindTilt(".card");
new MutationObserver(()=>bindTilt(".card")).observe(grid,{childList:true});
const container=document.getElementById("heroParticles");
if(container){for(let i=0;i<18;i++){const p=document.createElement("div");p.className="particle";p.style.left=Math.random()*100+"%";p.style.animationDuration=(8+Math.random()*12)+"s";p.style.animationDelay=(Math.random()*10)+"s";p.style.opacity=String(.2+Math.random()*.5);container.appendChild(p);}}
})();
if(window.Ridgeline_TRUCHAT_CONFIG){window.TRUECARS_TRUCHAT_CONFIG=window.Ridgeline_TRUCHAT_CONFIG;}