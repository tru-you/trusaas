/* MKR Auto Sales — Splash intro: plays once per session, then reveals the showroom.
   The clip is deliberately small (720x720, no audio track, ~200KB). It is also
   skipped outright on a metered or slow connection — an intro is never worth
   spending a visitor's data allowance on before they have seen a single car. */
(function(){
  try{
    if(sessionStorage.getItem("mkrSplashSeen")) return;
  }catch(e){}
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Respect data saver and slow links: show the showroom, not the intro.
  try{
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if(conn && (conn.saveData || /(^|-)(2g|slow-2g)$/.test(conn.effectiveType||""))) return;
  }catch(e){}

  var el = document.createElement("div");
  el.className = "mkr-splash";
  el.setAttribute("role","dialog");
  el.setAttribute("aria-label","MKR Auto Sales intro");
  el.innerHTML =
    '<video id="mkrSplashVid" muted autoplay playsinline preload="auto" poster="splash-poster.jpg" src="splash-720.mp4"></video>'
    +'<div class="mkr-splash-tag">MKR Auto Sales &middot; <b>Next Gen Mobility</b></div>'
    +'<button class="mkr-splash-skip" id="mkrSplashSkip">Enter showroom'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'
    +'<div class="mkr-splash-bar" id="mkrSplashBar"></div>';

  function mount(){
    document.body.appendChild(el);
    document.body.style.overflow = "hidden";
    var vid = el.querySelector("#mkrSplashVid");
    var bar = el.querySelector("#mkrSplashBar");
    var done = false;

    function dismiss(){
      if(done) return;
      done = true;
      try{sessionStorage.setItem("mkrSplashSeen","1");}catch(e){}
      el.classList.add("out");
      document.body.style.overflow = "";
      setTimeout(function(){el.remove();}, 800);
    }

    el.querySelector("#mkrSplashSkip").addEventListener("click", dismiss);
    vid.addEventListener("ended", dismiss);
    vid.addEventListener("error", dismiss);
    vid.addEventListener("timeupdate", function(){
      if(vid.duration) bar.style.width = (vid.currentTime/vid.duration*100)+"%";
    });
    // never trap the visitor: autoplay block, stall, or anything else
    var p = vid.play && vid.play();
    if(p && p.catch) p.catch(dismiss);
    setTimeout(dismiss, 13000);
  }

  if(document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
