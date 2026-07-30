/* ── SPLASH 3D BALL ─────────────────────────────── */
(function(){
  var sc=document.getElementById('splash-3d');
  var splash=document.getElementById('splash');
  if(typeof THREE==='undefined')return;
  if(!sc||!splash||splash.style.display==='none'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var r=new THREE.WebGLRenderer({canvas:sc,alpha:true,antialias:true});
  r.setSize(window.innerWidth,window.innerHeight);
  r.setPixelRatio(Math.min(window.devicePixelRatio,2));
  var scene=new THREE.Scene();
  var cam=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,.1,1000);
  cam.position.z=10;
  scene.add(new THREE.AmbientLight(0xffffff,.6));
  var lc=new THREE.PointLight(0x00f2fe,3,30);lc.position.set(3,3,5);scene.add(lc);
  var lb=new THREE.PointLight(0x3b82f6,1.5,30);lb.position.set(-3,-3,-2);scene.add(lb);
  var g=new THREE.Group();scene.add(g);
  var ring1=new THREE.Mesh(new THREE.TorusGeometry(2.4,.02,16,100),new THREE.MeshStandardMaterial({color:0x00f2fe,emissive:0x00f2fe,emissiveIntensity:.6,roughness:.2}));
  ring1.rotation.x=Math.PI/3;g.add(ring1);
  var ring2=new THREE.Mesh(new THREE.TorusGeometry(3,.012,16,100),new THREE.MeshBasicMaterial({color:0x4fe3dc,wireframe:true,transparent:true,opacity:.3}));
  ring2.rotation.y=Math.PI/4;g.add(ring2);
  var core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.3,0),new THREE.MeshStandardMaterial({color:0x0a0f1d,roughness:.1,metalness:.85,flatShading:true}));
  g.add(core);
  var wire=new THREE.Mesh(new THREE.IcosahedronGeometry(1.35,0),new THREE.MeshBasicMaterial({color:0x00f2fe,wireframe:true,transparent:true,opacity:.45}));
  g.add(wire);
  var pCount=80,pGeo=new THREE.BufferGeometry(),pos=new Float32Array(pCount*3);
  for(var i=0;i<pCount*3;i+=3){pos[i]=(Math.random()-.5)*18;pos[i+1]=(Math.random()-.5)*18;pos[i+2]=(Math.random()-.5)*18;}
  pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(pGeo,new THREE.PointsMaterial({size:.04,color:0x4fe3dc,transparent:true,opacity:.5})));
  var clk=new THREE.Clock();
  var alive=true;
  function anim(){
    if(!alive)return;
    requestAnimationFrame(anim);
    var t=clk.getElapsedTime();
    g.rotation.y=t*.3;g.rotation.x=Math.sin(t*.25)*.2;
    ring1.rotation.z=t*.2;ring2.rotation.z=-t*.12;
    g.position.y=Math.sin(t*.8)*.15;
    r.render(scene,cam);
  }
  anim();
  window.addEventListener('resize',function(){cam.aspect=window.innerWidth/window.innerHeight;cam.updateProjectionMatrix();r.setSize(window.innerWidth,window.innerHeight);});
  window._killSplash3D=function(){alive=false;r.dispose();};
})();

