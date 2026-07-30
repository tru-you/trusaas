/* ===== stock data ===== */
const STOCK=[
  {id:0,real:1,make:"Ford",body:"bakkie",title:"2021 Ford Ranger 2.2 TDCi",variant:"XL A/T · SuperCab",price:334900,km:186013,trans:"Auto",fuel:"Diesel",year:2021,rate:12.5,img:"assets/ranger.jpg",badge:"HV Stock",hot:1},
  {id:1,real:1,make:"Renault",body:"hatch",title:"2018 Renault Kwid 1.0",variant:"Climber 5DR",price:139900,km:103279,trans:"Manual",fuel:"Petrol",year:2018,rate:13.0,img:"assets/kwid.jpg",badge:"HV Stock"},
  {id:2,real:1,make:"Renault",body:"suv",title:"2018 Renault Captur 1.5",variant:"Dynamique dCi",price:199900,km:114497,trans:"Manual",fuel:"Diesel",year:2018,rate:12.75,img:"assets/captur.jpg",badge:"HV Stock"},
  {id:3,real:0,make:"Toyota",body:"bakkie",title:"2021 Toyota Hilux 2.4 GD-6",variant:"Double Cab · Raised Body",price:399900,km:98500,trans:"Manual",fuel:"Diesel",year:2021,rate:12.5,img:"assets/hilux.jpg",badge:"Low km",hot:1},
  {id:4,real:0,make:"Volkswagen",body:"hatch",title:"2019 Volkswagen Polo 1.6",variant:"Comfortline",price:229900,km:64200,trans:"Manual",fuel:"Petrol",year:2019,rate:12.9,img:"assets/polo.jpg",badge:"Low km"},
  {id:5,real:0,make:"Toyota",body:"suv",title:"2018 Toyota Fortuner 2.4 GD-6",variant:"Auto · 7-seater",price:379900,km:142000,trans:"Auto",fuel:"Diesel",year:2018,rate:12.6,img:"assets/fortuner.jpg",badge:"Family SUV"},
];
const fmt=n=>"R"+Math.round(n).toLocaleString('en-ZA').replace(/,/g,' ');
function instalment(price,depPct,term,rate,balPct){
  const dep=price*depPct/100,bal=price*balPct/100,r=rate/100/12;
  const fin=(price-dep)-bal/Math.pow(1+r,term);
  return fin*r/(1-Math.pow(1+r,-term))+69;
}
const icoKm='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 12l4-2"/></svg>';
const icoTr='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12M18 9V3M6 15a3 3 0 003 3h6a3 3 0 003-3"/><circle cx="6" cy="18" r="2"/></svg>';
const icoFu='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V5a2 2 0 012-2h6a2 2 0 012 2v15M3 20h12M14 9h3l3 3v6a2 2 0 01-4 0"/></svg>';
const waIco='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.7-.85-2-.94-.26-.1-.45-.15-.65.15-.19.29-.74.94-.9 1.13-.17.19-.33.22-.62.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.08-.15-.65-1.57-.9-2.15-.24-.56-.48-.49-.65-.5h-.56c-.19 0-.5.07-.77.36-.26.29-1 .98-1 2.4 0 1.41 1.03 2.78 1.17 2.97.15.19 2.03 3.1 4.92 4.35.69.3 1.22.47 1.64.6.69.22 1.31.19 1.81.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.56-.34zM12 2a10 10 0 00-8.6 15.06L2 22l5.06-1.33A10 10 0 1012 2z"/></svg>';

