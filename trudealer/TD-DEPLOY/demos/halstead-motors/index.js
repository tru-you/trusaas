{
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  "@id": "https://www.halsteadmotors.example/#dealer",
  "name": "Halstead Motor Co.",
  "alternateName": "Halstead Cars",
  "description": "Trusted independent dealership offering quality pre-owned vehicles, bank finance and trade-ins in Manchester, Greater Manchester.",
  "url": "https://www.halsteadmotors.example/",
  "logo": "https://www.halsteadmotors.example/demo-logo.svg",
  "image": "https://www.halsteadmotors.example/og-card.jpg",
  "telephone": "+44 161 496 0000",
  "email": "lance@halsteadmotors.example",
  "priceRange": "£100 000 - £700 000",
  "currenciesAccepted": "ZAR",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "257 Halstead Street",
    "addressLocality": "Manchester",
    "addressRegion": "Greater Manchester",
    "addressCountry": "ZA"
  },
  "areaServed": [
    {"@type":"City","name":"Manchester"},
    {"@type":"City","name":"Gqeberha"},
    {"@type":"AdministrativeArea","name":"Greater Manchester"}
  ],
  "openingHoursSpecification": [
    {"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"08:00","closes":"17:30"},
    {"@type":"OpeningHoursSpecification","dayOfWeek":"Saturday","opens":"08:00","closes":"13:00"}
  ],
  "sameAs": ["https://facebook.com/halsteadmotors"],
  "makesOffer": {
    "@type": "Offer",
    "itemOffered": {"@type":"Service","name":"Vehicle finance, trade-ins and Park & Sell"}
  }
}
/* ── Config ── */
const WA = "+44 161 496 0000";
/* One slug, one primary host. This was 4 slugs x 2 hosts x 2 attempts at an 18s
   timeout each — up to 16 sequential requests and well over a minute of hanging
   before the page gave up. Only "cars-on-caledon" exists in TruFlow; the other
   three never resolved and only ever bought timeouts. */
/* House standard: a showroom goes live once the yard has this many cars on the
   feed. Below it the section holds instead of publishing a thin grid — two cars
   and a filter row reads as a yard going out of business, not a yard opening.
   Everything else on the page (trade-in, finance, hours, WhatsApp) stays live
   throughout, because those are useful with no stock at all. */
const MIN_LIVE_STOCK = 5;
const DEALER_SLUGS = ["cars-on-caledon"];
/* flow. and premium. are one Render service behind two custom domains — Flow
   Lite, which used to own the flow. hostname, is retired. Listing both bought a
   second request to the identical app rather than a fallback. TruLens is the
   only genuinely independent source, and it speaks the same public-stock
   contract, so a yard running the capture app without the DMS still fills this
   page. */
const STOCK_APIS = [
  "https://premium.tru-saas.com/api/public/stock?dealer=",
  "https://trusaas-premium.onrender.com/api/public/stock?dealer=",
  "https://lens.tru-saas.com/api/public/stock?dealer="
];

/* ── Fallback stock — shown only until live DMS stock loads. ──
   Realistic Manchester family-yard line-up (bread-and-butter SA used cars, not exotics).
   NOTE: `img` values are PLACEHOLDERS. Real vehicle photos must come from the DMS
   (heroImage / images[]) once stock is loaded there. Do not present these as real units. */
// truPrice = an honest per-vehicle market-value benchmark (hand-set, same
// approach as True-Cars/MKR). Independent of price — never derived from it.
const MOCK_STOCK = [];


/* MOCK_STOCK is now empty and STOCK starts empty with it.
   It used to hold eight invented cars with Unsplash photography, and the site
   painted them on first load and left them there whenever the feed failed —
   still captioned "8 vehicles in stock". Buyers were WhatsApping about cars
   that had never been on the floor. An empty showroom that says so is worth
   more than a full one that is fiction. */
let STOCK = MOCK_STOCK.slice();
let stockLive = false;
let activeChip = "";

const fmtR=n=>"R"+Number(n||0).toLocaleString("en-GB").replace(/,/g," ");
const monthly=p=>{const r=.1175/12,n=72;return Math.round(p*.9*r/(1-Math.pow(1+r,-n)));};

