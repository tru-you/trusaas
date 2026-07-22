/* Cars on Caledon — Splash intro: plays splash.mp4 once per session, then reveals the site.
   The stage colour is sampled from the video itself every frame, so the card edge never
   detaches from the background as the clip fades light-grey -> navy. */
(function(){
  try{
    if(sessionStorage.getItem("cocSplashSeen")) return;
  }catch(e){}
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var el = document.createElement("div");
  el.className = "coc-splash";
  el.setAttribute("role","dialog");
  el.setAttribute("aria-label","Cars on Caledon intro");
  el.innerHTML =
    '<video id="cocSplashVid" muted autoplay playsinline preload="auto" src="splash.mp4"></video>'
    +'<div class="coc-splash-tag">Cars on Caledon &middot; Kariega</div>'
    +'<button class="coc-splash-skip" id="cocSplashSkip">Enter showroom'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'
    +'<div class="coc-splash-bar" id="cocSplashBar"></div>';

  function mount(){
    document.body.appendChild(el);
    document.body.style.overflow = "hidden";
    var vid = el.querySelector("#cocSplashVid");
    var bar = el.querySelector("#cocSplashBar");
    var done = false, raf = 0;

    /* Sample the clip's TOP and BOTTOM EDGE STRIPS only — never a whole-frame
       downscale, which would average the blue COC mark into the stage colour and
       tint the backdrop. The logo never reaches the edges, so these strips are
       pure background. Each strip is squashed to 1px = its own average. */
    var cvs = document.createElement("canvas");
    cvs.width = 1; cvs.height = 2;
    var ctx = cvs.getContext("2d", {willReadFrequently:true});
    var canSample = true;

    function syncStage(){
      if(done) return;
      if(canSample && vid.readyState >= 2 && vid.videoWidth){
        try{
          var vw = vid.videoWidth, vh = vid.videoHeight;
          var strip = Math.max(2, Math.round(vh * 0.03));
          ctx.drawImage(vid, 0, 0,          vw, strip, 0, 0, 1, 1);  // top edge
          ctx.drawImage(vid, 0, vh - strip, vw, strip, 0, 1, 1, 1);  // bottom edge
          var d = ctx.getImageData(0, 0, 1, 2).data;
          el.style.background = "linear-gradient(180deg,"
            + "rgb("+d[0]+","+d[1]+","+d[2]+") 0%,"
            + "rgb("+d[4]+","+d[5]+","+d[6]+") 100%)";
          // reveal tag + skip in light-on-dark once the clip has actually gone dark
          el.classList.toggle("dark", (d[0]+d[1]+d[2]) < 260);
        }catch(err){ canSample = false; }   // tainted canvas — fall back to CSS stage
      }
      raf = requestAnimationFrame(syncStage);
    }

    function dismiss(){
      if(done) return;
      done = true;
      if(raf) cancelAnimationFrame(raf);
      try{sessionStorage.setItem("cocSplashSeen","1");}catch(e){}
      el.classList.add("out");
      document.body.style.overflow = "";
      setTimeout(function(){el.remove();}, 800);
    }

    el.querySelector("#cocSplashSkip").addEventListener("click", dismiss);
    vid.addEventListener("ended", dismiss);
    vid.addEventListener("error", dismiss);
    vid.addEventListener("timeupdate", function(){
      if(vid.duration) bar.style.width = (vid.currentTime/vid.duration*100)+"%";
    });

    raf = requestAnimationFrame(syncStage);

    // if autoplay is blocked or the video stalls, don't trap the visitor
    var p = vid.play && vid.play();
    if(p && p.catch) p.catch(dismiss);
    setTimeout(dismiss, 13000);
  }

  if(document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
