(function(){
  var frame=document.getElementById('vsFrame'); if(!frame) return;
  var bar=document.getElementById('vsBar'), pct=document.getElementById('vsPct');
  var dots=[].slice.call(frame.querySelectorAll('.vs-dot'));
  var CYCLE=4200, TARGET=95, raf, t0=null, io;
  function frameStep(ts){
    if(t0===null) t0=ts;
    var p=((ts-t0)%CYCLE)/CYCLE;            // 0..1 loop
    var prog=Math.min(p/0.45,1);            // scan reaches bottom at 45%
    if(bar) bar.style.width=(prog*100).toFixed(0)+'%';
    if(pct) pct.textContent=Math.round(prog*TARGET);
    var passed=prog*100;                    // vertical scan position 0..100
    dots.forEach(function(d){
      var at=+d.getAttribute('data-at');
      if(p<0.02) d.classList.remove('show');           // reset each cycle
      else if(passed>=at) d.classList.add('show');
    });
    raf=requestAnimationFrame(frameStep);
  }
  function start(){ if(!raf){ t0=null; raf=requestAnimationFrame(frameStep); } }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf=null; } }
  if('IntersectionObserver' in window){
    io=new IntersectionObserver(function(es){ es.forEach(function(e){ e.isIntersecting?start():stop(); }); },{threshold:.15});
    io.observe(frame);
  } else { start(); }
})();
(function(){
  var frame=document.getElementById('rmFrame'); if(!frame) return;
  var bar=document.getElementById('rmBar'), pct=document.getElementById('rmPct');
  var mBlur=document.getElementById('rmModeBlur'), mReplace=document.getElementById('rmModeReplace');
  var CYCLE=5200, raf, t0=null, io, lastHalf=null;
  function frameStep(ts){
    if(t0===null) t0=ts;
    var p=((ts-t0)%CYCLE)/CYCLE;
    var reveal=Math.min(Math.max((p-0.06)/0.38,0),1); // matches rmWipe keyframes
    var pctVal=Math.round(reveal*100);
    if(bar) bar.style.width=pctVal+'%';
    if(pct) pct.textContent=pctVal;
    var half=p<0.52?0:1;
    if(half!==lastHalf){
      lastHalf=half;
      var replace = half===1;
      frame.classList.toggle('mode-replace',replace);
      frame.classList.toggle('mode-blur',!replace);
      if(mBlur) mBlur.classList.toggle('active',!replace);
      if(mReplace) mReplace.classList.toggle('active',replace);
    }
    raf=requestAnimationFrame(frameStep);
  }
  function start(){ if(!raf){ t0=null; raf=requestAnimationFrame(frameStep); } }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf=null; } }
  if('IntersectionObserver' in window){
    io=new IntersectionObserver(function(es){ es.forEach(function(e){ e.isIntersecting?start():stop(); }); },{threshold:.15});
    io.observe(frame);
  } else { start(); }
})();
(function(){
  const u=document.getElementById('rcUnits'),g=document.getElementById('rcGross');
  const uV=document.getElementById('rcUnitsV'),gV=document.getElementById('rcGrossV');
  const yr=document.getElementById('rcYear'),mo=document.getElementById('rcMonth'),ux=document.getElementById('rcUnitsX');
  const UPLIFT=0.18;
  const zar=n=>'R'+Math.round(n).toLocaleString('en-ZA').replace(/,/g,' ');
  const compact=n=>{ if(n>=1e6) return 'R'+(n/1e6).toFixed(1)+'m'; if(n>=1e3) return 'R'+Math.round(n/1e3)+'k'; return zar(n); };
  function paint(el){ const p=(el.value-el.min)/(el.max-el.min)*100; el.style.setProperty('--p',p+'%'); }
  function calc(){
    const units=+u.value, gross=+g.value;
    const extraU=units*UPLIFT;
    const extraMo=extraU*gross;
    uV.textContent=units; gV.textContent=zar(gross);
    ux.textContent='+'+ (extraU<10?extraU.toFixed(1):Math.round(extraU));
    mo.textContent=compact(extraMo);
    yr.innerHTML=compact(extraMo*12)+'<span style="font-size:22px;color:rgba(255,255,255,.5)"> / yr</span>';
    paint(u); paint(g);
  }
  u.addEventListener('input',calc); g.addEventListener('input',calc); calc();
})();
/* page loader — dismiss when scan animation completes, or hit the 2s cap */
(function(){
  const loader=document.getElementById('axLoader'); if(!loader) return;
  const start=performance.now(), MIN=600;
  let done=false;
  function dismiss(){
    if(done) return; done=true;
    const wait=Math.max(0, MIN-(performance.now()-start));
    setTimeout(()=>{ loader.classList.add('done'); setTimeout(()=>loader.remove(),500); }, wait);
  }
  window.__axlDismiss = dismiss;
  if (window.__axlSplashDone) dismiss();
  setTimeout(dismiss, 2000); // hard cap in case Lottie stalls
})();
/* branded poster placeholders for videos (preload=none shows black otherwise) */
(function(){
  function poster(title){
    const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720' viewBox='0 0 1280 720'>`
      +`<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0A1B2A'/><stop offset='.55' stop-color='#0d2440'/><stop offset='1' stop-color='#0A1B2A'/></linearGradient>`
      +`<radialGradient id='glow' cx='50%' cy='42%' r='55%'><stop offset='0' stop-color='#00A1DD' stop-opacity='.28'/><stop offset='1' stop-color='#00A1DD' stop-opacity='0'/></radialGradient></defs>`
      +`<rect width='1280' height='720' fill='url(#g)'/><rect width='1280' height='720' fill='url(#glow)'/>`
      +`<g stroke='#00A1DD' stroke-opacity='.08' stroke-width='1'>`
      +Array.from({length:25},(_,i)=>`<line x1='${i*52}' y1='0' x2='${i*52}' y2='720'/>`).join('')
      +Array.from({length:14},(_,i)=>`<line x1='0' y1='${i*52}' x2='1280' y2='${i*52}'/>`).join('')+`</g>`
      +`<circle cx='640' cy='330' r='58' fill='#fff' fill-opacity='.06' stroke='#7FE9E3' stroke-opacity='.5' stroke-width='2'/>`
      +`<path d='M624 304 L672 330 L624 356 Z' fill='#7FE9E3'/>`
      +`<text x='640' y='470' text-anchor='middle' font-family='Archivo, sans-serif' font-size='34' font-weight='800' fill='#ffffff'>${title}</text>`
      +`<text x='640' y='508' text-anchor='middle' font-family='monospace' font-size='16' letter-spacing='7' fill='#00A1DD'>▶  TruSaaS DEMO</text>`
      +`</svg>`;
    return 'data:image/svg+xml,'+encodeURIComponent(svg);
  }
  function titleFor(v){
    if(v.dataset.title) return v.dataset.title;
    const cap=v.closest('.vid-wrap')?.querySelector('.vid-title');
    return cap? cap.textContent.trim() : 'Watch the demo';
  }
  document.querySelectorAll('.vid-wrap video, .vid-feature-wrap video').forEach(v=>{
    v.setAttribute('poster', poster(titleFor(v)));
  });
})();
(function(){
  function fetchAnim(){
    return fetch('assets/img/tchek/hero-animation.json').then(function(r){ return r.json(); }).then(function(json){
      (json.assets || []).forEach(function(a){
        if (a.p && !a.p.startsWith('data:') && !a.u) { a.p = 'lottie-' + a.p; }
      });
      return json;
    });
  }
  var pending = null;
  function getAnim(){ if (!pending) pending = fetchAnim(); return pending; }

  // Splash — scan animation, sped up, dismisses on first cycle
  function startSplash(){
    var el = document.getElementById('axlSplashAnim');
    if (!el || !window.lottie) return;
    getAnim().then(function(json){
      var anim = window.lottie.loadAnimation({
        container: el, renderer: 'svg', loop: false, autoplay: true,
        animationData: json,
        assetsPath: 'assets/img/tchek/',
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
      });
      anim.setSpeed(2.2);
      anim.addEventListener('complete', function(){ window.__axlSplashDone = true; if (window.__axlDismiss) window.__axlDismiss(); });
    }).catch(function(){ window.__axlSplashDone = true; if (window.__axlDismiss) window.__axlDismiss(); });
  }

  // Section-05 hero — full loop
  function startHero(){
    var el = document.getElementById('trulensHeroAnim');
    if (!el || !window.lottie) return;
    getAnim().then(function(json){
      window.lottie.loadAnimation({
        container: el, renderer: 'svg', loop: true, autoplay: true,
        animationData: json,
        assetsPath: 'assets/img/tchek/',
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
      });
    }).catch(function(){ el.classList.add('trulens-anim-fallback'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ startSplash(); startHero(); });
  } else {
    startSplash(); startHero();
  }
})();
(function(){
  const phrases=['Better results.','More test drives.','Faster listings.','Sold in days.','Every portal, live.'];
  let idx=0;
  const el=document.getElementById('axCycle');
  if(!el) return;
  setInterval(function(){
    el.classList.add('out');
    setTimeout(function(){
      idx=(idx+1)%phrases.length;
      el.textContent=phrases[idx];
      el.classList.remove('out');
      el.style.animation='none';
      el.offsetHeight;
      el.style.animation='axCycleIn .55s cubic-bezier(.22,1,.36,1) both';
    },400);
  },2800);
})();