/* ── SPLASH INTRO (first visit per session only) ──── */
(function(){
  const s=document.getElementById('splash');if(!s)return;
  function cleanupSplash(){
    if(window._killSplash3D)window._killSplash3D();
    // ScrollTrigger measured the page while the splash locked body scroll — re-measure now.
    if(typeof ScrollTrigger!=='undefined')requestAnimationFrame(()=>ScrollTrigger.refresh());
  }
  function killSplash(){
    s.style.display='none';
    document.body.style.overflow='';
    cleanupSplash();
  }
  if(sessionStorage.getItem('trudealer-splash-seen')){
    killSplash();
    return;
  }
  sessionStorage.setItem('trudealer-splash-seen','1');
  if(window.innerWidth<768||typeof gsap==='undefined'||matchMedia('(prefers-reduced-motion: reduce)').matches){killSplash();return;}
  const logo=s.querySelector('.splash-logo');
  const tag=s.querySelector('.splash-tag');
  const stage=s.querySelector('.splash-stage');
  const wipe=s.querySelector('.splash-wipe');

  var failsafe=setTimeout(killSplash,3500);
  const tl=gsap.timeline({onComplete:()=>{
    clearTimeout(failsafe);
    killSplash();
  }});
  document.body.style.overflow='hidden';

  // Click / tap anywhere skips the intro
  s.addEventListener('click',function(){clearTimeout(failsafe);tl.progress(1);},{once:true});

  tl.to(logo,{opacity:1,scale:1,duration:1.2,ease:'power3.out',delay:.3})
    .to(tag,{opacity:1,duration:.6,ease:'power2.out'},'-=.5')
    .to(stage,{scale:1.08,duration:.8,ease:'power1.inOut'},'+=.6')
    .to(stage,{scale:1.3,opacity:0,duration:.7,ease:'power2.in'},'+=.2')
    .to(wipe,{y:'-100%',duration:.9,ease:'expo.inOut'},'-=.5')
    .to(s,{opacity:0,duration:.3,ease:'power2.out'},'-=.15');
})();

/* ── NAV SCROLLSPY — highlight the section you're in ── */
(function(){
  const links=document.querySelectorAll('.nav-links a[href^="#"]');
  if(!links.length||!window.IntersectionObserver)return;
  const map=new Map();
  links.forEach(a=>{const sec=document.querySelector(a.getAttribute('href'));if(sec)map.set(sec,a);});
  const io=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        links.forEach(l=>l.classList.remove('active'));
        const a=map.get(en.target);if(a)a.classList.add('active');
      }
    });
  },{rootMargin:'-35% 0px -55% 0px'});
  map.forEach((a,sec)=>io.observe(sec));
})();

/* ── SCROLL PROGRESS BAR ──────────────────────────── */
(function(){
  const bar=document.getElementById('prog');if(!bar)return;
  const update=()=>{const h=document.documentElement.scrollHeight-innerHeight;bar.style.transform='scaleX('+(scrollY/h)+')';};
  addEventListener('scroll',update,{passive:true});update();
})();

/* ── 3D CARD TILT ─────────────────────────────────── */
(function(){
  document.querySelectorAll('.module-card,.case,.step').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      el.style.transform=`perspective(900px) rotateY(${x*6}deg) rotateX(${-y*6}deg) translateY(-3px)`;
    });
    el.addEventListener('mouseleave',()=>{el.style.transform='';});
  });
})();

/* ── STAT COUNTERS ────────────────────────────────── */
(function(){
  document.querySelectorAll('[data-count]').forEach(el=>{
    const end=parseFloat(el.dataset.count);const dec=parseInt(el.dataset.dec||'0');
    if(typeof gsap==='undefined'||typeof ScrollTrigger==='undefined'){el.textContent=end.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g,',');return;}
    gsap.fromTo(el,{textContent:0},{textContent:end,duration:1.8,ease:'power2.out',snap:{textContent:dec?.01:1},
      scrollTrigger:{trigger:el,start:'top 85%',once:true},
      onUpdate(){el.textContent=parseFloat(el.textContent).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
    });
  });
})();

/* ── HERO MOUSE PARALLAX ──────────────────────────── */
(function(){
  const scene=document.querySelector('.hero-scene');if(!scene)return;
  const glyphs=document.querySelectorAll('.hero-glyphs span');
  addEventListener('mousemove',e=>{
    const x=(e.clientX/innerWidth-.5);const y=(e.clientY/innerHeight-.5);
    glyphs.forEach((g,i)=>{const d=(i%3+1)*8;g.style.setProperty('--px',(x*d)+'px');g.style.setProperty('--py',(y*d)+'px');g.style.translate=`${x*d}px ${y*d}px`;});
    scene.style.setProperty('--sx',(x*10)+'px');
  },{passive:true});
})();

