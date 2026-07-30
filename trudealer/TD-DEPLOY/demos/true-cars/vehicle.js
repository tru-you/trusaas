/* The whole page is built from one vehicle, and the stock arrives
   asynchronously. This ran at parse time, when TCSA.vehicles is still the empty
   array data.js ships — so `v` was undefined, every block below hit its
   `if(!v) return` guard, and the detail page rendered blank for a car that was
   live in the feed. Everything is wrapped in renderVehiclePage() and run once
   stock is actually in hand; the bridge fires tcsa:stock when its fetch chain
   resolves, and the immediate call covers a warm cache where it already has. */
function renderVehiclePage(){
const id = new URLSearchParams(location.search).get('id') || 'porsche-cayenne-s-19';
const v = TCSA.byId(id) || TCSA.vehicles[0];

/* ---- Populate mobile vehicle hero banner ---- */
(function(){
  const title = document.getElementById('mobVehTitle');
  const variant = document.getElementById('mobVehVariant');
  const price = document.getElementById('mobVehPrice');
  const badge = document.getElementById('mobVehTCBadge');
  const pills = document.getElementById('mobVehPills');
  const crumb = document.getElementById('mobCrumbName');
  if(!title || !v) return;
  const name = v.year + ' ' + v.make + ' ' + v.model;
  title.textContent = name;
  if(crumb) crumb.textContent = v.make + ' ' + v.model;
  if(variant) variant.textContent = v.variant || '';
  if(price) price.textContent = TCSA.fmtPrice(v.price);
  const d = TCSA.priceDelta(v);
  if(badge) badge.innerHTML = d.below
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="width:11px;height:11px"><path d="M20 6L9 17l-5-5"/></svg> ${TCSA.fmtPrice(d.amount)} below TruPrice`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="width:11px;height:11px"><path d="M20 6L9 17l-5-5"/></svg> Fair TruPrice`;
  if(pills){
    const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="${path}"/></svg>`;
    pills.innerHTML = [
      `<span class="mob-veh-pill">${icon('M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l4 2')} ${v.km ? v.km.toLocaleString('en-ZA') + ' km' : '—'}</span>`,
      `<span class="mob-veh-pill">${icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z')} ${v.fuel || '—'}</span>`,
      `<span class="mob-veh-pill">${icon('M9 12l2 2 4-4')} VIR ${v.vir || '—'}/100</span>`,
      v.lvs ? `<span class="mob-veh-pill" style="border-color:rgba(255,77,77,.3);color:#FFC2C2"><span style="width:7px;height:7px;border-radius:50%;background:#FF4D4D;display:inline-block;margin-right:2px"></span> Live viewing</span>` : ''
    ].join('');
  }
})();


/* ---- TruSaaS Tru3D (replaces legacy Tru3D orbit) ---- */
const dmgData = (v.damage && v.damage.length)
  ? v.damage.map(function(d){ return {t:d.title||d.t||'Noted item', n:d.note||d.n||'', sev:d.severity||d.sev||'minor'}; })
  : [];

(function mountWeb3D(){
  const root = document.getElementById('web3dMount');
  if (!root || !TCSA.loadWeb3DForVehicle) return;
  const go = function(){ TCSA.loadWeb3DForVehicle(root, v); };
  if (TCSA.loadLiveStock) {
    TCSA.loadLiveStock().then(function(){
      const live = TCSA.byId && TCSA.byId(v.id);
      if (live) Object.assign(v, live);
      go();
    }).catch(go);
  } else {
    go();
  }
})();

/* ---- populate details ---- */
const delta=TCSA.priceDelta(v);
document.title=`${v.year} ${v.make} ${v.model} — True-Cars SA`;
document.getElementById('crumbName').textContent=`${v.make} ${v.model}`;
document.getElementById('vtTitle').textContent=`${v.year} ${v.make} ${v.model}`.toUpperCase();
document.getElementById('vtOdo').textContent=`Odometer: ${v.km.toLocaleString('en-ZA')} km`;
document.getElementById('specHead').textContent=`Specifications of this ${v.make}`;
const bodyName={suv:'SUV',bakkie:'Bakkie',hatch:'Hatchback',sedan:'Sedan',coupe:'Coupé'}[v.body];
const stock=v.stockNumber||'—';
document.getElementById('specCol1').innerHTML=[['Body Style',bodyName],['Odometer',v.km?v.km.toLocaleString('en-ZA')+' km':'—'],['Transmission',v.trans||'—'],['Stock #',stock]].map(s=>`<div class="vspec"><span class="l">${s[0]}</span><span class="v">${s[1]}</span></div>`).join('');
document.getElementById('specCol2').innerHTML=[['Fuel',v.fuel],['Power',v.power||'—'],['Drive Type',v.drive||'—'],['Colour',v.colour]].map(s=>`<div class="vspec"><span class="l">${s[0]}</span><span class="v">${s[1]}</span></div>`).join('');
// VIN + barcode
const vin=v.vin||'';
document.getElementById('vin').textContent=vin?'VIN '+vin:'';
if(vin){let seed=0;for(const ch of vin)seed+=ch.charCodeAt(0);function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}let bx='',x=2;for(let i=0;i<40;i++){const w=1+Math.floor(rnd()*3);if(i%2===0)bx+=`<rect x="${x}" y="2" width="${w}" height="34" fill="#16222e"/>`;x+=w+1;}document.getElementById('barcode').innerHTML=bx;}else{document.getElementById('barcode').innerHTML='';}

