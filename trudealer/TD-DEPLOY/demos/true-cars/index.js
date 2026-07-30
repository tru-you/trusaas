(function(){
  var el = document.getElementById('tcSplash');
  if(!el) return;
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ?splash — force a replay (handy for testing on a real phone) */
  var force = /[?&]splash/.test(location.search);
  var seen = false;
  try{ seen = !force && sessionStorage.getItem('tcSplashSeen') === '1'; }catch(e){}
  if(seen){ el.remove(); return; }

  root.classList.add('tc-splashing');

  /* dust field */
  if(!reduce){
    var dust = el.querySelector('.sp-dust'), frag = document.createDocumentFragment();
    for(var i = 0; i < 34; i++){
      var d = document.createElement('i');
      var s = 1 + Math.random() * 2.4;
      d.style.cssText = 'left:' + (Math.random()*100) + '%;top:' + (55 + Math.random()*45) + '%;' +
        'width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) + 'px;' +
        '--dx:' + ((Math.random()-.5)*90).toFixed(0) + 'px;--dy:' + (-(120 + Math.random()*300)).toFixed(0) + 'px;' +
        'animation-duration:' + (3.4 + Math.random()*3.6).toFixed(2) + 's;' +
        'animation-delay:' + (Math.random()*2.2).toFixed(2) + 's;';
      frag.appendChild(d);
    }
    dust.appendChild(frag);
  }

  /* percentage readout, locked to the loader bar */
  var pct = el.querySelector('.sp-pct');
  if(pct && !reduce){
    var t0 = null, DUR = 1350, START = 1520;
    var run = function(now){
      if(t0 === null) t0 = now;
      var e = now - t0 - START;
      if(e < 0){ requestAnimationFrame(run); return; }
      var p = Math.min(e / DUR, 1);
      var eased = 1 - Math.pow(1 - p, 2.2);
      pct.textContent = Math.round(eased * 100) + '%';
      if(p < 1 && !done) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  } else if(pct){ pct.textContent = '100%'; }

  var done = false;
  function close(){
    if(done) return; done = true;
    try{ sessionStorage.setItem('tcSplashSeen','1'); }catch(e){}
    if(pct) pct.textContent = '100%';
    el.classList.add('sp-out');
    root.classList.remove('tc-splashing');
    setTimeout(function(){ el.remove(); }, 1000);
  }
  el.querySelector('.sp-skip').addEventListener('click', close);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
  setTimeout(close, reduce ? 1500 : 3300);
})();
(function(){
  /* Tru3D on homepage — ship local Honda orbit immediately (don't wait on Lens cold start) */
  var home = document.getElementById('homeWeb3d');
  if (home && TCSA.loadWeb3DForVehicle) {
    var demo =
      (TCSA.vehicles && TCSA.vehicles.find && TCSA.vehicles.find(function(v){ return v.id === 'porsche-cayenne-s-19'; })) ||
      (TCSA.vehicles && TCSA.vehicles[0]) ||
      { year: 2022, make: 'Honda', model: 'Civic', colour: 'White', vir: 94, id: 'home-tru3d' };
    TCSA.loadWeb3DForVehicle(home, demo, { homeDemo: true, useHondaOrbit: true, skipLive: true });
  }
})();
/* ── hero: split H1 into words for staggered reveal (keeps .hl gradient) ── */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const h1=document.querySelector('.hero-h'); if(!h1) return;
  let i=0;
  const wrapWords=(node,cls)=>{
    const frag=document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach(tok=>{
      if(/^\s+$/.test(tok)){ frag.appendChild(document.createTextNode(tok)); return; }
      if(!tok) return;
      const s=document.createElement('span'); s.className='w'+(cls?' '+cls:''); s.style.setProperty('--i',i++); s.textContent=tok;
      frag.appendChild(s);
    });
    return frag;
  };
  [...h1.childNodes].forEach(n=>{
    if(n.nodeType===3){ h1.replaceChild(wrapWords(n),n); }
    else if(n.classList&&n.classList.contains('hl')){ const f=wrapWords(n,'hl'); n.textContent=''; n.appendChild(f); n.classList.remove('hl'); n.style.background='none'; }
  });
  h1.closest('.hero-copy').classList.add('split');
})();