/* ── CASE PREVIEW IFRAME SCALER ──────────────────── */
(function(){
  const fit=()=>{
    document.querySelectorAll('.case-preview,.mc-preview').forEach(w=>{
      const iframe=w.querySelector('iframe');if(!iframe)return;
      const phone=w.querySelector('.phone-fr');
      const s=phone?(phone.clientWidth/390):(w.clientWidth/1280);
      iframe.style.transform=`scale(${s})`;
    });
    document.querySelectorAll('.live-preview-wrap').forEach(w=>{
      const iframe=w.querySelector('iframe');
      if(!iframe)return;
      const s=w.clientWidth/1280;
      iframe.style.transform=`scale(${s})`;
      iframe.style.height=(w.clientHeight/s)+'px';
    });
  };
  addEventListener('load',fit);addEventListener('resize',fit);setTimeout(fit,400);
})();

/* ── TRUCHAT WIDGET ──────────────────────────────── */
window.tcOpen=()=>document.getElementById('tc').classList.add('open');
window.tcClose=()=>document.getElementById('tc').classList.remove('open');
window.tcAsk=(q)=>{
  const body=document.getElementById('tc-body');if(!body||!q)return;
  const u=document.createElement('div');u.className='tc-bub u';u.textContent=q;body.appendChild(u);body.scrollTop=body.scrollHeight;
  const answers={
    'pricing':'Modules are priced per dealership size — starter kit (TruShowroom + TruFlow Lite + TruChat) from about $290/mo. Every extra module bolts on. Book a walkthrough and Paul will price it against your lot.',
    'go-live':"Ten working days from scope call to live on your domain. Day 1 we scope, days 2–7 we skin to your brand, day 10 you're live. If we miss it we don't invoice.",
    'start':"Depends on your bottleneck. Lot of stale stock? TruLens. Losing leads at night? TruChat. Buyers ghosting after finance? TruShowroom's finance calculator. Book a call — 25 mins and we'll point at the right one.",
    'global':"Yes — built in Cape Town, deployed anywhere. Currency toggle is site-wide, F&I integrations are generic (we plug into your local finance partners), hosting is EU-West with GDPR & POPIA alignment.",
    'demo':"Best move — <a href='https://wa.me/27620502091?text=TruDealer%20walkthrough' style='color:var(--cyan);text-decoration:underline;'>tap here to WhatsApp Paul</a> and he'll set up a 25-min walkthrough on the actual live stack.",
    'default':"Good question — that one's better answered by Paul directly. <a href='https://wa.me/27620502091?text=TruDealer%20question' style='color:var(--cyan);text-decoration:underline;'>WhatsApp him here</a> and he'll come back the same day."
  };
  const key=/price|cost|how much|monthly|fee/i.test(q)?'pricing':/live|deploy|launch|ship|day|weeks?/i.test(q)?'go-live':/start|begin|first|which|module/i.test(q)?'start':/global|outside|country|market|international|world|uk|us|europe/i.test(q)?'global':/demo|walkthrough|book|call|meeting/i.test(q)?'demo':'default';
  setTimeout(()=>{
    const a=document.createElement('div');a.className='tc-bub a';a.innerHTML=answers[key];body.appendChild(a);body.scrollTop=body.scrollHeight;
  },600);
};