document.getElementById('vTitle').textContent=`${v.year} ${v.make} ${v.model}`;
document.getElementById('vVariant').textContent=`${v.variant} · ${v.colour}`;
document.getElementById('vPrice').textContent=TCSA.fmtPrice(v.price);
document.getElementById('buyBadges').innerHTML=(v.badges||[]).map(b=>`<span class="vbadge ${b.c}">${b.t}</span>`).join('')+(v.category==='select'?'<span class="vbadge gold">Premium Select</span>':v.category==='performance'?'<span class="vbadge perf">Performance</span>':'');
document.getElementById('vDelta').innerHTML=delta.below?`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>${TCSA.fmtPrice(delta.amount)} below TruPrice`:`Fair TruPrice`;
if(!delta.below) document.getElementById('vDelta').style.cssText='color:var(--grey-dark);background:var(--bone);border-color:var(--line)';
document.getElementById('pbFill').style.width=Math.max(8,Math.min(96,(v.price/(v.truecarPrice*1.15))*100))+'%';

/* TruPrice Meter */
(function(){
  const ratio = v.price / v.truecarPrice;
  const pct = Math.max(4, Math.min(96, ((ratio - 0.85) / 0.30) * 100));
  const d = TCSA.priceDelta(v);
  const marker = document.getElementById('pmMarker');
  const verdict = document.getElementById('pmVerdict');
  setTimeout(()=>{ marker.style.left = pct + '%'; }, 200);
  let icon, cls, title, desc;
  if(d.below && d.pct >= 8){ cls='great'; icon='<path d="M20 6L9 17l-5-5"/>'; title='Great deal'; desc=TCSA.fmtPrice(d.amount)+' below market — top '+d.pct+'% value'; }
  else if(d.below){ cls='great'; icon='<path d="M20 6L9 17l-5-5"/>'; title='Good price'; desc=TCSA.fmtPrice(d.amount)+' below TruPrice market average'; }
  else { cls='fair'; icon='<path d="M5 12h14"/>'; title='Fair price'; desc='At or near TruPrice market average'; }
  verdict.innerHTML='<div class="pm-icon '+cls+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">'+icon+'</svg></div><div><b>'+title+'</b><br><span>'+desc+'</span></div>';
})();