function renderGrid(list){
  const g=document.getElementById('grid');
  g.innerHTML=list.map(c=>{
    const mo=instalment(c.price,10,72,c.rate,10);
    return `<div class="card rv" data-body="${c.body}" onclick="openCar(${c.id})">
      <div class="card-shine"></div>
      <div class="card-img"><span class="card-badge ${c.hot?'hot':''}">${c.badge}</span><span class="card-fav">♡</span><img src="${c.img}" alt="${c.title}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-title">${c.title}</div>
        <div class="card-variant">${c.variant}</div>
        <div class="card-price">${fmt(c.price)}</div>
        <div class="card-mo">from <b>${fmt(mo)}</b>/mo · 72m</div>
        <div class="card-meta">
          <div class="meta">${icoKm}<span>${c.km.toLocaleString('en-ZA').replace(/,/g,' ')} km</span></div>
          <div class="meta">${icoTr}<span>${c.trans}</span></div>
          <div class="meta">${icoFu}<span>${c.fuel}</span></div>
        </div>
        <div class="card-actions">
          <button class="btn-calc" onclick="event.stopPropagation();openCar(${c.id})">View &amp; Finance</button>
          <a class="btn-wa-sq" onclick="event.stopPropagation()" href="https://wa.me/27614878054?text=${encodeURIComponent('Hi HV Motors, I\'m interested in the '+c.title)}">${waIco}</a>
        </div>
      </div>
    </div>`;
  }).join('');
  observeReveals();
}

/* ===== filter ===== */
document.getElementById('chips').addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on')); b.classList.add('on');
  const f=b.dataset.f;
  document.querySelectorAll('.card').forEach(c=>c.classList.toggle('hide',f!=='all'&&c.dataset.body!==f));
});

/* ===== ticker ===== */
const tItems=['Hand-picked used vehicles','Bank-approved finance · all profiles','Trade-ins welcome','Nationwide delivery','Worcester · Western Cape','New stock weekly','WhatsApp us anytime'];
document.getElementById('tickerTrack').innerHTML=(tItems.join('§')+'§'+tItems.join('§')).split('§').map(t=>`<span>${t}</span>`).join('');

/* ===== finance calc (shared) ===== */
function makeCalc(prefix,seed){
  const st={price:seed.price,dep:10,term:72,rate:seed.rate,bal:10};
  const $=id=>document.getElementById(prefix+id);
  function upd(){
    const m=instalment(st.price,st.dep,st.term,st.rate,st.bal);
    $('Out').textContent=fmt(m);
    $('Sub').textContent=`${st.term} months · ${st.dep}% deposit · ${st.bal}% balloon · incl. fees`;
    if($('PriceL'))$('PriceL').textContent=fmt(st.price);
    $('DepL').textContent=st.dep+'%'; $('BalL').textContent=st.bal+'%'; $('RateL').textContent=st.rate+'%';
  }
  if($('Price'))$('Price').oninput=e=>{st.price=+e.target.value;upd();};
  $('Dep').oninput=e=>{st.dep=+e.target.value;upd();};
  $('Bal').oninput=e=>{st.bal=+e.target.value;upd();};
  $('Rate').oninput=e=>{st.rate=+e.target.value;upd();};
  $('Terms').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('Terms').querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');st.term=+b.dataset.t;upd();});
  upd();
}
makeCalc('fc',{price:334900,rate:12.5});

/* ===== modal ===== */
const modalBg=document.getElementById('modalBg'),modal=document.getElementById('modal');
function openCar(id){
  const c=STOCK.find(x=>x.id===id);
  modal.innerHTML=`
    <div class="m-img"><span class="m-badge">${c.badge}</span><button class="m-close" onclick="closeModal()">×</button><img src="${c.img}" alt="${c.title}"></div>
    <div class="m-body">
      <div>
        <h3>${c.title}</h3><div class="m-var">${c.variant}</div>
        <div class="m-price">${fmt(c.price)}</div>
        <ul class="spec-list">
          <li><span>Year</span><b>${c.year}</b></li>
          <li><span>Mileage</span><b>${c.km.toLocaleString('en-ZA').replace(/,/g,' ')} km</b></li>
          <li><span>Transmission</span><b>${c.trans}</b></li>
          <li><span>Fuel</span><b>${c.fuel}</b></li>
          <li><span>Location</span><b>Worcester</b></li>
        </ul>
        <a class="btn btn-wa" style="width:100%;margin-top:16px" href="https://wa.me/27614878054?text=${encodeURIComponent('Hi HV Motors, I\'m interested in the '+c.title)}">${waIco}Enquire on WhatsApp</a>
      </div>
      <div class="calc">
        <div class="tag">Instalment Estimator</div>
        <div class="cveh">Estimating: <b>${c.title}</b></div>
        <label>Deposit <b id="mDepL">10%</b></label><input type="range" id="mDep" min="0" max="40" step="5" value="10">
        <label>Balloon / residual <b id="mBalL">10%</b></label><input type="range" id="mBal" min="0" max="35" step="5" value="10">
        <label>Interest rate p.a. <b id="mRateL">${c.rate}%</b></label><input type="range" id="mRate" min="9" max="16" step="0.25" value="${c.rate}">
        <div class="terms" id="mTerms"><button data-t="48">48</button><button data-t="60">60</button><button data-t="72" class="on">72</button></div>
        <div class="result"><div class="sub">Estimated monthly instalment</div><div class="big" id="mOut">R0</div><div class="sub" id="mSub"></div></div>
        <a class="btn btn-blue apply" href="https://wa.me/27614878054?text=${encodeURIComponent("I'd like to apply for finance on the "+c.title)}">Apply for finance →</a>
      </div>
    </div>`;
  modalBg.classList.add('open');document.body.style.overflow='hidden';
  makeCalc('m',{price:c.price,rate:c.rate});
}
function closeModal(){modalBg.classList.remove('open');document.body.style.overflow='';}
modalBg.addEventListener('click',e=>{if(e.target===modalBg)closeModal();});
addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