/* ── ORIGINAL: CURRENCY TOGGLE ────────────────────── */
(function(){
  const btns=document.querySelectorAll('.curr-toggle button');
  const stored=localStorage.getItem('trudealer-curr');
  const locale=(navigator.language||'').toUpperCase();
  const guess = stored || (locale.includes('GB')?'GBP':locale.includes('ZA')?'ZAR':'USD');
  const setCurr=(c)=>{btns.forEach(b=>b.classList.toggle('active',b.dataset.curr===c));localStorage.setItem('trudealer-curr',c);document.body.dataset.curr=c;};
  btns.forEach(b=>b.addEventListener('click',()=>setCurr(b.dataset.curr)));
  setCurr(guess);
})();

/* If GSAP fails to load (CDN blocked / offline), show everything instead of a blank page */
if(typeof gsap==='undefined'||typeof ScrollTrigger==='undefined'){
  document.querySelectorAll('.reveal,.hero-badge,.bub,[data-aff-out]').forEach(el=>{el.style.opacity=1;el.style.transform='none';});
}else{

gsap.registerPlugin(ScrollTrigger);

gsap.timeline({defaults:{ease:'power3.out'}})
  .to('.hero-badge',{opacity:1,y:0,duration:.7,delay:.1})
  .from('.hero-h1',{opacity:0,y:26,duration:.9},'-=.4')
  .from('.hero-sub',{opacity:0,y:18,duration:.7},'-=.5')
  .from('.hero-ctas',{opacity:0,y:14,duration:.6},'-=.4')
  .from('.hero-flex',{opacity:0,scale:.96,duration:1.1,ease:'power2.out'},'-=.9')
  .from('.hero-ticker',{opacity:0,y:12,duration:.6},'-=.5');

gsap.to('.hero-glyphs span',{y:-30,duration:14,ease:'sine.inOut',yoyo:true,repeat:-1,stagger:{amount:6,from:'random'}});

gsap.utils.toArray('.reveal').forEach(el=>{
  gsap.to(el,{opacity:1,y:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 85%'}});
});

/* ── SCROLL REEL — pinned scenes with scrub ── */
gsap.utils.toArray('.scene').forEach((scene,i)=>{
  const pin=scene.querySelector('.scene-pin');
  const fill=scene.querySelector('.bar-fill');
  const tl=gsap.timeline({
    scrollTrigger:{
      trigger:scene,
      start:'top top',
      end:'bottom bottom',
      scrub:.6
    }
  });
  if(fill)tl.to(fill,{width:'100%',ease:'none'},0);

  // Scene 2 · TruChat
  if(scene.dataset.scene==='2'){
    for(let n=1;n<=6;n++){
      tl.to(`.bub[data-b="${n}"]`,{opacity:1,y:0,duration:.2,ease:'power2.out'},.06+(n-1)*.12);
    }
  }

  // Scene 3 · TruAfford (sliders animate + result reveals)
  if(scene.dataset.scene==='3'){
    const state={dep:0,term:0,bal:0};
    const price=619000;
    const rate=0.135/12; // prime+2 monthly-ish
    const update=()=>{
      const depAmt=Math.round(30000+state.dep*(180000-30000));
      const termMo=Math.round(24+state.term*(72-24));
      const balPct=Math.round(state.bal*40);
      const financed=(price-depAmt)*(1-balPct/100);
      const monthly=Math.round(financed*rate/(1-Math.pow(1+rate,-termMo)) + (price*balPct/100)*rate);
      document.querySelector('[data-aff-dep]').textContent='R '+depAmt.toLocaleString();
      document.querySelector('[data-aff-term]').textContent=termMo+' mo';
      document.querySelector('[data-aff-bal]').textContent=balPct+'%';
      document.querySelector('[data-aff-mo]').textContent=monthly.toLocaleString();
      ['dep','term','bal'].forEach(k=>{
        const p=(state[k]*100)+'%';
        const fillEl=document.querySelector(`[data-aff-fill="${k}"]`);
        const knobEl=document.querySelector(`[data-aff-knob="${k}"]`);
        if(fillEl)fillEl.style.width=p;
        if(knobEl)knobEl.style.left=p;
      });
    };
    tl.to(state,{dep:.4,duration:.3,ease:'power1.inOut',onUpdate:update},.05)
      .to(state,{term:.5,duration:.3,ease:'power1.inOut',onUpdate:update},.3)
      .to(state,{bal:.4,duration:.3,ease:'power1.inOut',onUpdate:update},.55)
      .to('[data-aff-out]',{opacity:1,scale:1,duration:.35,ease:'back.out(1.4)'},.75);
    update();
  }
});

/* Media (videos, iframes, lazy images) changes page height after init — re-measure once settled. */
addEventListener('load',()=>ScrollTrigger.refresh());
document.querySelectorAll('.scene video,.mc-preview video,.case-preview video').forEach(v=>{
  v.addEventListener('loadedmetadata',()=>ScrollTrigger.refresh(),{once:true});
});

} /* end gsap guard */
(function(){
  var g = document.getElementById('callGuard');
  if(!g) return;
  var btn = g.querySelector('.call-btn');
  var label = g.querySelector('.call-label');
  var tel = (g.dataset.tel || '').trim();
  var armWindow = (parseInt(g.dataset.armSeconds,10) || 4) * 1000;
  var armed = false, timer = null;
  var pretty = tel ? tel.replace(/(\+?\d{2})(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4') : '';

  function disarm(){
    armed = false;
    g.classList.remove('armed');
    label.textContent = tel ? 'Call our after-hours sales agent — tap to reveal'
                            : 'After-hours sales agent — number coming soon';
    if(timer){ clearTimeout(timer); timer = null; }
  }

  btn.addEventListener('click', function(e){
    // Ignore synthetic / programmatic clicks (bots, autoclickers)
    if(!e.isTrusted) return;
    if(!tel){ label.textContent = 'After-hours sales agent — number coming soon'; return; }

    if(!armed){
      armed = true;
      g.classList.add('armed');
      label.textContent = 'Call ' + pretty + ' — tap again to dial';
      timer = setTimeout(disarm, armWindow);
      return;
    }
    // Second trusted tap within the window → dial
    disarm();
    window.location.href = 'tel:' + tel.replace(/\s+/g,'');
  });

  disarm();
})();
(function(){
  var b = document.getElementById('navCall');
  if(!b) return;
  var tel = (b.dataset.tel || '').trim();
  var armWindow = (parseInt(b.dataset.armSeconds,10) || 4) * 1000;
  var idle = 'Call TruChat';
  var armed = false, timer = null;

  function disarm(){
    armed = false;
    b.classList.remove('armed');
    b.textContent = idle;
    if(timer){ clearTimeout(timer); timer = null; }
  }

  b.addEventListener('click', function(e){
    e.preventDefault();
    if(!e.isTrusted) return;          // ignore synthetic / bot clicks
    if(!tel) return;
    if(!armed){                        // tap 1 → reveal the number (works on desktop too)
      armed = true;
      b.classList.add('armed');
      b.textContent = tel + ' ↗';
      timer = setTimeout(disarm, armWindow);
      return;
    }
    disarm();                          // tap 2 → dial
    window.location.href = 'tel:' + tel.replace(/\s+/g,'');
  });

  disarm();
})();
/* ─── HAMBURGER MENU ────────────────────────────── */
(function(){
  const burger=document.getElementById('navBurger');
  const nav=document.querySelector('.nav');
  const mobile=document.getElementById('navMobile');
  if(!burger||!nav)return;
  burger.addEventListener('click',function(e){
    e.stopPropagation();
    const open=nav.classList.toggle('open');
    burger.setAttribute('aria-expanded',open);
    document.body.style.overflow=open?'hidden':'';
  });
  if(mobile){
    mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      document.body.style.overflow='';
    }));
  }
  document.addEventListener('click',function(e){
    if(nav.classList.contains('open')&&!nav.contains(e.target)){
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      document.body.style.overflow='';
    }
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&nav.classList.contains('open')){
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      document.body.style.overflow='';
    }
  });
})();