window.TCSApage = {
  search(e){
    e.preventDefault();
    const p = new URLSearchParams();
    const map = {qMake:'make',qBody:'body',qFuel:'fuel',qPrice:'maxPrice'};
    Object.keys(map).forEach(id=>{ const v=document.getElementById(id).value; if(v) p.set(map[id], v); });
    window.location.href = 'certi-used.html' + (p.toString()?('?'+p.toString()):'');
    return false;
  }
};
/* Stock is drawn twice: once now, and again when the live feed lands.
   data.js ships no static cars (TCSA.vehicles = []), and the bridge fills it
   asynchronously, dispatching tcsa:stock when it resolves. This block used to
   run only at parse time — so the homepage painted three EMPTY grids and kept
   them, while certi-used / ev / performance / premium-select all listened for
   the event and filled correctly. The cars were sitting in TCSA.vehicles the
   whole time; nothing ever asked this page to draw them. */
function renderHomeStock(){
  const cars = (window.TCSA && TCSA.vehicles) || [];

  // Rebuilt from scratch — appending on a second run duplicates every make.
  const sel = document.getElementById('qMake');
  if (sel) {
    const first = sel.querySelector('option');
    sel.innerHTML = first ? first.outerHTML : '';
    [...new Set(cars.map(v=>v.make))].sort().forEach(m=>{
      const o=document.createElement('option'); o.value=m; o.textContent=m; sel.appendChild(o);
    });
  }

  // featured grid (8) + performance (3) + true premium (3)
  const put = (id, list) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = list.map(TCSA.vcard).join('');
  };
  put('featuredGrid', cars.filter(v=>v.featured&&!v.premium).slice(0,8));
  put('performanceGrid', cars.filter(v=>v.premium&&v.price<2500000&&v.fuel!=='Electric').slice(0,3));
  put('premiumGrid', cars.filter(v=>v.premium&&v.price>=2500000).slice(0,3));

  // re-run reveal observer for injected cards
  document.querySelectorAll('#featuredGrid .vcard,#performanceGrid .vcard,#premiumGrid .vcard').forEach((c,i)=>{ c.classList.add('rv'); if(i%4) c.classList.add('d'+(i%4)); });
}
renderHomeStock();
window.addEventListener('tcsa:stock', renderHomeStock);