/* ===== nav / reveals / back-to-top ===== */
const nav=document.getElementById('nav'),backTop=document.getElementById('backTop');
addEventListener('scroll',()=>{nav.classList.toggle('solid',scrollY>60);backTop.classList.toggle('show',scrollY>620);},{passive:true});
backTop.onclick=()=>scrollTo({top:0,behavior:'smooth'});
let io;
function observeReveals(){
  io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12});
  document.querySelectorAll('.rv:not(.in),.rv-scale:not(.in),.rv-right:not(.in)').forEach(el=>io.observe(el));
}
/* counters */
function counters(){
  const cio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const el=e.target,t=+el.dataset.target;let n=0;const step=t/40;const iv=setInterval(()=>{n+=step;if(n>=t){n=t;clearInterval(iv);}el.textContent=Math.round(n);},22);cio.unobserve(el);}}),{threshold:.6});
  document.querySelectorAll('.counter').forEach(c=>cio.observe(c));
}
/* particles */
(function(){const c=document.getElementById('heroParticles');for(let i=0;i<26;i++){const p=document.createElement('div');p.className='particle';p.style.left=Math.random()*100+'%';p.style.animationDuration=(9+Math.random()*11)+'s';p.style.animationDelay=(Math.random()*11)+'s';p.style.opacity=.2+Math.random()*.45;c.appendChild(p);}})();
/* spotlight */
(function(){const s=document.getElementById('heroSpot'),h=document.querySelector('header');h.addEventListener('mousemove',e=>{const r=h.getBoundingClientRect();s.style.setProperty('--mx',e.clientX+'px');s.style.setProperty('--my',(e.clientY-r.top)+'px');s.classList.add('active');},{passive:true});h.addEventListener('mouseleave',()=>s.classList.remove('active'));})();
/* card 3D tilt + shine */
document.addEventListener('mousemove',function(e){
  const card=e.target.closest('.card'); if(!card)return;
  const r=card.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
  card.style.transform=`perspective(900px) rotateY(${(px-.5)*7}deg) rotateX(${(.5-py)*7}deg) translateY(-4px)`;
  card.style.setProperty('--sx',px*100+'%');card.style.setProperty('--sy',py*100+'%');
},{passive:true});
document.addEventListener('mouseout',e=>{const card=e.target.closest('.card');if(card&&!card.contains(e.relatedTarget))card.style.transform='';});
/* mobile menu */
const ham=document.getElementById('hamburger'),mm=document.getElementById('mobileMenu');
ham.onclick=()=>{ham.classList.toggle('open');mm.classList.toggle('open');document.body.style.overflow=mm.classList.contains('open')?'hidden':'';};
mm.querySelectorAll('a').forEach(a=>a.onclick=()=>{ham.classList.remove('open');mm.classList.remove('open');document.body.style.overflow='';});
/* preloader */
addEventListener('load',()=>setTimeout(()=>document.getElementById('preloader').classList.add('done'),900));

/* init */
renderGrid(STOCK);
observeReveals();
counters();