/* ─── SMOOTH ANCHOR SCROLL ──────────────────────── */
(function(){
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',function(e){
      const id=this.getAttribute('href');
      if(id==='#')return;
      const target=document.querySelector(id);
      if(!target)return;
      e.preventDefault();
      const offset=90;
      const top=target.getBoundingClientRect().top+window.scrollY-offset;
      window.scrollTo({top,behavior:'smooth'});
    });
  });
})();

/* ─── TEXT SCRAMBLE EFFECT ──────────────────────── */
(function(){
  class TextScramble{
    constructor(el){this.el=el;this.chars='!<>-_\/[]{}—=+*^?#________';this.update=this.update.bind(this);}
    setText(newText){
      const oldText=this.el.innerText;
      const length=Math.max(oldText.length,newText.length);
      const promise=new Promise(resolve=>this.resolve=resolve);
      this.queue=[];
      for(let i=0;i<length;i++){
        const from=oldText[i]||'';
        const to=newText[i]||'';
        const start=Math.floor(Math.random()*30);
        const end=start+Math.floor(Math.random()*30);
        this.queue.push({from,to,start,end});
      }
      cancelAnimationFrame(this.frameRequest);
      this.frame=0;
      this.update();
      return promise;
    }
    update(){
      let output='';
      let complete=0;
      for(let i=0,n=this.queue.length;i<n;i++){
        let{from,to,start,end,char}=this.queue[i];
        if(this.frame>=end){complete++;output+=to;}
        else if(this.frame>=start){
          if(!char||Math.random()<.28){char=this.randomChar();this.queue[i].char=char;}
          output+=`<span class="scramble-char">${char}</span>`;
        }else{output+=from;}
      }
      this.el.innerHTML=output;
      if(complete===this.queue.length){this.resolve();}
      else{this.frameRequest=requestAnimationFrame(this.update);this.frame++;}
    }
    randomChar(){return this.chars[Math.floor(Math.random()*this.chars.length)];}
  }
  if(typeof gsap!=='undefined'&&typeof ScrollTrigger!=='undefined'){
    document.querySelectorAll('.chapter-title').forEach(el=>{
      const original=el.innerText;
      const fx=new TextScramble(el);
      el.innerHTML='';
      ScrollTrigger.create({trigger:el,start:'top 82%',once:true,onEnter:()=>fx.setText(original)});
    });
  }
})();

