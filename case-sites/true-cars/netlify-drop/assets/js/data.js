/* ============================================================
   TRUECAR SA — Inventory Data Model
   Powers home, inventory, vehicle detail, finance, chatbot.
   Prices in ZAR. "truecarPrice" = market-fair benchmark.

   Mock stock loads immediately so the site is never empty.
   stock-bridge.js replaces it with live DMS data when available.
   ============================================================ */
window.TCSA = window.TCSA || {};

TCSA.brandPhone = "+27620502091";
TCSA.brandPhoneDisplay = "+27 62 050 2091";

/* ── Mock stock ── */
TCSA._staticVehicles = [
  {id:"volkswagen-golf-gti-22",stockNumber:"TC-001",make:"Volkswagen",model:"Golf GTI",variant:"2.0 TSI DSG",year:2022,price:489900,truecarPrice:519000,km:38000,fuel:"Petrol",trans:"Automatic",body:"hatch",power:"180kW",drive:"FWD",colour:"Tornado Red",vin:"",location:"Cape Town",category:"performance",badges:[{t:"Performance",c:"hot"},{t:"Great Price",c:"good"}],vir:87,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"Hot hatch icon with DSG and full VW service history.",img:"assets/img/cars/golf-gti-22-side.png",thumb:"assets/img/cars/golf-gti-22-side.png",gallery:["assets/img/cars/golf-gti-22-side.png"],liveFromDms:false,source:"mock",daysInStock:12},
  {id:"volkswagen-golf-r-23",stockNumber:"TC-002",make:"Volkswagen",model:"Golf R",variant:"2.0 TSI 4Motion DSG",year:2023,price:749900,truecarPrice:789000,km:15000,fuel:"Petrol",trans:"Automatic",body:"hatch",power:"235kW",drive:"AWD",colour:"Lapiz Blue",vin:"",location:"Cape Town",category:"performance",badges:[{t:"Performance",c:"hot"},{t:"Great Price",c:"good"},{t:"Near New",c:"hot"}],vir:94,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:true,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"The ultimate Golf. 4Motion AWD, 235kW, barely run in.",img:"assets/img/cars/golf-r-23-side.png",thumb:"assets/img/cars/golf-r-23-side.png",gallery:["assets/img/cars/golf-r-23-side.png"],liveFromDms:false,source:"mock",daysInStock:8},
  {id:"toyota-fortuner-28-20",stockNumber:"TC-003",make:"Toyota",model:"Fortuner",variant:"2.8 GD-6 4x4 Auto",year:2020,price:529900,truecarPrice:559000,km:82000,fuel:"Diesel",trans:"Automatic",body:"suv",power:"150kW",drive:"4WD",colour:"White",vin:"",location:"Cape Town",category:null,badges:[{t:"Great Price",c:"good"}],vir:81,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["VIR"],featured:true,blurb:"South Africa's favourite family 4x4. Full Toyota history.",img:"assets/img/cars/fortuner-23-side.png",thumb:"assets/img/cars/fortuner-23-side.png",gallery:["assets/img/cars/fortuner-23-side.png"],liveFromDms:false,source:"mock",daysInStock:21},
  {id:"toyota-hilux-legend-23",stockNumber:"TC-004",make:"Toyota",model:"Hilux",variant:"2.8 GD-6 Legend RS 4x4 DC",year:2023,price:679900,truecarPrice:719000,km:28000,fuel:"Diesel",trans:"Automatic",body:"bakkie",power:"150kW",drive:"4WD",colour:"Oxide Bronze",vin:"",location:"Cape Town",category:null,badges:[{t:"Great Price",c:"good"}],vir:92,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"Legend RS with all the extras. 4x4, leather, diff-lock.",img:"assets/img/cars/hilux-legend-23-side.png",thumb:"assets/img/cars/hilux-legend-23-side.png",gallery:["assets/img/cars/hilux-legend-23-side.png"],liveFromDms:false,source:"mock",daysInStock:14},
  {id:"ford-ranger-wildtrak-22",stockNumber:"TC-005",make:"Ford",model:"Ranger",variant:"3.0 V6 Wildtrak 4x4 DC",year:2022,price:589900,truecarPrice:625000,km:45000,fuel:"Diesel",trans:"Automatic",body:"bakkie",power:"184kW",drive:"4WD",colour:"Sea Grey",vin:"",location:"Cape Town",category:null,badges:[{t:"Great Price",c:"good"}],vir:85,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["VIR"],featured:true,blurb:"Next-gen Ranger Wildtrak. V6 bi-turbo, loaded.",img:"assets/img/cars/ranger-wildtrak-22-side.png",thumb:"assets/img/cars/ranger-wildtrak-22-side.png",gallery:["assets/img/cars/ranger-wildtrak-22-side.png"],liveFromDms:false,source:"mock",daysInStock:18},
  {id:"bmw-m4-competition-22",stockNumber:"TC-006",make:"BMW",model:"M4 Competition",variant:"xDrive Coupé",year:2022,price:1249900,truecarPrice:1319000,km:22000,fuel:"Petrol",trans:"Automatic",body:"coupe",power:"375kW",drive:"AWD",colour:"Isle of Man Green",vin:"",location:"Cape Town",category:"performance",badges:[{t:"Performance",c:"hot"},{t:"Great Price",c:"good"}],vir:93,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:true,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"510hp twin-turbo straight-six. xDrive. Carbon bucket seats.",img:"assets/img/cars/m4-comp-22-side.png",thumb:"assets/img/cars/m4-comp-22-side.png",gallery:["assets/img/cars/m4-comp-22-side.png"],liveFromDms:false,source:"mock",daysInStock:9},
  {id:"porsche-911-carrera-21",stockNumber:"TC-007",make:"Porsche",model:"911 Carrera",variant:"S PDK",year:2021,price:1849900,truecarPrice:1949000,km:31000,fuel:"Petrol",trans:"Automatic",body:"coupe",power:"331kW",drive:"RWD",colour:"Guards Red",vin:"",location:"Cape Town",category:"performance",badges:[{t:"Performance",c:"hot"},{t:"Great Price",c:"good"}],vir:96,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:true,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"992 Carrera S. Sport Chrono, PASM, Sport Exhaust.",img:"assets/img/cars/911-carrera-21-side.png",thumb:"assets/img/cars/911-carrera-21-side.png",gallery:["assets/img/cars/911-carrera-21-side.png"],liveFromDms:false,source:"mock",daysInStock:5},
  {id:"volkswagen-polo-tsi-23",stockNumber:"TC-008",make:"Volkswagen",model:"Polo",variant:"1.0 TSI Life",year:2023,price:299900,truecarPrice:319000,km:12000,fuel:"Petrol",trans:"Manual",body:"hatch",power:"70kW",drive:"FWD",colour:"Reflex Silver",vin:"",location:"Cape Town",category:null,badges:[{t:"Great Price",c:"good"},{t:"Near New",c:"hot"}],vir:91,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"Balance of factory plan. Like-new Polo at used price.",img:"assets/img/cars/polo-tsi-23-side.png",thumb:"assets/img/cars/polo-tsi-23-side.png",gallery:["assets/img/cars/polo-tsi-23-side.png"],liveFromDms:false,source:"mock",daysInStock:7},
  {id:"toyota-corolla-cross-23",stockNumber:"TC-009",make:"Toyota",model:"Corolla Cross",variant:"1.8 XS Hybrid",year:2023,price:449900,truecarPrice:479000,km:19000,fuel:"Hybrid",trans:"Automatic",body:"suv",power:"90kW",drive:"FWD",colour:"Celestite Grey",vin:"",location:"Cape Town",category:null,badges:[{t:"Hybrid",c:"hot"},{t:"Great Price",c:"good"}],vir:90,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["VIR"],featured:true,blurb:"Hybrid efficiency meets crossover practicality.",img:"assets/img/cars/corolla-cross-23-side.png",thumb:"assets/img/cars/corolla-cross-23-side.png",gallery:["assets/img/cars/corolla-cross-23-side.png"],liveFromDms:false,source:"mock",daysInStock:16},
  {id:"mercedes-gwagen-22",stockNumber:"TC-010",make:"Mercedes-Benz",model:"G-Class",variant:"G 63 AMG",year:2022,price:3299900,truecarPrice:3499000,km:18000,fuel:"Petrol",trans:"Automatic",body:"suv",power:"430kW",drive:"4WD",colour:"Obsidian Black",vin:"",location:"Cape Town",category:"select",badges:[{t:"Premium Select",c:"gold"},{t:"Great Price",c:"good"}],vir:95,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:true,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"The icon. G 63 AMG, Burmester, 360 cameras.",img:"assets/img/cars/gwagen-22-side.png",thumb:"assets/img/cars/gwagen-22-side.png",gallery:["assets/img/cars/gwagen-22-side.png"],liveFromDms:false,source:"mock",daysInStock:3},
  {id:"range-rover-sport-22",stockNumber:"TC-011",make:"Land Rover",model:"Range Rover Sport",variant:"P530 First Edition",year:2022,price:2649900,truecarPrice:2799000,km:21000,fuel:"Petrol",trans:"Automatic",body:"suv",power:"390kW",drive:"AWD",colour:"Firenze Red",vin:"",location:"Cape Town",category:"select",badges:[{t:"Premium Select",c:"gold"},{t:"Great Price",c:"good"}],vir:91,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:true,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"New-shape Sport. V8 Twin-Turbo, air suspension, Meridian.",img:"assets/img/cars/rangerover-sport-22-side.png",thumb:"assets/img/cars/rangerover-sport-22-side.png",gallery:["assets/img/cars/rangerover-sport-22-side.png"],liveFromDms:false,source:"mock",daysInStock:11},
  {id:"volkswagen-polo-vivo-22",stockNumber:"TC-012",make:"Volkswagen",model:"Polo Vivo",variant:"1.4 Comfortline",year:2022,price:219900,truecarPrice:235000,km:41000,fuel:"Petrol",trans:"Manual",body:"hatch",power:"63kW",drive:"FWD",colour:"Flash Red",vin:"",location:"Cape Town",category:null,badges:[{t:"Great Price",c:"good"}],vir:83,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["VIR"],featured:true,blurb:"SA's best-seller. Low running costs, bulletproof reliability.",img:"assets/img/cars/polo-vivo-22-side.png",thumb:"assets/img/cars/polo-vivo-22-side.png",gallery:["assets/img/cars/polo-vivo-22-side.png"],liveFromDms:false,source:"mock",daysInStock:25},
  {id:"toyota-hilux-28-22",stockNumber:"TC-013",make:"Toyota",model:"Hilux",variant:"2.8 GD-6 Raider 4x4 DC",year:2022,price:549900,truecarPrice:579000,km:55000,fuel:"Diesel",trans:"Automatic",body:"bakkie",power:"150kW",drive:"4WD",colour:"Glacier White",vin:"",location:"Cape Town",category:null,badges:[{t:"Great Price",c:"good"}],vir:84,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["VIR"],featured:true,blurb:"Raider spec with canopy. 4x4, leather, diff-lock.",img:"assets/img/cars/hilux-2831-22-side.png",thumb:"assets/img/cars/hilux-2831-22-side.png",gallery:["assets/img/cars/hilux-2831-22-side.png"],liveFromDms:false,source:"mock",daysInStock:19},
  {id:"byd-seal-24",stockNumber:"TC-014",make:"BYD",model:"Seal",variant:"Excellence AWD",year:2024,price:799900,truecarPrice:849000,km:4500,fuel:"Electric",trans:"Automatic",body:"sedan",power:"390kW",drive:"AWD",colour:"Aurora White",vin:"",location:"Cape Town",category:"performance",badges:[{t:"Electric",c:"hot"},{t:"Near New",c:"hot"},{t:"Great Price",c:"good"}],vir:97,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:true,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"Dual motor, 530km range, 0-100 in 3.8s. The EV benchmark.",img:"assets/img/cars/byd-seal-24-side.png",thumb:"assets/img/cars/byd-seal-24-side.png",gallery:["assets/img/cars/byd-seal-24-side.png"],liveFromDms:false,source:"mock",daysInStock:4},
  {id:"byd-atto3-23",stockNumber:"TC-015",make:"BYD",model:"Atto 3",variant:"Extended Range",year:2023,price:549900,truecarPrice:579000,km:18000,fuel:"Electric",trans:"Automatic",body:"suv",power:"150kW",drive:"FWD",colour:"Surf Blue",vin:"",location:"Cape Town",category:null,badges:[{t:"Electric",c:"hot"},{t:"Great Price",c:"good"}],vir:89,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["VIR"],featured:true,blurb:"Electric crossover with 420km range. Loaded with tech.",img:"assets/img/cars/byd-atto3-23-side.png",thumb:"assets/img/cars/byd-atto3-23-side.png",gallery:["assets/img/cars/byd-atto3-23-side.png"],liveFromDms:false,source:"mock",daysInStock:13},
  {id:"byd-dolphin-24",stockNumber:"TC-016",make:"BYD",model:"Dolphin",variant:"Extended Range",year:2024,price:449900,truecarPrice:469000,km:3200,fuel:"Electric",trans:"Automatic",body:"hatch",power:"150kW",drive:"FWD",colour:"Coral Pink",vin:"",location:"Cape Town",category:null,badges:[{t:"Electric",c:"hot"},{t:"Near New",c:"hot"},{t:"Great Price",c:"good"}],vir:96,virReport:null,damage:null,web3d:null,web3dUrl:null,premium:false,certUsed:true,tags:["Tru3D","VIR"],featured:true,blurb:"Affordable EV with 427km range. Fun, practical, efficient.",img:"assets/img/cars/byd-dolphin-24-side.png",thumb:"assets/img/cars/byd-dolphin-24-side.png",gallery:["assets/img/cars/byd-dolphin-24-side.png"],liveFromDms:false,source:"mock",daysInStock:6}
];

TCSA.vehicles = TCSA._staticVehicles.slice();

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
  /* Strictly greater. `d>=0` counted an exact match as a saving, so a car
     priced level with its TruPrice benchmark advertised "R0 below TruPrice" —
     which reads as a broken number rather than the fair price it actually is.
     Zero now falls through to the "Fair TruPrice" branch. */
  return { below: d>0, amount:Math.abs(d), pct };
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