/* TruChat Insight CTA — shows contextual prompts beneath price meter */
(function(){
  const d = TCSA.priceDelta(v);
  const el = document.getElementById('lunaInsight');
  const btn = document.getElementById('lunaInsightBtn');
  const txt = document.getElementById('lunaInsightText');
  if(d.below && d.pct >= 3){
    txt.textContent = 'Ask TruChat why this ' + v.make + ' ' + v.model + ' is ' + TCSA.fmtPrice(d.amount) + ' below market';
    el.style.display = '';
  } else if(v.fuel === 'Electric' || v.fuel === 'Hybrid'){
    txt.textContent = 'Ask TruChat about charging & running costs for this ' + v.model;
    el.style.display = '';
  } else if(v.km > 100000){
    txt.textContent = 'Ask TruChat about high-mileage reliability for the ' + v.make + ' ' + v.model;
    el.style.display = '';
  }
  btn.addEventListener('click', function(){
    if(window.TCSA && TCSA.chat) TCSA.chat.openWith(txt.textContent.replace('Ask TruChat ', ''));
  });
})();

const specs=[['Year',v.year],['Mileage',v.km.toLocaleString('en-ZA')+' km'],['Fuel',v.fuel],['Transmission',v.trans],['Power',v.power||'—'],['Drivetrain',v.drive||'—'],['Location',v.location],['Body',bodyName]];
if(v.range)specs.push(['Range',v.range]);
document.getElementById('specGrid').innerHTML=specs.map(s=>`<div class="spec"><div class="l">${s[0]}</div><div class="v">${s[1]}</div></div>`).join('');
document.getElementById('waBtn').href=`https://wa.me/27620502091?text=${encodeURIComponent("Hi True-Cars SA, I'm interested in the "+v.year+' '+v.make+' '+v.model+' ('+TCSA.fmtPrice(v.price)+')')}`;

(function(){
  const score = v.vir || 0;
  const arc=document.getElementById('scoreArc'),circ=264;
  if(score){
    setTimeout(()=>{arc.style.transition='stroke-dashoffset 1.4s var(--ease)';arc.style.strokeDashoffset=circ*(1-score/100);},300);
    let n=0;const t=setInterval(()=>{n+=2;if(n>=score){n=score;clearInterval(t);}document.getElementById('scoreNum').textContent=n;},22);
  } else { document.getElementById('scoreNum').textContent='—'; }
  document.getElementById('scoreVerdict').textContent=
    score>=95?'Excellent condition':score>=85?'Very good condition':score>=70?'Good condition':score>0?'Fair — some items noted':'Not yet inspected';

  /* VIR checks — rendered from virReport sections (damage-based) */
  const okSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';
  const warnSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z"/></svg>';
  const checks = document.getElementById('virChecks');
  if(v.virReport && v.virReport.length){
    checks.innerHTML = v.virReport.map(function(r){
      const ok = r.status === 'Pass';
      return '<div class="vir-check '+(ok?'ok':'warn')+'">'+(ok?okSvg:warnSvg)+r.section+' — '+(ok?'Clear':'Attention ('+r.score+'/100)')+'</div>';
    }).join('');
  } else if(score >= 95){
    checks.innerHTML = '<div class="vir-check ok">'+okSvg+'No damage findings recorded — exceptional condition</div>';
  } else {
    checks.innerHTML = '<div class="vir-check ok">'+okSvg+'Inspection pending — report available after TruLens capture</div>';
  }
})();
document.getElementById('dmgList').innerHTML=dmgData.map((d,i)=>`<div class="dmg ${d.sev==='note'||d.sev>=3?'note':''}"><div class="di">${i+1}</div><div><b>${d.t}</b><p>${d.n}</p></div></div>`).join('')||'<p style="font-size:13.5px;color:var(--grey-dark)">No cosmetic defects recorded.</p>';