/* ─── CUSTOM CURSOR GLOW ────────────────────────── */
(function(){
  if(window.matchMedia('(pointer: coarse)').matches)return;
  const glow=document.createElement('div');
  glow.className='cursor-glow';
  const dot=document.createElement('div');
  dot.className='cursor-glow-dot';
  document.body.appendChild(glow);
  document.body.appendChild(dot);
  let mx=0,my=0,cx=0,cy=0;
  let active=false;
  document.addEventListener('mousemove',e=>{
    mx=e.clientX;my=e.clientY;
    dot.style.left=(mx-2)+'px';
    dot.style.top=(my-2)+'px';
    if(!active){active=true;glow.classList.add('active');dot.classList.add('active');}
  },{passive:true});
  (function animate(){
    cx+=(mx-cx)*.12;
    cy+=(my-cy)*.12;
    glow.style.left=(cx-12)+'px';
    glow.style.top=(cy-12)+'px';
    requestAnimationFrame(animate);
  })();
  const interactives=document.querySelectorAll('a,button,.btn,.module-card,.case,.step,.nav-cta,.proof-link,.book-float,.tc-launcher');
  interactives.forEach(el=>{
    el.addEventListener('mouseenter',()=>glow.classList.add('hover'));
    el.addEventListener('mouseleave',()=>glow.classList.remove('hover'));
  });
})();