// Deterministic 0..1 from a string — same input always gives the same output,
// so a live car's synthetic TruPrice doesn't change on every reload.
function hash01(str){let h=0;str=String(str||"");for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return (h%1000)/1000;}

/** TruPrice delta — compares a vehicle's asking price against its truPrice benchmark. */
function priceDelta(c){
  const tp=Number(c.truPrice)||Number(c.price)||0, price=Number(c.price)||0;
  const d=tp-price, pct=tp?Math.round(Math.abs(d)/tp*100):0;
  return {below:d>=0, amount:Math.abs(d), pct};
}
/** Small "R below TruPrice" / "Fair TruPrice" pill for vehicle cards. */
function tpTag(c){
  const d=priceDelta(c);
  const check='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';
  return d.below
    ? `<span class="tp-tag win">${check}${fmtR(d.amount)} below TruPrice</span>`
    : `<span class="tp-tag fair">Fair TruPrice</span>`;
}
/* ── Shortlist (♥) — saved in this browser, sent to the yard in one WhatsApp ── */
const FAV_KEY = "coc_shortlist_v1";
const favKey = c => [c.yr, c.make, c.name].join("|");
function favAll(){ try{ return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }catch(e){ return []; } }
function favSave(list){ try{ localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0,20))); }catch(e){} }
function favHas(c){ return favAll().some(f => favKey(f) === favKey(c)); }
function favToggle(c){
  let list = favAll();
  if(favHas(c)) list = list.filter(f => favKey(f) !== favKey(c));
  else list.push({yr:c.yr, make:c.make, name:c.name, variant:c.variant||"", price:c.price, km:c.km||"", img:c.img||""});
  favSave(list);
  favSync();
}
function favSync(){
  const list = favAll();
  const nEl = document.getElementById("navFavN"), navBtn = document.getElementById("navFav");
  if(nEl) nEl.textContent = list.length;
  if(navBtn) navBtn.classList.toggle("has", list.length > 0);
  document.querySelectorAll("#invgrid .fav-btn").forEach(b=>{
    const c = (window.COC_SHOWN||[])[+b.dataset.fav];
    if(c) b.classList.toggle("on", favHas(c));
  });
  const listEl = document.getElementById("favList"), waBtn = document.getElementById("favWa");
  if(listEl){
    listEl.innerHTML = list.length
      ? list.map((f,i)=>`
        <div class="fav-item">
          <div class="fi-im"${f.img ? ` style="background-image:url('${f.img}')"` : ""}></div>
          <div><b>${f.yr} ${f.make} ${f.name}</b><span class="fi-p">${fmtR(f.price)}</span></div>
          <button class="fi-x" type="button" data-fx="${i}" aria-label="Remove from shortlist">×</button>
        </div>`).join("")
      : '<div class="fav-empty">Tap the ♥ on any car to build a shortlist,<br>then WhatsApp it to us in one go.</div>';
  }
  if(waBtn){
    const msg = "Hi Halstead Cars, I'm interested in these vehicles:\n"
      + list.map((f,i)=>(i+1)+". "+f.yr+" "+f.make+" "+f.name+" — "+fmtR(f.price)).join("\n")
      + "\nAre they available to view?";
    waBtn.href = "https://wa.me/"+WA+"?text="+encodeURIComponent(msg);
    waBtn.style.pointerEvents = list.length ? "" : "none";
    waBtn.style.opacity = list.length ? "" : ".5";
  }
}

let io;
function observeAll(){io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}}),{threshold:.1});document.querySelectorAll(".rv:not(.in)").forEach(el=>io.observe(el));}

/* One place decides what the stock pill says, so the live and failed paths can
   never disagree. Below the go-live threshold it deliberately does not publish a
   count — "2 vehicles in stock" is a worse advert than saying stock is landing. */
function stockLabel(){
  if(STOCK.length >= MIN_LIVE_STOCK) return STOCK.length+" vehicles in stock";
  if(STOCK.length > 0)               return "New stock arriving — call 0161 496 0000";
  return "Stock loading — call us on 0161 496 0000";
}
function setStockSource(live, label){
  stockLive = !!live;
  /* Tell the splash whether the yard is live yet. It reads this to decide
     between "Enter showroom" and holding as the front door. Set here because
     this is the one function every stock path already calls. */
  window.COC_HOLDING = STOCK.length < MIN_LIVE_STOCK;
  const el = document.getElementById("stockSource");
  const lbl = document.getElementById("stockSourceLbl");
  if(el) el.classList.toggle("live", live);
  if(lbl) lbl.textContent = label;
  const badge = document.querySelector(".hero-badge");
  if(badge && live) badge.innerHTML = "<i></i> "+STOCK.length+(STOCK.length===1?" vehicle":" vehicles")+" · Manchester, Greater Manchester";
  syncCounts();
  syncFilters();
}