/* AI damage stats from real data */
(function(){
  var damage = v.damage || [];
  var panels = new Set(); damage.forEach(function(d){ panels.add(d.panel || d.slotId || 'General'); });
  var totalPanels = 12;
  var clearPanels = totalPanels - panels.size;
  document.getElementById('tchekPanels').textContent = clearPanels + ' / ' + totalPanels;
  var sevLabels = {1:'cosmetic',2:'minor',3:'moderate',4:'major',5:'critical'};
  if(damage.length === 0){
    document.getElementById('tchekFindings').textContent = 'None';
    document.getElementById('tchekRepair').textContent = 'R 0';
  } else {
    var maxSev = Math.max.apply(null, damage.map(function(d){return d.severity||1;}));
    document.getElementById('tchekFindings').textContent = damage.length + ' ' + (sevLabels[maxSev]||'noted');
    var repairEst = damage.reduce(function(s,d){ return s + ({1:0,2:350,3:850,4:2500,5:6000}[d.severity]||500); }, 0);
    document.getElementById('tchekRepair').textContent = 'R ' + repairEst.toLocaleString('en-ZA');
  }
})();

/* watch/favourite toggles */
document.getElementById('btnWatch').addEventListener('click',function(){this.classList.toggle('on');TCSA.toast(this.classList.contains('on')?'Added to your Watch list — we\'ll alert you on price drops.':'Removed from Watch list.');});
document.getElementById('btnFav').addEventListener('click',function(){this.classList.toggle('on');TCSA.toast(this.classList.contains('on')?'Saved to Favourites ★':'Removed from Favourites.');});

/* finance calc */
function calc(){const dep=+depEl.value,term=+termEl.value,bal=+balEl.value,rate=+rateEl.value;
  document.getElementById('depV').textContent=dep+'%';document.getElementById('termV').textContent=term+' months';document.getElementById('balV').textContent=bal+'%';document.getElementById('rateV').textContent=rate.toFixed(2)+'%';
  const m=TCSA.monthly(v.price,{deposit:v.price*dep/100,term,rate,balloon:bal});document.getElementById('calcM').innerHTML=TCSA.fmtPrice(m)+'<small>/mo</small>';}
const depEl=document.getElementById('dep'),termEl=document.getElementById('term'),balEl=document.getElementById('bal'),rateEl=document.getElementById('rate');
[depEl,termEl,balEl,rateEl].forEach(el=>el.addEventListener('input',calc));calc();

/* reserve + booking modal (LVS / test drive) */
document.getElementById('reserveBtn').addEventListener('click',()=>{TCSA.leads.add({name:'(reservation started)',source:'Reservation',intent:`Reserve ${v.year} ${v.make} ${v.model}`,value:TCSA.fmtPrice(v.price),status:'New'});TCSA.toast('Reservation started — our team will confirm your R2 500 hold.');});
const modal=document.getElementById('bookModal');let bookMode='LVS';
function openBook(mode){bookMode=mode;
  document.getElementById('mEyebrow').textContent=mode==='LVS'?'Live Video Stream':'Test Drive';
  document.getElementById('mTitle').textContent=mode==='LVS'?'Book your live viewing':'Book a test drive';
  document.getElementById('mBlurb').textContent=mode==='LVS'?'A product specialist walks this exact car on a live video call — engine bay, tyres, underbody, any VIR-flagged marks. You point, they show.':'Get behind the wheel at your nearest branch, or we\'ll bring it to you. No pressure, no obligation.';
  modal.classList.add('open');}
