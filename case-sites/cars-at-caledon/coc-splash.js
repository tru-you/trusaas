/* Cars on Caledon — Splash intro v2: plays splash.mp4 once per session inside a
   3D stage. The card tilts with the pointer, the skip button is magnetic, and the
   stage colour is sampled from the video's own pixels every frame so the card
   never detaches from the backdrop as the clip fades light-grey -> navy. */
(function(){
  try{
    if(sessionStorage.getItem("cocSplashSeen")) return;
  }catch(e){}
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Respect data saver and slow links: show the showroom, not the intro.
  try{
    var _c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if(_c && (_c.saveData || /(^|-)(2g|slow-2g)$/.test(_c.effectiveType||""))) return;
  }catch(e){}

  var FINE = window.matchMedia("(pointer:fine)").matches;

  var el = document.createElement("div");
  el.className = "coc-splash";
  el.setAttribute("role","dialog");
  el.setAttribute("aria-label","Cars on Caledon intro");
  el.innerHTML =
    '<div class="coc-splash-atmo" aria-hidden="true"></div>'
    +'<div class="coc-splash-dust" aria-hidden="true"><i></i><i></i><i></i></div>'
    +'<div class="coc-splash-card" id="cocSplashCard">'
      // poster = settled final frame, so blocked autoplay still shows the brand
      +'<video id="cocSplashVid" muted autoplay playsinline preload="auto" poster="splash-poster-small.jpg?v=5" src="splash-small.mp4?v=5"></video>'
      +'<div class="coc-splash-rim" aria-hidden="true"></div>'
      +'<div class="coc-splash-refl" aria-hidden="true"></div>'
    +'</div>'
    +'<div class="coc-splash-type" aria-hidden="true">'
      +'<div class="coc-splash-word">Cars on Caledon</div>'
      +'<div class="coc-splash-rule"></div>'
      +'<div class="coc-splash-tag">Quality pre-owned &middot; Kariega</div>'
    +'</div>'
    +'<button class="coc-splash-skip" id="cocSplashSkip">Enter showroom'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'
    +'<div class="coc-splash-bar" id="cocSplashBar"></div>';

  function mount(){
    document.body.appendChild(el);
    document.body.style.overflow = "hidden";
    var vid  = el.querySelector("#cocSplashVid");
    var bar  = el.querySelector("#cocSplashBar");
    var card = el.querySelector("#cocSplashCard");
    var skip = el.querySelector("#cocSplashSkip");
    var done = false, raf = 0;

    /* ── stage colour: sample the clip's TOP and BOTTOM EDGE STRIPS only —
       a whole-frame downscale would average the blue COC mark into the stage
       and tint it. The logo never reaches the edges. ── */
    var cvs = document.createElement("canvas");
    cvs.width = 1; cvs.height = 2;
    var ctx = cvs.getContext("2d", {willReadFrequently:true});
    var canSample = true;

    /* ── 3D: pointer tilt on the card (desktop), gentle autonomous sway on
       touch so the card still feels alive without a pointer. ── */
    var tx = 0, ty = 0, cx = 0, cy = 0, t0 = performance.now();
    if(FINE){
      el.addEventListener("pointermove", function(e){
        var nx = e.clientX / window.innerWidth  - .5;
        var ny = e.clientY / window.innerHeight - .5;
        tx = nx; ty = ny;
      });
    }

    function loop(now){
      if(done) return;

      // stage colour sync
      if(canSample && vid.readyState >= 2 && vid.videoWidth){
        try{
          var vw = vid.videoWidth, vh = vid.videoHeight;
          var strip = Math.max(2, Math.round(vh * 0.03));
          ctx.drawImage(vid, 0, 0,          vw, strip, 0, 0, 1, 1);
          ctx.drawImage(vid, 0, vh - strip, vw, strip, 0, 1, 1, 1);
          var d = ctx.getImageData(0, 0, 1, 2).data;
          el.style.background = "linear-gradient(180deg,"
            + "rgb("+d[0]+","+d[1]+","+d[2]+") 0%,"
            + "rgb("+d[4]+","+d[5]+","+d[6]+") 100%)";
          el.classList.toggle("dark", (d[0]+d[1]+d[2]) < 260);
        }catch(err){ canSample = false; }
      }

      // card 3D
      if(FINE){
        cx += (tx - cx) * .08;
        cy += (ty - cy) * .08;
      }else{
        var t = (now - t0) / 1000;
        cx = Math.sin(t * .55) * .10;
        cy = Math.cos(t * .40) * .07;
      }
      card.style.transform =
        "rotateY(" + (cx * 12).toFixed(2) + "deg)" +
        "rotateX(" + (-cy * 9).toFixed(2) + "deg)" +
        "translateZ(0)";

      raf = requestAnimationFrame(loop);
    }

    /* magnetic skip — pulls toward the pointer inside a 90px field */
    if(FINE){
      var pull = function(e){
        var r = skip.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width/2);
        var my = e.clientY - (r.top + r.height/2);
        var dist = Math.hypot(mx, my);
        if(dist < 110){
          var f = (1 - dist/110) * .45;
          skip.style.transform = "translate(" + (mx*f).toFixed(1) + "px," + (my*f).toFixed(1) + "px)";
        }else{
          skip.style.transform = "";
        }
      };
      el.addEventListener("pointermove", pull);
      skip.addEventListener("pointerleave", function(){ skip.style.transform = ""; });
    }

    function dismiss(){
      if(done) return;
      done = true;
      if(raf) cancelAnimationFrame(raf);
      try{sessionStorage.setItem("cocSplashSeen","1");}catch(e){}
      // Hand off to the hero backdrop's own gradient stops (#12203F -> #0A0F1C).
      // The clip's final frame tops out at rgb(19,39,66) ~= #12203F, so the stage
      // glides into the page instead of jumping navy -> near-black.
      el.style.transition = "background .5s linear, opacity .7s cubic-bezier(.22,1,.36,1)";
      el.style.background = "linear-gradient(180deg,#12203F 0%,#0A0F1C 100%)";
      el.classList.add("out");
      document.body.style.overflow = "";
      setTimeout(function(){el.remove();}, 800);
    }

    skip.addEventListener("click", dismiss);
    vid.addEventListener("ended", dismiss);
    vid.addEventListener("error", dismiss);
    vid.addEventListener("timeupdate", function(){
      if(vid.duration) bar.style.width = (vid.currentTime/vid.duration*100)+"%";
    });

    raf = requestAnimationFrame(loop);

    /* Autoplay gets refused on iOS Low Power Mode, Android Data Saver and the
       Facebook/Instagram in-app browsers. Never vanish silently — hold on the
       poster frame so the brand moment still lands, then continue in. */
    function fallbackToPoster(){
      if(done) return;
      el.classList.add("dark", "still");
      // matches the poster frame's own edge colours so the still blends too
      el.style.background = "linear-gradient(180deg,rgb(19,39,63) 0%,rgb(25,48,80) 100%)";
      setTimeout(dismiss, 1600);
    }
    var p = vid.play && vid.play();
    if(p && p.catch) p.catch(fallbackToPoster);
    setTimeout(function(){
      if(!done && vid.currentTime === 0) fallbackToPoster();
    }, 1800);

    // hard ceiling: clip is 10s — nobody is ever held longer than ~13s
    setTimeout(dismiss, 13000);
  }

  /* Never burn the once-per-session play in a hidden tab — autoplay is refused
     there, the fallback dismisses silently, and the visitor who opened us in a
     background tab would never see the intro. Wait for visibility instead. */
  function boot(){
    if(document.hidden){
      document.addEventListener("visibilitychange", function once(){
        if(document.hidden) return;
        document.removeEventListener("visibilitychange", once);
        mount();
      });
      return;
    }
    mount();
  }
  if(document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
