/* ============================================================
   TRUECAR SA — Inventory Data Model
   Powers home, inventory, vehicle detail, finance, chatbot.
   Prices in ZAR. "truecarPrice" = market-fair benchmark.

   This file initialises an EMPTY vehicle array. All stock is
   pulled live from TruFlow Premium via stock-bridge.js.
   ============================================================ */
window.TCSA = window.TCSA || {};

TCSA.brandPhone = "+27620502091";
TCSA.brandPhoneDisplay = "+27 62 050 2091";

/* Body-type SVG silhouettes used as fallback placeholders */
TCSA.silhouette = function(kind){
  const c = {suv:'M18 62 L18 50 Q18 44 26 42 L44 36 Q52 30 66 30 L104 30 Q120 30 130 42 L150 44 Q168 46 172 54 L172 62',
    bakkie:'M12 62 L12 48 Q12 44 20 44 L60 44 Q66 34 82 34 L104 34 Q112 34 116 44 L176 44 L182 50 L182 62',
    hatch:'M20 62 L20 50 Q22 44 34 42 L54 34 Q64 28 82 28 L112 28 Q132 30 142 42 L162 46 Q172 48 172 56 L172 62',
    sedan:'M14 62 L16 50 Q18 44 32 42 L56 32 Q68 26 92 26 L124 26 Q144 28 156 42 L176 48 Q182 50 182 56 L182 62',
    coupe:'M16 62 L18 52 Q22 44 38 42 L64 30 Q80 24 104 26 L140 28 Q162 32 172 46 L180 52 L180 62'};
  return `<svg viewBox="0 0 196 78" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:62%;opacity:.20">
    <path d="${c[kind]||c.sedan}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="58" cy="62" r="11" stroke="currentColor" stroke-width="2.4"/>
    <circle cx="140" cy="62" r="11" stroke="currentColor" stroke-width="2.4"/>
  </svg>`;
};

/* Empty — populated by stock-bridge.js from TruFlow live feed */
TCSA.vehicles = [];

/* ---------------- Formatting helpers ---------------- */
TCSA.fmtPrice = function(n){ return 'R' + n.toLocaleString('en-ZA'); };
TCSA.monthly = function(price, opts){
  opts = opts || {};
  const deposit = opts.deposit != null ? opts.deposit : price*0.10;
  const term = opts.term || 72;
  const rate = (opts.rate != null ? opts.rate : 11.75)/100/12;
  const balloon = (opts.balloon || 0)/100 * price;
  const principal = price - deposit;
  const pv = principal - balloon/Math.pow(1+rate,term);
  const m = pv * rate / (1 - Math.pow(1+rate,-term));
  return Math.round(m + balloon*rate);
};
TCSA.priceDelta = function(v){
  const d = v.truecarPrice - v.price;
  const pct = Math.round(Math.abs(d)/v.truecarPrice*100);
  return { below: d>=0, amount:Math.abs(d), pct };
};

/* ---------------- Vehicle card renderer (shared) ---------------- */
TCSA.vcard = function(v){
  const m = TCSA.monthly(v.price);
  const delta = TCSA.priceDelta(v);
  const badges = (v.badges||[]).map(b=>`<span class="vbadge ${b.c}">${b.t}</span>`).join('');
  const lvsTag = v.lvs ? `<span class="vtag lvs" title="Live Video Stream available"><span class="dot"></span><b>LVS</b></span>` : '';
  const truecar = delta.below
    ? `<span class="truecar-tag win"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg><b>${TCSA.fmtPrice(delta.amount)}</b> below TruPrice</span>`
    : `<span class="truecar-tag" style="color:var(--grey-dark);background:var(--bone);border-color:var(--line)">Fair TruPrice</span>`;
  const img = v.img
    ? `<img src="${v.thumb || v.img}" srcset="${v.thumb ? v.thumb + ' 480w, ' + v.img + ' 960w' : ''}" sizes="(max-width:760px) 92vw, 400px" alt="${v.year} ${v.make} ${v.model}" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="vcard-fallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;color:#fff">${TCSA.silhouette(v.body)}</div>`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff">${TCSA.silhouette(v.body)}</div>`;
  const virRing = v.vir
    ? `<span class="vir-ring" title="TruVIR condition score — AI graded">
        <svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="15.5" pathLength="100"/><circle class="fg" cx="18" cy="18" r="15.5" pathLength="100" style="--vir:${v.vir}"/></svg>
        <b>${v.vir}</b><i>VIR</i>
      </span>`
    : '';
  const locationLine = v.location ? v.location : '';
  return `<article class="vcard" data-id="${v.id}">
    <a class="vcard-media" href="vehicle.html?id=${v.id}">
      ${img}
      <div class="vcard-badges">${badges}</div>
      ${virRing}
      <div class="vcard-tags">
        ${lvsTag}
        ${v.tags && v.tags.includes('Tru3D') ? '<span class="vtag" title="Tru3D orbit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 100 18M3 12h4m10 0h4"/></svg><b>Tru3D</b></span>' : ''}
      </div>
    </a>
    <div class="vcard-body">
      <a href="vehicle.html?id=${v.id}"><div class="vcard-title">${v.year} ${v.make} ${v.model}</div></a>
      <div class="vcard-variant">${v.variant}${v.colour ? ' · ' + v.colour : ''}</div>
      <div class="vcard-price">${TCSA.fmtPrice(v.price)}<span class="pm">or ~${TCSA.fmtPrice(m)}/mo${locationLine ? ' · ' + locationLine : ''}</span></div>
      ${truecar}
      <div class="vcard-meta">
        <div class="m"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="4"/></svg><span>${v.km.toLocaleString('en-ZA')} km</span></div>
        <div class="m"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l4-7h10l4 7M6 17h.01M18 17h.01"/></svg><span>${v.fuel}</span></div>
        <div class="m"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span>${v.trans==='Automatic'?'Auto':'Manual'}</span></div>
      </div>
      <div class="vcard-actions">
        <a class="btn btn-dark btn-sm" href="vehicle.html?id=${v.id}"><span>View &amp; Tru3D</span></a>
        <a class="btn btn-wa" href="https://wa.me/${TCSA.brandPhone.replace('+','')}?text=${encodeURIComponent('Hi, I\'m interested in the '+v.year+' '+v.make+' '+v.model+' ('+TCSA.fmtPrice(v.price)+') — '+v.id)}" aria-label="WhatsApp" style="padding:0">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-1.5-.8-2.6-1.4-3.6-3.1-.3-.5.3-.5.7-1.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3 1.8.8 2.5.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.2-1.3-.1-.2-.3-.2-.6-.3z"/></svg>
        </a>
      </div>
    </div>
  </article>`;
};

TCSA.byId = function(id){ return TCSA.vehicles.find(v=>v.id===id); };