document.getElementById('lvsBtn').addEventListener('click',()=>openBook('LVS'));
document.getElementById('testBtn').addEventListener('click',()=>openBook('Test drive'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});
const slotList=['Today 15:00','Today 17:00','Tomorrow 09:00','Tomorrow 12:00','Sat 10:00','Sat 14:00'];let chosen=null;
document.getElementById('slots').innerHTML=slotList.map(s=>`<div class="slot">${s}</div>`).join('');
document.querySelectorAll('#slots .slot').forEach(s=>s.addEventListener('click',()=>{document.querySelectorAll('#slots .slot').forEach(x=>x.classList.remove('on'));s.classList.add('on');chosen=s.textContent;}));
document.getElementById('mConfirm').addEventListener('click',()=>{const name=document.getElementById('mName').value.trim(),phone=document.getElementById('mPhone').value.trim();
  if(!name||!phone||!chosen){TCSA.toast('Please pick a time and add your details.');return;}
  TCSA.leads.add({name,phone,source:bookMode,intent:`${bookMode} — ${v.year} ${v.make} ${v.model} · ${chosen}`,value:TCSA.fmtPrice(v.price),status:'Qualified'});
  modal.classList.remove('open');TCSA.toast(bookMode==='LVS'?'Live viewing booked ✓ We\'ll WhatsApp your call link.':'Test drive booked ✓ We\'ll confirm on WhatsApp.');});

/* ── Photo gallery ──
   The comment that used to sit here claimed the gallery was "already loaded via
   v.gallery", but nothing ever read v.gallery or touched the container — the
   page rendered the orbit and none of the car's photos. mapTruSaasVehicle fills
   v.gallery from the feed's images[], which is the dealer's full web set. */
(function renderGallery(){
  var wrap  = document.getElementById('vgal');
  var main  = document.getElementById('vgalMain');
  var strip = document.getElementById('vgalStrip');
  var count = document.getElementById('vgalCount');
  if(!wrap || !main || !strip) return;

  var shots = ((v && v.gallery && v.gallery.length) ? v.gallery : (v && v.img ? [v.img] : []))
    .filter(function(s){ return typeof s === 'string' && s && !/^data:video\//i.test(s); });

  if(!shots.length){ wrap.hidden = true; return; }
  wrap.hidden = false;

  var name = [v.year, v.make, v.model].filter(Boolean).join(' ');
  function show(i){
    i = ((i % shots.length) + shots.length) % shots.length;
    main.src = shots[i];
    main.alt = name + ' — photo ' + (i+1) + ' of ' + shots.length;
    if(count) count.textContent = (i+1) + ' / ' + shots.length;
    var btns = strip.querySelectorAll('.vgal-thumb');
    for(var k=0;k<btns.length;k++){ btns[k].classList.toggle('on', k===i); }
  }

  strip.innerHTML = shots.map(function(s,i){
    /* Only the first is eager — a 20-shot capture is 20 base64 payloads, and
       loading them all at once is what makes the page crawl on mobile data. */
    return '<button type="button" class="vgal-thumb" data-i="'+i+'" aria-label="Show photo '+(i+1)+'">'
         + '<img src="'+s+'" alt="" decoding="async" loading="'+(i===0?'eager':'lazy')+'">'
         + '</button>';
  }).join('');

  strip.addEventListener('click', function(e){
    var btn = e.target.closest ? e.target.closest('.vgal-thumb') : null;
    if(btn) show(+btn.getAttribute('data-i'));
  });

  show(0);
})();

/* Mobile hamburger toggle */
(function(){
  var hamburger = document.querySelector('.hamburger');
  var mobileMenu = document.querySelector('.mobile-menu');
  if(!hamburger || !mobileMenu) return;
  hamburger.addEventListener('click', function(e){
    e.stopPropagation();
    var isOpen = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(function(link){
    link.addEventListener('click', function(){
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && mobileMenu.classList.contains('open')){
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
})();
} /* end renderVehiclePage */

/* Draw as soon as there is something to draw, and again when the feed lands.
   Guarded so a second tcsa:stock (or a warm cache that already had stock) can
   only paint the page once. */
(function(){
  var painted = false;
  function paint(){
    if (painted) return;
    if (!window.TCSA || !Array.isArray(TCSA.vehicles) || !TCSA.vehicles.length) return;
    painted = true;
    renderVehiclePage();
  }
  paint();
  window.addEventListener('tcsa:stock', paint);
})();