// ── Interactive SA delivery map ──
(function(){
  const info = document.getElementById('mapInfo');
  let active = null;
  document.querySelectorAll('#saMap .province').forEach(p=>{
    const show = ()=>{
      if(active) active.classList.remove('prov-active');
      p.classList.add('prov-active');
      active = p;
      info.classList.add('active');
      info.innerHTML = `<div class="map-info-name">${p.dataset.name}</div><div class="map-info-city"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${p.dataset.city}</div><div class="map-info-days"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="width:13px;height:13px"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>${p.dataset.days} · Free delivery</div><button class="map-luna-btn" data-chat="How does delivery to ${p.dataset.city} work?"><svg viewBox="0 0 48 48" style="width:18px;height:18px"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".5"/><circle cx="24" cy="24" r="14" fill="currentColor" opacity=".12"/><ellipse cx="18" cy="22" rx="3.4" ry="3.4" fill="currentColor"/><ellipse cx="30" cy="22" rx="3.4" ry="3.4" fill="currentColor"/><circle cx="24" cy="32" r="2" fill="currentColor" opacity=".5"/></svg>Ask TruChat about ${p.dataset.city} delivery</button>`;
    };
    p.addEventListener('mouseenter', show);
    p.addEventListener('click', show);
    p.addEventListener('touchstart', (e)=>{ e.preventDefault(); show(); }, {passive:false});
  });
  // Delegate click on "Ask TruChat" button inside map info card
  info.addEventListener('click', (e)=>{
    const btn = e.target.closest('.map-luna-btn');
    if(btn && btn.dataset.chat && window.TCSA && TCSA.luna){
      TCSA.luna.open(btn.dataset.chat);
    }
  });
})();
// Budget search
TCSApage.budgetSearch = function(){
  var dep = parseInt((document.getElementById('bfDeposit').value||'0').replace(/\s/g,'')) || 0;
  var mo = parseInt((document.getElementById('bfMonthly').value||'0').replace(/\s/g,'')) || 0;
  var p = new URLSearchParams();
  if(dep) p.set('deposit', dep);
  if(mo) p.set('monthly', mo);
  p.set('credit', document.getElementById('bfCredit').value);
  window.location.href = 'certi-used.html?' + p.toString();
};
// Budget car grid — a deliberately varied spread of body styles, brands and colours
(function(){
  var pick = ['toyota-fortuner-28-20','ford-puma-23','mazda-cx5-22','renault-sandero-19','ford-ecosport-22','hyundai-exter-25'];
  var byId = {}; TCSA.vehicles.forEach(function(v){ byId[v.id] = v; });
  var budgetCars = pick.map(function(id){ return byId[id]; }).filter(function(v){ return v && v.img; });
  ['budgetCar1','budgetCar2','budgetCar3','budgetCar4','budgetCar5','budgetCar6'].forEach(function(id,i){
    var el = document.getElementById(id);
    var v = budgetCars[i];
    if(el && v) el.innerHTML = '<img src="'+(v.thumb||v.img)+'"'
      + (v.thumb ? ' srcset="'+v.thumb+' 480w, '+v.img+' 960w" sizes="(max-width:760px) 92vw, 400px"' : '')
      + ' alt="'+v.year+' '+v.make+' '+v.model+'" loading="lazy" decoding="async">';
  });
})();
// WHY TRU-CARS SA — randomised interactive 4-grid
(function(){
  var cards = [
    {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h4m10 0h4"/><path d="M12 3v4m0 10v4"/></svg>', title:'Tru3D + VIR Inspection', desc:'Every vehicle is photographed and inspected from every angle. No surprises, no hidden damage.', stat:'128', unit:'point check', color:'blue'},
    {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>', title:'Honest TruPrice', desc:'Benchmarked against the live market so you know you’re paying — or receiving — a fair price.', stat:'98', unit:'% market matched', color:'teal'},
    {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>', title:'Live Video Walkaround', desc:'Book a video call and we’ll show you the car in real time, answer questions, and start the deal.', stat:'24/7', unit:'video bookings', color:'red'},
    {icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>', title:'Free Nationwide Delivery', desc:'We deliver anywhere in South Africa. Or collect in Cape Town. Your choice, always free.', stat:'1 240', unit:'cars in stock', color:'gold'}
  ];
  // Randomise card order on every load
  cards.sort(function(){ return Math.random() - .5; });
  var grid = document.getElementById('whyGrid');
  if(!grid) return;
  grid.innerHTML = cards.map(function(c){
    return '<div class="why-card-tcsa" data-color="'+c.color+'" style="--delay:'+(Math.random()*1.2).toFixed(2)+'s">'+
      '<div class="wic wic-'+c.color+'">'+c.icon+'</div>'+
      '<div class="wstat">'+c.stat+'<small>'+c.unit+'</small></div>'+
      '<h4>'+c.title+'</h4>'+
      '<p>'+c.desc+'</p>'+
    '</div>';
  }).join('');
  // Mouse-follow spotlight on each card
  grid.querySelectorAll('.why-card-tcsa').forEach(function(card){
    card.addEventListener('mousemove', function(e){
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - rect.left)+'px');
      card.style.setProperty('--my', (e.clientY - rect.top)+'px');
    });
  });
})();
// VIR360 Honda damage / service tags
(function(){
  var tags = [
    {x:28,y:54,ok:false,ttl:'2 mm scratch',txt:'Light scuff on front bumper. Documented; quoted R650 to polish.',meta:'Damage · minor'},
    {x:72,y:62,ok:true,ttl:'Tyres at 70%',txt:'Michelin Pilot Sport 4 tyres with ~5.2 mm tread remaining across all four wheels.',meta:'Wear · good'},
    {x:48,y:38,ok:true,ttl:'Full service history',txt:'Complete Honda dealer service record. Last service at 42 000 km.',meta:'History · verified'}
  ];
  var stage = document.getElementById('virTeaser');
  var wrap = document.getElementById('virTags');
  if(!stage || !wrap) return;
  var openPop = null;
  function closePop(){ if(openPop){ openPop.classList.remove('show'); openPop = null; } }
  tags.forEach(function(t,i){
    var tag = document.createElement('div');
    tag.className = 'vir-tag' + (t.ok ? ' ok' : '');
    tag.style.left = t.x + '%';
    tag.style.top = t.y + '%';
    tag.innerHTML = '<div class="vir-tag-dot">+</div><span class="vir-tag-num">0'+(i+1)+'</span>';
    var pop = document.createElement('div');
    pop.className = 'vir-tag-pop' + (t.ok ? ' ok' : '');
    pop.innerHTML = '<div class="ttl"><span class="dot"></span>'+t.ttl+'</div>'+
      '<div class="txt">'+t.txt+'</div>'+
      '<div class="meta">'+t.meta+'</div>';
    pop.style.left = (t.x > 55 ? Math.max(4, t.x - 28) : Math.min(72, t.x - 4)) + '%';
    pop.style.top = (t.y > 50 ? Math.max(6, t.y - 34) : Math.min(70, t.y + 8)) + '%';
    if(t.y > 50) pop.classList.add('up');
    tag.addEventListener('click', function(e){
      e.stopPropagation();
      if(openPop === pop){ closePop(); return; }
      closePop();
      pop.classList.add('show');
      openPop = pop;
    });
    wrap.appendChild(tag);
    wrap.appendChild(pop);
  });
  stage.addEventListener('click', function(e){ if(!e.target.closest('.vir-tag,.vir-tag-pop')) closePop(); });
})();
TCSA.initChrome();
// load the real True-Cars banner image; reveal it as the primary hero
(function(){
  const el=document.getElementById('heroPhoto');
  const hero=document.querySelector('header.hero');
  if(!el||!hero) return;
  // File on disk is hero-truecar.avif (no "s") — older builds pointed at a 404 name
  const candidates=['assets/img/hero-truecar.avif','assets/img/hero-trucars.avif','assets/img/hero-truecar.jpg','assets/img/hero-truecar.webp'];
  let i=0;
  function tryNext(){
    if(i>=candidates.length) return;
    const img=new Image();
    const src=candidates[i++];
    img.onload=function(){
      el.style.backgroundImage='url("'+src+'")';
      el.classList.add('loaded');
      hero.classList.add('has-photo');
    };
    img.onerror=tryNext;
    img.src=src;
  }
  tryNext();
})();
// ===== Scaleflex 360 viewer loaded from TruSaaS CDN =====
/* The cloudimage-360 div auto-initializes via the Scaleflex plugin */
/* ============ POLISH EFFECTS ============ */
(function(){
  'use strict';

  // 1. Scroll progress bar
  var progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  document.body.appendChild(progressBar);
  window.addEventListener('scroll', function(){
    var h = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = 'scaleX(' + (window.scrollY / h) + ')';
  }, {passive:true});

  // 2. Nav solid background on scroll
  var nav = document.querySelector('.nav');
  if(nav){
    var ticking = false;
    window.addEventListener('scroll', function(){
      if(!ticking){
        requestAnimationFrame(function(){
          nav.classList.toggle('solid', window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    }, {passive:true});
  }

  // 3. Scroll reveal (IntersectionObserver)
  var rvObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry, i){
      if(entry.isIntersecting){
        setTimeout(function(){ entry.target.classList.add('in'); }, i * 80);
        rvObserver.unobserve(entry.target);
      }
    });
  }, {threshold: 0.12, rootMargin: '0px 0px -40px 0px'});
  document.querySelectorAll('.rv, .rv-left, .rv-right').forEach(function(el){ rvObserver.observe(el); });

  // 4. Card spotlight (mouse tracking)
  document.querySelectorAll('.vcard').forEach(function(card){
    card.addEventListener('mousemove', function(e){
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
  });

  // 5. Button glow (mouse tracking)
  document.querySelectorAll('.btn-grad').forEach(function(btn){
    btn.addEventListener('mousemove', function(e){
      var rect = btn.getBoundingClientRect();
      btn.style.setProperty('--bx', (e.clientX - rect.left) + 'px');
      btn.style.setProperty('--by', (e.clientY - rect.top) + 'px');
    });
  });

  // 6. Hero parallax
  var heroScene = document.querySelector('.hero-scene');
  var heroSun = document.querySelector('.hero-sun');
  var heroMtn = document.querySelector('.hero-mountains');
  if(heroScene){
    window.addEventListener('scroll', function(){
      var y = window.scrollY;
      if(y < window.innerHeight){
        if(heroSun) heroSun.style.transform = 'translateY(' + (y * 0.15) + 'px)';
        if(heroMtn) heroMtn.style.transform = 'translateY(' + (y * 0.08) + 'px)';
      }
    }, {passive:true});
  }

  // 7. Ambient hero particles
  var hero = document.querySelector('header.hero');
  if(hero && !matchMedia('(prefers-reduced-motion:reduce)').matches){
    var particles = document.createElement('div');
    particles.className = 'hero-particles';
    hero.appendChild(particles);
    for(var i = 0; i < 18; i++){
      var p = document.createElement('i');
      p.style.cssText = 'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;animation-duration:' + (6 + Math.random() * 10) + 's;animation-delay:' + (Math.random() * 8) + 's;--drift:' + ((Math.random() - 0.5) * 60) + 'px;width:' + (2 + Math.random() * 2) + 'px;height:' + (2 + Math.random() * 2) + 'px;';
      p.style.animationName = 'particleFloat';
      particles.appendChild(p);
    }
  }

  // 8. Stat counter animation
  var statObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var el = entry.target;
        var target = parseFloat(el.dataset.count);
        var suf = el.dataset.suf || '';
        var dec = parseInt(el.dataset.dec) || 0;
        var dur = 1800;
        var start = performance.now();
        var tick = function(now){
          var p = Math.min((now - start) / dur, 1);
          var ease = 1 - Math.pow(1 - p, 3);
          var val = (target * ease).toFixed(dec);
          var formatted = dec > 0 ? parseFloat(val).toLocaleString('en-ZA') : parseInt(val).toLocaleString('en-ZA');
          el.textContent = formatted + suf;
          if(p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        statObserver.unobserve(el);
      }
    });
  }, {threshold: 0.1});
  document.querySelectorAll('[data-count]').forEach(function(el){ statObserver.observe(el); });

  // 9. Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href');
      if(id.length > 1){
        var target = document.querySelector(id);
        if(target){
          e.preventDefault();
          target.scrollIntoView({behavior:'smooth', block:'start'});
        }
      }
    });
  });

  // 10. Mobile hamburger toggle
  var hamburger = document.querySelector('.hamburger');
  var mobileMenu = document.querySelector('.mobile-menu');
  if(hamburger && mobileMenu){
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
  }

})();
/* Pause the hero's infinite animations whenever it scrolls out of view */
(function(){
  var hero = document.querySelector('.hero');
  if(!hero || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function(en){
    hero.classList.toggle('is-offscreen', !en[0].isIntersecting);
  }, {threshold: 0.02}).observe(hero);
})();
(function(){
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var isTouch = matchMedia('(hover:none)').matches;

  /* ---- 1. scroll progress bar ---- */
  var bar = document.createElement('div');
  bar.id = 'tcProgress';
  document.body.appendChild(bar);
  var ticking = false;
  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(window.scrollY / h, 1) : 0) + ')';
      var nav = document.querySelector('.nav');
      if(nav) nav.classList.toggle('tc-shrunk', window.scrollY > 120);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* ---- 2. hero scroll cue ---- */
  var hero = document.querySelector('header.hero');
  if(hero && !hero.querySelector('.tc-cue')){
    var cue = document.createElement('div');
    cue.className = 'tc-cue';
    cue.innerHTML = '<span>Scroll</span><i></i>';
    hero.appendChild(cue);
  }

  /* ---- 3. magnetic buttons ---- */
  if(!reduce && !isTouch){
    document.querySelectorAll('.btn-grad, .qs-go, .btn-lg').forEach(function(b){
      b.classList.add('tc-mag');
      b.addEventListener('mousemove', function(e){
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width/2)) / r.width;
        var dy = (e.clientY - (r.top + r.height/2)) / r.height;
        b.style.transform = 'translate(' + (dx*9).toFixed(2) + 'px,' + (dy*7).toFixed(2) + 'px)';
      });
      b.addEventListener('mouseleave', function(){ b.style.transform = ''; });
    });
  }

  /* ---- 4. 3D tilt on cards ---- */
  if(!reduce && !isTouch){
    document.querySelectorAll('.prod-card, .why-card-tcsa, .vcard').forEach(function(c){
      c.classList.add('tc-tilt');
      c.addEventListener('mouseenter', function(){ c.classList.add('tc-tilting'); });
      c.addEventListener('mousemove', function(e){
        var r = c.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        c.style.transform = 'perspective(900px) rotateX(' + (-py*5).toFixed(2) + 'deg) rotateY(' + (px*6).toFixed(2) + 'deg) translateY(-6px)';
      });
      c.addEventListener('mouseleave', function(){
        c.classList.remove('tc-tilting');
        c.style.transform = '';
      });
    });
  }

  /* ---- 5. sheen sweep + underline draw on reveal ---- */
  if('IntersectionObserver' in window){
    var lifeObs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); lifeObs.unobserve(en.target); }
      });
    }, {threshold:.2, rootMargin:'0px 0px -50px 0px'});

    if(!reduce){
      document.querySelectorAll('.why-card-tcsa, .prod-card, .stat').forEach(function(el){
        el.classList.add('tc-sheen'); lifeObs.observe(el);
      });
    }
    document.querySelectorAll('.tc-uline').forEach(function(el){ lifeObs.observe(el); });

    /* generic lift-in for sections that weren't already wired to .rv */
    var lift = document.createElement('style');
    lift.textContent = '.tc-lift{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,1,.32,1),transform .8s cubic-bezier(.2,1,.32,1);}.tc-lift.in{opacity:1;transform:none;}';
    document.head.appendChild(lift);
    if(!reduce){
      document.querySelectorAll('section > .wrap > h2, .steps-strip .step, .partner-bar img, .map-info-card').forEach(function(el, i){
        el.classList.add('tc-lift');
        el.style.transitionDelay = (i % 6 * 60) + 'ms';
        lifeObs.observe(el);
      });
    }
  }

  /* ---- 6. gentle float on feature media ---- */
  if(!reduce){
    document.querySelectorAll('.media-frame, .vir360').forEach(function(el){ el.classList.add('tc-float'); });
  }

  /* ---- 7. depth parallax on dark bands ---- */
  if(!reduce && !isTouch){
    var bands = [].slice.call(document.querySelectorAll('.tradein-band, .aiband, #premium, #budget'));
    if(bands.length){
      var bTick = false;
      window.addEventListener('scroll', function(){
        if(bTick) return;
        bTick = true;
        requestAnimationFrame(function(){
          var vh = window.innerHeight;
          bands.forEach(function(b){
            var r = b.getBoundingClientRect();
            if(r.bottom < 0 || r.top > vh) return;
            var p = (r.top + r.height/2 - vh/2) / vh;
            b.style.setProperty('--tc-par', (p * 18).toFixed(1) + 'px');
            b.style.backgroundPosition = 'center calc(50% + ' + (p * 18).toFixed(1) + 'px)';
          });
          bTick = false;
        });
      }, {passive:true});
    }
  }
})();