/* ─── 1. SMART NAV ──────────────────────────────── */
(function(){
  const nav=document.querySelector('.nav');if(!nav)return;
  let lastY=0,ticking=false,threshold=80;
  window.addEventListener('scroll',function(){
    if(!ticking){requestAnimationFrame(function(){const y=window.scrollY;if(y>threshold&&y>lastY){nav.classList.add('nav--hidden');}else{nav.classList.remove('nav--hidden');}lastY=y;ticking=false;});ticking=true;}
  },{passive:true});
})();

/* ─── NAV SCROLLED STATE ────────────────────────── */
(function(){
  const nav=document.querySelector('.nav');if(!nav)return;
  window.addEventListener('scroll',()=>{
    nav.classList.toggle('scrolled',window.scrollY>50);
  },{passive:true});
})();

/* ─── MAGNETIC BUTTONS ──────────────────────────── */
(function(){
  if(window.matchMedia('(pointer: coarse)').matches)return;
  document.querySelectorAll('.btn-primary, .nav-cta, .book-float, .call-btn').forEach(btn=>{
    btn.addEventListener('mousemove',e=>{
      const r=btn.getBoundingClientRect();
      const x=e.clientX-r.left-r.width/2;
      const y=e.clientY-r.top-r.height/2;
      btn.style.transform=`translate(${x*0.15}px, ${y*0.15}px)`;
    });
    btn.addEventListener('mouseleave',()=>{btn.style.transform='';});
  });
})();

/* ─── 2. BACK-TO-TOP ────────────────────────────── */
(function(){
  const btt=document.getElementById('btt');if(!btt)return;
  const hero=document.querySelector('.hero');
  const onScroll=()=>{const h=hero?hero.getBoundingClientRect().bottom:400;btt.classList.toggle('visible',window.scrollY>h);};
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  btt.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
})();

/* ─── 4. MOBILE NAV SCROLLSPY ───────────────────── */
(function(){
  const mobileLinks=document.querySelectorAll('.nav-mobile a[href^="#"]');
  if(!mobileLinks.length||!window.IntersectionObserver)return;
  const map=new Map();
  mobileLinks.forEach(a=>{const sec=document.querySelector(a.getAttribute('href'));if(sec)map.set(sec,a);});
  const io=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        mobileLinks.forEach(l=>l.classList.remove('active'));
        const a=map.get(en.target);if(a)a.classList.add('active');
      }
    });
  },{rootMargin:'-35% 0px -55% 0px'});
  map.forEach((a,sec)=>io.observe(sec));
})();

/* ─── 5. STEP CONNECTORS ────────────────────────── */
(function(){
  const conn=document.getElementById('stepConn');if(!conn)return;
  if(typeof gsap!=='undefined'&&typeof ScrollTrigger!=='undefined'){
    ScrollTrigger.create({trigger:conn,start:'top 80%',once:true,onEnter:()=>conn.classList.add('visible')});
  }else{conn.classList.add('visible');}
})();

/* ─── 6. PROACTIVE TRUCHAT ──────────────────────── */
(function(){
  const bubble=document.getElementById('tcProactive');
  const tc=document.getElementById('tc');
  if(!bubble)return;
  let shown=false;
  const show=()=>{if(shown||tc.classList.contains('open'))return;shown=true;bubble.classList.add('visible');};
  setTimeout(show,25000);
  let scrollTimer;
  window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{if(window.scrollY>1200)show();},400);},{passive:true});
})();
/* ─── 6. PROACTIVE TRUCHAT ──────────────────────── */
(function(){
  const bubble=document.getElementById('tcProactive');
  const tc=document.getElementById('tc');
  if(!bubble)return;
  let shown=false;
  const show=()=>{if(shown||tc.classList.contains('open'))return;shown=true;bubble.classList.add('visible');};
  setTimeout(show,25000);
  let scrollTimer;
  window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{if(window.scrollY>1200)show();},400);},{passive:true});
})();