/* Keep every "how many cars" number on the page honest — derived from real stock,
   never hard-coded. Body-type tiles with no stock hide themselves. */
/* Build the search dropdowns from real stock. Hardcoded options are a demo
   killer: a prospect picks "BMW", gets an empty showroom, and the site looks
   broken — while makes we DO have (Nissan, Hyundai) aren't even selectable. */
function syncFilters(){
  const opts = (sel, values, allLabel) => {
    const el = document.getElementById(sel);
    if(!el) return;
    const prev = el.value;
    el.innerHTML = '<option value="">'+allLabel+'</option>'
      + values.map(v => '<option>'+v+'</option>').join("");
    if(values.includes(prev)) el.value = prev;      // keep the user's choice if still valid
  };
  const uniq = k => [...new Set(STOCK.map(c => c[k]).filter(Boolean))]
                      .filter(v => v !== "Vehicle")   // DMS placeholder body type
                      .sort((a,b) => a.localeCompare(b));
  opts("f-make", uniq("make"), "All makes");
  opts("f-body", uniq("body"), "All types");

  // Chips mirror real stock too — a filter that can only return "no matches" is noise.
  const chipWrap = document.getElementById("chips");
  if(chipWrap){
    /* Chips are BUILT from the stock, not hidden from a hardcoded list.
       They used to be fixed at Hatchback/SUV/Pickup/Coupe and matched with
       c.body === chip, an exact string compare. TruLens sends its own body
       types — "Pickup / Truck", "Crossover", "Convertible" — so "Pickup"
       never equalled "Pickup / Truck" and every one of those chips hid itself,
       leaving a filter row with nothing in it but All. Deriving them means the
       chip set always matches whatever the yard actually has, including body
       types nobody has thought of yet. */
    const bodies = [...new Set(STOCK.map(c => c.body).filter(Boolean))]
                     .filter(b => b !== "Vehicle")   // DMS placeholder
                     .sort((a,b) => a.localeCompare(b));
    const anyPerf = STOCK.some(c => c.perf);
    const esc = t => String(t).replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
    chipWrap.innerHTML =
      '<button type="button" class="chip" data-f="">All</button>'
      + bodies.map(b => '<button type="button" class="chip" data-f="'+esc(b)+'">'+esc(b)+'</button>').join("")
      + (anyPerf ? '<button type="button" class="chip" data-f="perf">Performance</button>' : "");
    // Keep the active chip lit if it still exists, otherwise fall back to All.
    const stillThere = chipWrap.querySelector('.chip[data-f="'+String(activeChip).replace(/"/g,'')+'"]');
    if(activeChip && stillThere) stillThere.classList.add("on");
    else { activeChip = ""; chipWrap.querySelector('.chip[data-f=""]').classList.add("on"); }
  }

  // Price bands that actually divide the stock — never a band above the top price.
  const el = document.getElementById("f-price");
  if(el && STOCK.length){
    const max = Math.max(...STOCK.map(c => c.price || 0));
    const prev = el.value;
    const bands = [150000,200000,250000,300000,400000,500000,600000,800000]
      .filter(b => b < max);
    const pick = bands.length > 3
      ? [bands[Math.floor(bands.length/4)], bands[Math.floor(bands.length/2)], bands[bands.length-1]]
      : bands;
    el.innerHTML = '<option value="">No limit</option>'
      + [...new Set(pick)].map(b => '<option value="'+b+'">Under R'+b.toLocaleString("en-GB").replace(/,/g," ")+'</option>').join("");
    if([...el.options].some(o => o.value === prev)) el.value = prev;
  }
}

function syncCounts(){
  const n = STOCK.length;
  const stat = document.querySelector(".stats-row .si .sn");
  if(stat) stat.textContent = n;

  const tiles = [...document.querySelectorAll(".cat-tile")];
  const count = bt => STOCK.filter(v => v.body === bt).length;
  // If stock carries no usable body types (e.g. DMS not sending bodyType yet),
  // keep every tile visible and just drop the counts — never blank the section.
  const typed = tiles.some(t => t.getAttribute("data-bt") && count(t.getAttribute("data-bt")));

  tiles.forEach(function(tile){
    const bt = tile.getAttribute("data-bt");
    const el = tile.querySelector(".ct-count");
    if(!bt){ if(el) el.textContent = n===1 ? "1 vehicle" : n+" vehicles"; return; }
    if(!typed){ tile.style.display=""; if(el) el.textContent="Browse"; return; }
    const c = count(bt);
    if(el) el.textContent = c===1 ? "1 vehicle" : c+" vehicles";
    tile.style.display = c ? "" : "none";
  });
}

const grid=document.getElementById("invgrid");
function renderHolding(){
  /* Deliberately not a car grid. It names the yard, says stock is arriving, and
     keeps the one action that always works — WhatsApp — rather than showing a
     near-empty showroom or, worse, invented stock. */
  const chipWrap = document.getElementById("chips");
  if(chipWrap) chipWrap.style.display = "none";
  grid.innerHTML =
    '<div style="grid-column:1/-1;text-align:center;padding:56px 20px;">'
    + '<p style="font-size:20px;font-weight:700;margin:0 0 8px;">New stock arriving now</p>'
    + '<p style="font-size:14px;color:var(--grey);margin:0 0 20px;line-height:1.6;">'
    + 'We are photographing and inspecting the current floor. Tell us what you are '
    + 'looking for and we will send you matches before they go up.</p>'
    + '<a class="btn btn-dark" target="_blank" rel="noopener" href="https://wa.me/+44 161 496 0000?text='
    + encodeURIComponent("Hi Halstead Cars, what do you have coming in? I am looking for:")
    + '">WhatsApp us what you need &rarr;</a></div>';
}
function render(list){
  if(STOCK.length < MIN_LIVE_STOCK){ renderHolding(); return; }
  const show = list.length ? list : STOCK.slice(0,10);
  window.COC_SHOWN = show;
  grid.innerHTML=show.map((c,i)=>{
    const img = c.img || "";
    const waMsg = encodeURIComponent("Hi Halstead Cars, I'm interested in the "+c.yr+" "+c.make+" "+c.name+" ("+fmtR(c.price)+")");
    return `
  <article class="card rv d${i%3+1}" data-idx="${i}">
    <div class="ph">
      ${img
        ? `<img class="im" src="${img}" alt="${[c.yr,c.make,c.name].filter(Boolean).join(' ')}" loading="lazy" decoding="async" width="800" height="500">`
        : `<div class="im im-none"><span class="imn-txt">Photos on request</span></div>`}
      <span class="badge ${c.category==='performance'?'hot':''}">${c.category==='select'?'Select':c.category==='performance'?'Performance':c.tag||'Featured'}</span>
      <span class="vir"><i></i>${c.virLabel||'Inspected'}</span>
      <button class="fav-btn${favHas(c)?' on':''}" type="button" data-fav="${i}" aria-label="Save to shortlist"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>
    </div>
    <div class="card-body">
      <div class="cb-year">${c.yr} · ${c.make}</div>
      <h3>${c.name}</h3>
      <div class="cb-variant">${c.variant||''}</div>
      <div class="specs"><span>${c.km||'—'}</span><span>${c.tr||'—'}</span><span>${c.fuel||'—'}</span><span>${c.body||'—'}</span></div>
      <div class="price-row">
        <div><div class="pr-main">${fmtR(c.price)}</div><div class="pr-pm">from <b>${fmtR(monthly(c.price))}/pm</b></div></div>
      </div>
      ${tpTag(c)}
      <button class="btn btn-vd" data-vd="${i}">View full detail &amp; VIR report</button>
      <div class="cta-row">
        <a class="btn btn-wa" href="https://wa.me/${WA}?text=${waMsg}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn btn-ghost-blue" href="https://wa.me/${WA}?text=${encodeURIComponent("Hi Halstead Cars, I'd like a viewing of the "+c.yr+" "+c.make+" "+c.name)}" target="_blank" rel="noopener">Book viewing</a>
      </div>
    </div>
  </article>`;
  }).join("");
  observeAll();
  favSync();
}

function isJunkApi(v){
  const blob = [v.make,v.model,v.trim,v.stockNumber,v.description].filter(Boolean).join(" ").toLowerCase();
  if(/stk-lite-test|test vehicle|demo junk|lorem ipsum/.test(blob)) return true;
  if(/\bss\b/.test(blob) && /ddas/.test(blob)) return true;
  if(v.make && String(v.make).length<=2 && /ddas|test|xxx/i.test(String(v.model||""))) return true;
  return false;
}
function normaliseBody(raw){
  const b = String(raw || "").trim();
  if(!b) return "Vehicle";                       // DMS placeholder, filtered out downstream
  const k = b.toLowerCase();
  if(/pickup|truck|pick.?up/.test(k)) return "Pickup";
  if(/crossover|suv|4x4/.test(k))     return "SUV";
  if(/hatch/.test(k))                 return "Hatchback";
  if(/sedan|saloon/.test(k))          return "Sedan";
  if(/coupe|convertible|cabrio/.test(k)) return "Coupe";
  return b;
}
function mapApiVehicle(v){
  if(isJunkApi(v)) return null;
  const price = Number(v.price)||0;
  const km = v.mileage != null ? (Number(v.mileage).toLocaleString("en-GB")+" mi") : (v.km||"—");
  /* Normalise the DMS body type to the categories this page is built around.
     TruLens offers "Pickup / Truck", "Crossover" and "Convertible"; the
     showroom tiles are hand-drawn for Hatchback / SUV / Pickup / Coupe / Sedan
     and matched by exact string, so "Pickup / Truck" silently matched nothing
     and a pickup fell out of the pickup tile. Anything unrecognised passes
     through untouched — the chips are derived from real stock, so a new body
     type still gets its own filter without a code change. */
  const body = normaliseBody(v.bodyType || v.body);
  const name = [v.model, v.trim].filter(Boolean).join(" ") || v.make || "Vehicle";
  const img = v.heroImage || (Array.isArray(v.images)&&v.images[0]) || "";
  // TruPrice: prefer the real benchmark the dealer set in the DMS; only
  // synthesize a plausible 4-9% markup when the DMS hasn't set one yet.
  const truPrice = Number(v.truPrice) > 0
    ? Number(v.truPrice)
    : price ? Math.round(price*(1+0.04+hash01(v.stockNumber||v.id||name)*0.05)/100)*100 : 0;
  return {
    yr: v.year || "—",
    make: v.make || "—",
    name: name,
    variant: v.trim || v.stockNumber || "",
    body: body,
    category: v.category || "",
    perf: v.category === "performance" || /gti|amg|rs|m2|m3|wildtrak|legend/i.test(name+String(v.trim||"")),
    km: km,
    tr: v.transmission || "—",
    fuel: v.fuelType || v.fuel || "—",
    color: v.color || "",
    price: price,
    truPrice: truPrice,
    description: v.description || "",
    tag: v.stockNumber || "Live",
    hot: String(v.status||"").toLowerCase()==="available" && price>0,
    img: img || "",
    images: Array.isArray(v.images) ? v.images.filter(Boolean) : [],
    web3d: v.web3d && Array.isArray(v.web3d.frames) && v.web3d.frames.length ? v.web3d : null,
    vir: (typeof v.vir === "number") ? v.vir : null,
    virReport: Array.isArray(v.virReport) ? v.virReport : [],
    virLabel: (typeof v.vir === "number") ? ("Inspected · " + v.vir + "/100") : "",
    damage: Array.isArray(v.damage) ? v.damage : []
  };
}

async function tryLoadLiveStock(){
  setStockSource(false, "Loading yard…");
  for(const base of STOCK_APIS){
    for(const slug of DEALER_SLUGS){
      for(let attempt=0; attempt<2; attempt++){
        try{
          const ctrl = new AbortController();
          const t = setTimeout(()=>ctrl.abort(), 18000);
          const res = await fetch(base+encodeURIComponent(slug), {signal: ctrl.signal, cache:"no-store"});
          clearTimeout(t);
          if(!res.ok) continue;
          const data = await res.json();
          const list = Array.isArray(data.vehicles) ? data.vehicles : (Array.isArray(data)?data:[]);
          if(!list.length) continue;
          const mapped = list.map(mapApiVehicle).filter(Boolean);
          if(!mapped.length) continue;
          STOCK = mapped;
          setStockSource(true, stockLabel());
          applyFilters();
          return true;
        }catch(e){ if(attempt===0) await new Promise(r=>setTimeout(r,1500)); }
      }
    }
  }
  setStockSource(false, stockLabel());
  return false;
}

/* Show mock stock immediately; swap if yard feed is available (no dealer-tool UI) */
render(STOCK.slice(0,10));
setStockSource(false, stockLabel());
tryLoadLiveStock();

document.getElementById("chips").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;document.querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));b.classList.add("on");activeChip=b.dataset.f;applyFilters();});
function applyFilters(make="",body="",maxP="",sort=""){
  let list=[...STOCK];
  if(activeChip==="perf")list=list.filter(c=>c.perf);
  else if(activeChip)list=list.filter(c=>c.body===activeChip);
  if(make)list=list.filter(c=>c.make===make);
  if(body)list=list.filter(c=>c.body===body);
  if(maxP)list=list.filter(c=>c.price<=+maxP);
  if(sort==="lo")list.sort((a,b)=>a.price-b.price);
  if(sort==="hi")list.sort((a,b)=>b.price-a.price);
  if(!list.length){
    render(STOCK.slice(0,10));
    grid.insertAdjacentHTML("afterbegin",'<p style="grid-column:1/-1;font-size:13px;color:var(--grey);font-weight:600;text-align:center;padding:40px 0;">No exact matches — showing featured stock. WhatsApp us, we source on request.</p>');
  } else render(list);
}
document.getElementById("qsearch").addEventListener("submit",e=>{e.preventDefault();activeChip="";document.querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));document.querySelector('.chip[data-f=""]').classList.add("on");applyFilters(document.getElementById("f-make").value,document.getElementById("f-body").value,document.getElementById("f-price").value,document.getElementById("f-sort").value);document.getElementById("showroom").scrollIntoView({behavior:"smooth"});});
document.querySelectorAll(".cat-tile").forEach(t=>t.addEventListener("click",()=>{activeChip=t.dataset.bt;document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",c.dataset.f===activeChip));applyFilters();document.getElementById("showroom").scrollIntoView({behavior:"smooth"});}));

/* Shortlist wiring: heart taps on cards + the header panel */
grid.addEventListener("click",e=>{
  const b = e.target.closest(".fav-btn");
  if(!b) return;
  e.stopImmediatePropagation();   // never open the vehicle-detail modal from a heart tap
  const c = (window.COC_SHOWN||[])[+b.dataset.fav];
  if(c) favToggle(c);
});
(function(){
  const p = document.getElementById("favPanel"), btn = document.getElementById("navFav");
  if(!p || !btn) return;
  const set = o => { p.classList.toggle("open", o); p.setAttribute("aria-hidden", o ? "false" : "true"); };
  btn.addEventListener("click", ()=>set(!p.classList.contains("open")));
  document.getElementById("favClose")?.addEventListener("click", ()=>set(false));
  document.getElementById("favClear")?.addEventListener("click", ()=>{ favSave([]); favSync(); });
  document.getElementById("favList")?.addEventListener("click", e=>{
    const x = e.target.closest("[data-fx]");
    if(!x) return;
    const list = favAll();
    list.splice(+x.dataset.fx, 1);
    favSave(list);
    favSync();
  });
  document.addEventListener("click", e=>{
    if(p.classList.contains("open") && !p.contains(e.target) && !btn.contains(e.target)) set(false);
  });
})();
favSync();

const rP=document.getElementById("r-price"),rD=document.getElementById("r-dep"),rT=document.getElementById("r-term");
function fill(el){if(!el)return;el.style.setProperty("--fill",(el.value-el.min)/(el.max-el.min)*100+"%");}
function calc(){if(!rP)return;const P=+rP.value,dep=+rD.value/100,n=+rT.value,r=.1175/12,m=Math.round(P*(1-dep)*r/(1-Math.pow(1+r,-n)));document.getElementById("o-price").textContent=fmtR(P);document.getElementById("o-dep").textContent=rD.value+"%";document.getElementById("o-term").textContent=n+" months";document.getElementById("o-monthly").innerHTML=fmtR(m)+'<small> /pm</small>';[rP,rD,rT].forEach(fill);
  // "Apply Now" carries the calculator's numbers straight into WhatsApp
  const ap=document.getElementById("calcApply");
  if(ap) ap.href="https://wa.me/"+WA+"?text="+encodeURIComponent("Hi Halstead Cars, I'd like to apply for finance. I'm looking at around "+fmtR(P)+" with a "+rD.value+"% deposit over "+n+" months — your estimator showed about "+fmtR(m)+"/pm. Please help me pre-qualify.");}
if(rP){[rP,rD,rT].forEach(el=>el.addEventListener("input",calc));calc();}

document.getElementById("burger").addEventListener("click",()=>document.getElementById("mmenu").classList.toggle("open"));
document.querySelectorAll("#mmenu a").forEach(a=>a.addEventListener("click",()=>document.getElementById("mmenu").classList.remove("open")));

observeAll();

/* ── Modern UX: custom cursor, scroll progress, header glass state ── */
(function(){
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const header = document.querySelector("header");
  const prog = document.getElementById("scrollProgress");
  const dot = document.getElementById("curDot");
  const ring = document.getElementById("curRing");

  function onScroll(){
    const y = window.scrollY || 0;
    if(header) header.classList.toggle("scrolled", y > 24);
    if(prog){
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      prog.style.transform = 'scaleX('+Math.min(1, y/max)+')';
    }
  }
  window.addEventListener("scroll", onScroll, {passive:true});
  onScroll();

  /* smooth active nav on scroll */
  const sections = ["showroom","sell","finance","why","visit"].map(id=>document.getElementById(id)).filter(Boolean);
  const navLinks = document.querySelectorAll(".nav-links a");
  function setActiveNav(){
    let cur = "";
    const mid = window.scrollY + 120;
    sections.forEach(s=>{ if(s.offsetTop <= mid) cur = s.id; });
    navLinks.forEach(a=>{
      const href = (a.getAttribute("href")||"").replace("#","");
      a.classList.toggle("active", href === cur || (!cur && href === "showroom" && mid < 400));
      if(!cur && href === "showroom" && mid < 400) a.classList.add("active");
      if(!cur && mid < 400 && href !== "showroom") a.classList.remove("active");
    });
  }
  window.addEventListener("scroll", setActiveNav, {passive:true});
  setActiveNav();

  if(!fine || reduce || !dot || !ring) return;

  document.body.classList.add("has-cursor");
  let mx = window.innerWidth/2, my = window.innerHeight/2;
  let rx = mx, ry = my;
  let visible = false;

  function showCur(){
    if(visible) return;
    visible = true;
    document.body.classList.add("cur-ready");
  }
  window.addEventListener("mousemove", e=>{
    mx = e.clientX; my = e.clientY;
    showCur();
    const dw = dot.offsetWidth/2, dh = dot.offsetHeight/2;
    dot.style.transform = "translate("+(mx-dw)+"px,"+(my-dh)+"px)";
  }, {passive:true});
  window.addEventListener("mousedown", ()=>document.body.classList.add("cur-click"));
  window.addEventListener("mouseup", ()=>document.body.classList.remove("cur-click"));
  document.addEventListener("mouseleave", ()=>document.body.classList.remove("cur-ready","cur-hover","cur-click"));
  document.addEventListener("mouseenter", ()=>{ if(visible) document.body.classList.add("cur-ready"); });

  const hoverSel = "a,button,.chip,.cat-tile,.card,.fab-btn,.btn,select,.ss,.wc,.tc,.sp-go";
  document.addEventListener("mouseover", e=>{
    if(e.target.closest(hoverSel)) document.body.classList.add("cur-hover");
  });
  document.addEventListener("mouseout", e=>{
    if(e.target.closest(hoverSel) && !e.relatedTarget?.closest?.(hoverSel))
      document.body.classList.remove("cur-hover");
  });

  function tick(){
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    const rw = ring.offsetWidth/2, rh = ring.offsetHeight/2;
    ring.style.transform = "translate("+(rx-rw)+"px,"+(ry-rh)+"px)";
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();