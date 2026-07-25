/* ============================================================
 * TruDemo — shared splash + motion layer for TruWeb demo sites
 * Mirrors the true-cars.co.za intro & motion system, brand-tinted.
 *
 * <script src="../shared/tru-demo.js"
 *         data-name="HV" data-name2="Motors"
 *         data-accent="#0B5BD7" data-accent2="#4D8DFF"
 *         data-tag="Worcester · Western Cape"
 *         data-sys="Hand-picked stock|Bank finance|Trade-ins welcome"></script>
 * ============================================================ */
(function(){
  "use strict";
  var scr = document.currentScript;
  var A = function(k, d){ return (scr && scr.getAttribute("data-" + k)) || d; };

  var CFG = {
    name:   A("name", "True"),
    name2:  A("name2", "Cars"),
    suffix: A("suffix", ""),
    accent: A("accent", "#7FE9E3"),
    accent2:A("accent2", "#4D9BFF"),
    tag:    A("tag", ""),
    sys:    A("sys", "").split("|").filter(Boolean),
    hold:   parseInt(A("hold", "3200"), 10),
    key:    A("key", "truDemoSeen")
  };

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var force  = /[?&]splash/.test(location.search);
  var root   = document.documentElement;

  /* the host page's own preloader would double up — retire it */
  function killLegacyPreloader(){
    var p = document.getElementById("preloader");
    if(p){ p.classList.add("done"); p.style.display = "none"; }
  }

  var seen = false;
  try{ seen = !force && sessionStorage.getItem(CFG.key) === "1"; }catch(e){}

  /* ---------------------------------------------------------- styles */
  var css = [
    "html.td-splashing,html.td-splashing body{overflow:hidden!important}",

    "#tdSplash{position:fixed;inset:0;z-index:99999;overflow:hidden;color:#fff;clip-path:inset(0 0 0 0);",
    "background:radial-gradient(130% 100% at 50% 118%,rgba(255,255,255,.10) 0%,#101826 34%,#070C14 76%,#04070C 100%);",
    "--td-a:" + CFG.accent + ";--td-b:" + CFG.accent2 + "}",

    "#tdSplash .td-dust{position:absolute;inset:0;z-index:1}",
    "#tdSplash .td-dust i{position:absolute;border-radius:50%;background:#dbeaff;opacity:0;animation:tdDust linear infinite}",
    "@keyframes tdDust{0%{opacity:0;transform:translate3d(0,0,0)}12%{opacity:.5}70%{opacity:.3}",
    "100%{opacity:0;transform:translate3d(var(--dx,20px),var(--dy,-80px),0)}}",

    "#tdSplash .td-beam{position:absolute;bottom:-8%;width:58vw;height:150vh;z-index:2;pointer-events:none;",
    "filter:blur(26px);opacity:0;mix-blend-mode:screen}",
    "#tdSplash .td-beam.l{left:-6vw;transform-origin:bottom left;",
    "background:linear-gradient(6deg,rgba(255,244,220,.5),rgba(255,226,180,.14) 42%,transparent 72%);",
    "animation:tdBeamL 1.5s cubic-bezier(.16,.9,.28,1) .05s forwards}",
    "#tdSplash .td-beam.r{right:-6vw;transform-origin:bottom right;",
    "background:linear-gradient(-6deg,var(--td-b),transparent 62%);opacity:0;",
    "animation:tdBeamR 1.5s cubic-bezier(.16,.9,.28,1) .18s forwards}",
    "@keyframes tdBeamL{0%{opacity:0;transform:rotate(-58deg) scaleY(.2)}35%{opacity:1}",
    "100%{opacity:.7;transform:rotate(-30deg) scaleY(1)}}",
    "@keyframes tdBeamR{0%{opacity:0;transform:rotate(58deg) scaleY(.2)}35%{opacity:.5}",
    "100%{opacity:.34;transform:rotate(30deg) scaleY(1)}}",

    "#tdSplash .td-flash{position:absolute;inset:0;z-index:6;pointer-events:none;background:#eaf4ff;opacity:0;",
    "mix-blend-mode:screen;animation:tdFlash .55s .5s ease-out forwards}",
    "@keyframes tdFlash{0%{opacity:0}18%{opacity:.42}100%{opacity:0}}",

    "#tdSplash .td-floor{position:absolute;left:-25%;right:-25%;bottom:0;height:44%;z-index:2;opacity:0;",
    "background-image:linear-gradient(color-mix(in srgb,var(--td-a) 26%,transparent) 1px,transparent 1px),",
    "linear-gradient(90deg,color-mix(in srgb,var(--td-a) 14%,transparent) 1px,transparent 1px);",
    "background-size:100% 46px,7.5% 100%;transform:perspective(300px) rotateX(66deg) scale(1.5);",
    "transform-origin:bottom center;",
    "mask-image:linear-gradient(180deg,transparent,#000 45%,rgba(0,0,0,.35));",
    "-webkit-mask-image:linear-gradient(180deg,transparent,#000 45%,rgba(0,0,0,.35));",
    "animation:tdFloorIn .9s .35s ease forwards,tdFloorRun 1.5s .35s linear infinite}",
    "@keyframes tdFloorIn{to{opacity:.8}}",
    "@keyframes tdFloorRun{to{background-position:0 46px,0 0}}",

    "#tdSplash .td-ring{position:absolute;left:50%;top:50%;width:min(560px,88vw);aspect-ratio:1;z-index:3;",
    "transform:translate(-50%,-50%);border-radius:50%;border:1px solid color-mix(in srgb,var(--td-a) 34%,transparent);",
    "opacity:0;animation:tdRing 2.2s .3s cubic-bezier(.16,1,.3,1) forwards}",
    "#tdSplash .td-ring.two{animation-delay:.55s;width:min(760px,120vw)}",
    "@keyframes tdRing{0%{opacity:0;transform:translate(-50%,-50%) scale(.55)}",
    "30%{opacity:.7}100%{opacity:0;transform:translate(-50%,-50%) scale(1.25)}}",

    "#tdSplash .td-vig{position:absolute;inset:0;z-index:7;pointer-events:none;",
    "background:radial-gradient(76% 62% at 50% 46%,transparent 40%,rgba(2,5,10,.74) 100%)}",
    "#tdSplash .td-lines{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:.22;",
    "background:repeating-linear-gradient(180deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)}",

    "#tdSplash .td-scan{position:absolute;left:0;right:0;height:150px;z-index:8;pointer-events:none;top:-160px;",
    "background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--td-a) 16%,transparent) 62%,",
    "var(--td-a) 84%,color-mix(in srgb,var(--td-a) 16%,transparent) 88%,transparent);",
    "animation:tdScan 1.5s 1s cubic-bezier(.45,0,.25,1) forwards}",
    "@keyframes tdScan{0%{top:-160px;opacity:0}12%{opacity:.85}88%{opacity:.85}100%{top:100%;opacity:0}}",

    "#tdSplash .td-inner{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;",
    "align-items:center;justify-content:center;text-align:center;padding:0 24px;",
    "transition:transform .8s cubic-bezier(.7,0,.3,1),opacity .5s ease}",

    "#tdSplash .td-mark{position:relative;display:inline-flex;align-items:baseline;",
    "font-family:'Fraunces',Georgia,serif;font-size:clamp(42px,8.4vw,88px);font-weight:600;",
    "letter-spacing:-.025em;line-height:1}",
    "#tdSplash .td-mark > span{display:inline-block;opacity:0;will-change:transform,filter}",
    "#tdSplash .td-mark .b{transform:translateX(-44px) scale(.86);filter:blur(14px);",
    "animation:tdIn .95s .52s cubic-bezier(.16,1,.3,1) forwards;text-shadow:0 0 46px rgba(210,230,255,.4)}",
    "#tdSplash .td-mark .c{transform:translateX(44px) scale(.86);",
    "background:linear-gradient(118deg,var(--td-a),var(--td-b) 62%);",
    "-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;",
    "filter:blur(14px);animation:tdInC .95s .66s cubic-bezier(.16,1,.3,1) forwards}",
    "#tdSplash .td-mark .sa{align-self:flex-start;margin-left:.4em;position:relative;top:.42em;",
    "font-family:'IBM Plex Mono',monospace;font-size:.2em;font-weight:600;letter-spacing:.3em;",
    "color:var(--td-a);transform:translateY(-16px);filter:blur(8px);",
    "animation:tdIn .8s .92s cubic-bezier(.16,1,.3,1) forwards}",
    "@keyframes tdIn{to{opacity:1;transform:none;filter:blur(0)}}",
    "@keyframes tdInC{to{opacity:1;transform:none;filter:blur(0) drop-shadow(0 0 26px color-mix(in srgb,var(--td-b) 45%,transparent))}}",

    "#tdSplash .td-shine{position:absolute;inset:-22% -34%;pointer-events:none;mix-blend-mode:overlay;",
    "background:linear-gradient(102deg,transparent 40%,rgba(255,255,255,.82) 50%,transparent 60%);",
    "transform:translateX(-125%);animation:tdShine 1.25s 1.05s cubic-bezier(.5,0,.2,1) forwards}",
    "@keyframes tdShine{to{transform:translateX(125%)}}",

    "#tdSplash .td-rule{width:0;height:1px;margin:24px auto 0;",
    "background:linear-gradient(90deg,transparent,var(--td-a),transparent);",
    "animation:tdRule .9s 1.15s cubic-bezier(.5,0,.2,1) forwards}",
    "@keyframes tdRule{to{width:min(320px,72vw)}}",

    "#tdSplash .td-tag{margin-top:18px;font-family:'IBM Plex Mono',monospace;",
    "font-size:clamp(9px,1.6vw,11.5px);letter-spacing:.34em;text-transform:uppercase;",
    "color:rgba(226,240,255,.6);opacity:0;transform:translateY(9px);animation:tdUp .8s 1.3s ease forwards}",
    "@keyframes tdUp{to{opacity:1;transform:none}}",
    "@keyframes tdFade{to{opacity:1}}",

    "#tdSplash .td-sys{display:flex;gap:20px;margin-top:24px;flex-wrap:wrap;justify-content:center;",
    "font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase}",
    "#tdSplash .td-sys span{display:inline-flex;align-items:center;gap:7px;color:rgba(226,240,255,.42);",
    "opacity:0;transform:translateY(8px);animation:tdUp .5s ease forwards}",
    "#tdSplash .td-sys span:nth-child(1){animation-delay:1.45s}",
    "#tdSplash .td-sys span:nth-child(2){animation-delay:1.62s}",
    "#tdSplash .td-sys span:nth-child(3){animation-delay:1.79s}",
    "#tdSplash .td-sys b{width:5px;height:5px;border-radius:50%;background:var(--td-a);",
    "box-shadow:0 0 9px var(--td-a);animation:tdBlip 1.1s ease-in-out infinite}",
    "@keyframes tdBlip{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}",

    "#tdSplash .td-load{display:flex;align-items:center;gap:12px;margin-top:30px;opacity:0;",
    "animation:tdFade .5s 1.5s ease forwards}",
    "#tdSplash .td-road{position:relative;width:min(300px,66vw);height:2px;border-radius:2px;",
    "background:rgba(255,255,255,.12);overflow:hidden}",
    "#tdSplash .td-road i{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);",
    "background:linear-gradient(90deg,var(--td-a),var(--td-b));",
    "box-shadow:0 0 14px color-mix(in srgb,var(--td-b) 70%,transparent);",
    "animation:tdLoad 1.35s 1.52s cubic-bezier(.42,0,.2,1) forwards}",
    "@keyframes tdLoad{to{transform:scaleX(1)}}",
    "#tdSplash .td-pct{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.12em;",
    "color:rgba(226,240,255,.55);min-width:34px;text-align:left}",

    "#tdSplash .td-skip{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);z-index:11;",
    "font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;",
    "color:rgba(226,240,255,.34);background:none;border:0;cursor:pointer;padding:12px 18px;",
    "opacity:0;animation:tdFade .6s 1.3s ease forwards;transition:color .2s}",
    "#tdSplash .td-skip:hover{color:rgba(255,255,255,.92)}",

    "#tdSplash.td-out{clip-path:inset(50% 0 50% 0);opacity:0;pointer-events:none;",
    "transition:clip-path .78s cubic-bezier(.76,0,.24,1),opacity .5s .3s ease}",
    "#tdSplash.td-out .td-inner{transform:scale(1.14);opacity:0}",

    "@media(max-width:520px){",
    "#tdSplash .td-mark{font-size:clamp(44px,13.2vw,70px)}",
    "#tdSplash .td-mark .b{transform:translateX(-30px) scale(.86)}",
    "#tdSplash .td-mark .c{transform:translateX(30px) scale(.86)}",
    "#tdSplash .td-beam{width:88vw;filter:blur(20px)}",
    "#tdSplash .td-sys{gap:14px;font-size:8.5px;margin-top:20px}",
    "#tdSplash .td-tag{letter-spacing:.24em;margin-top:15px}}",
    "@media(max-height:560px){#tdSplash .td-sys{display:none}#tdSplash .td-skip{bottom:14px}}",

    /* ---- motion layer ---- */
    "#tdProgress{position:fixed;top:0;left:0;height:2px;width:100%;z-index:9998;pointer-events:none;",
    "background:linear-gradient(90deg," + CFG.accent + "," + CFG.accent2 + ");transform:scaleX(0);",
    "transform-origin:0 50%;box-shadow:0 0 12px " + CFG.accent2 + "}",
    ".td-mag{transition:transform .35s cubic-bezier(.2,1,.32,1)}",
    ".td-tilt{transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,1,.32,1),box-shadow .5s}",
    ".td-tilt.td-tilting{transition:transform .12s linear}",
    ".td-sheen{position:relative;overflow:hidden}",
    ".td-sheen::after{content:'';position:absolute;top:0;left:-140%;width:60%;height:100%;pointer-events:none;",
    "background:linear-gradient(105deg,transparent,rgba(255,255,255,.26),transparent);",
    "transform:skewX(-16deg);opacity:0}",
    ".td-sheen.td-in::after{animation:tdSheen 1.1s .2s cubic-bezier(.5,0,.2,1) forwards}",
    "@keyframes tdSheen{0%{left:-140%;opacity:1}100%{left:160%;opacity:0}}",
    ".td-lift{opacity:0;transform:translateY(26px);",
    "transition:opacity .8s cubic-bezier(.2,1,.32,1),transform .8s cubic-bezier(.2,1,.32,1)}",
    ".td-lift.td-in{opacity:1;transform:none}",

    "@media(prefers-reduced-motion:reduce){",
    "#tdSplash *{animation:none!important;transition:none!important;opacity:1!important;",
    "transform:none!important;filter:none!important}",
    "#tdSplash .td-road i{transform:scaleX(1)!important}",
    "#tdSplash .td-rule{width:min(320px,72vw)!important}",
    "#tdSplash .td-scan,#tdSplash .td-flash,#tdSplash .td-shine,#tdSplash .td-beam,",
    "#tdSplash .td-floor,#tdSplash .td-dust,#tdSplash .td-ring{display:none!important}",
    "#tdSplash.td-out{opacity:0!important;clip-path:none!important;transition:opacity .4s ease!important}",
    ".td-tilt,.td-mag{transition:none!important}.td-sheen::after{animation:none!important}",
    ".td-lift{opacity:1!important;transform:none!important}}"
  ].join("");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------------------------------------------------- splash */
  function buildSplash(){
    var sys = CFG.sys.length ? CFG.sys : [];
    var el = document.createElement("div");
    el.id = "tdSplash";
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", "Loading " + CFG.name + CFG.name2);
    el.innerHTML =
      '<div class="td-dust"></div>' +
      '<div class="td-beam l"></div><div class="td-beam r"></div>' +
      '<div class="td-floor"></div>' +
      '<div class="td-ring"></div><div class="td-ring two"></div>' +
      '<div class="td-flash"></div><div class="td-scan"></div>' +
      '<div class="td-inner">' +
        '<div class="td-mark"><span class="b">' + CFG.name + '</span>' +
          '<span class="c">' + CFG.name2 + '</span>' +
          (CFG.suffix ? '<span class="sa">' + CFG.suffix + '</span>' : '') +
          '<div class="td-shine"></div></div>' +
        '<div class="td-rule"></div>' +
        (CFG.tag ? '<div class="td-tag">' + CFG.tag + '</div>' : '') +
        (sys.length ? '<div class="td-sys">' + sys.map(function(s){
            return '<span><b></b>' + s + '</span>'; }).join('') + '</div>' : '') +
        '<div class="td-load"><div class="td-road"><i></i></div><div class="td-pct">0%</div></div>' +
      '</div>' +
      '<div class="td-vig"></div><div class="td-lines"></div>' +
      '<button class="td-skip" type="button">Skip intro</button>';
    document.body.insertBefore(el, document.body.firstChild);
    return el;
  }

  function runSplash(){
    killLegacyPreloader();
    if(seen) return;
    var el = buildSplash();
    root.classList.add("td-splashing");

    if(!reduce){
      var dust = el.querySelector(".td-dust"), frag = document.createDocumentFragment();
      for(var i = 0; i < 30; i++){
        var d = document.createElement("i");
        var s = 1 + Math.random() * 2.3;
        d.style.cssText = "left:" + (Math.random()*100) + "%;top:" + (55 + Math.random()*45) + "%;" +
          "width:" + s.toFixed(1) + "px;height:" + s.toFixed(1) + "px;" +
          "--dx:" + ((Math.random()-.5)*90).toFixed(0) + "px;--dy:" + (-(120 + Math.random()*300)).toFixed(0) + "px;" +
          "animation-duration:" + (3.4 + Math.random()*3.6).toFixed(2) + "s;" +
          "animation-delay:" + (Math.random()*2.2).toFixed(2) + "s;";
        frag.appendChild(d);
      }
      dust.appendChild(frag);
    }

    var pct = el.querySelector(".td-pct"), done = false;
    if(!reduce){
      var t0 = null, DUR = 1350, START = 1520;
      var run = function(now){
        if(t0 === null) t0 = now;
        var e = now - t0 - START;
        if(e < 0){ requestAnimationFrame(run); return; }
        var p = Math.min(e / DUR, 1);
        pct.textContent = Math.round((1 - Math.pow(1 - p, 2.2)) * 100) + "%";
        if(p < 1 && !done) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    } else { pct.textContent = "100%"; }

    function close(){
      if(done) return; done = true;
      try{ sessionStorage.setItem(CFG.key, "1"); }catch(e){}
      pct.textContent = "100%";
      el.classList.add("td-out");
      root.classList.remove("td-splashing");
      setTimeout(function(){ el.remove(); }, 1000);
    }
    el.querySelector(".td-skip").addEventListener("click", close);
    document.addEventListener("keydown", function(e){ if(e.key === "Escape") close(); });
    setTimeout(close, reduce ? 1500 : CFG.hold);
  }

  /* ---------------------------------------------------------- motion */
  function motion(){
    var isTouch = matchMedia("(hover:none)").matches;

    var bar = document.createElement("div");
    bar.id = "tdProgress";
    document.body.appendChild(bar);
    var ticking = false;
    addEventListener("scroll", function(){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        var h = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = "scaleX(" + (h > 0 ? Math.min(scrollY / h, 1) : 0) + ")";
        ticking = false;
      });
    }, {passive:true});

    if(!reduce && !isTouch){
      document.querySelectorAll("a.btn,button.btn,.btn-primary,.cta,.qs-go,.btn-wa").forEach(function(b){
        b.classList.add("td-mag");
        b.addEventListener("mousemove", function(e){
          var r = b.getBoundingClientRect();
          b.style.transform = "translate(" +
            (((e.clientX - (r.left + r.width/2)) / r.width) * 8).toFixed(2) + "px," +
            (((e.clientY - (r.top + r.height/2)) / r.height) * 6).toFixed(2) + "px)";
        });
        b.addEventListener("mouseleave", function(){ b.style.transform = ""; });
      });

      document.querySelectorAll(".vcard,.card,.stock-card,.why-card,.fc-card,.veh-card").forEach(function(c){
        c.classList.add("td-tilt");
        c.addEventListener("mouseenter", function(){ c.classList.add("td-tilting"); });
        c.addEventListener("mousemove", function(e){
          var r = c.getBoundingClientRect();
          c.style.transform = "perspective(900px) rotateX(" +
            (-(((e.clientY - r.top) / r.height) - .5) * 5).toFixed(2) + "deg) rotateY(" +
            ((((e.clientX - r.left) / r.width) - .5) * 6).toFixed(2) + "deg) translateY(-6px)";
        });
        c.addEventListener("mouseleave", function(){
          c.classList.remove("td-tilting"); c.style.transform = "";
        });
      });
    }

    if(!("IntersectionObserver" in window)) return;
    var obs = new IntersectionObserver(function(en){
      en.forEach(function(x){
        if(x.isIntersecting){ x.target.classList.add("td-in"); obs.unobserve(x.target); }
      });
    }, {threshold:.15, rootMargin:"0px 0px -50px 0px"});

    if(reduce) return;

    /* sheen is additive (::after only) — safe to layer over any host styling */
    document.querySelectorAll(".why-card,.stat,.fc-card").forEach(function(el){
      el.classList.add("td-sheen"); obs.observe(el);
    });

    /* only drive headings ourselves if the host page has no reveal system of
       its own — otherwise two observers fight over opacity/transform */
    if(document.querySelector(".rv, .rv-left, .rv-right")) return;
    document.querySelectorAll("section > .wrap > h2,section > .wrap > .sec-head").forEach(function(el, i){
      el.classList.add("td-lift");
      el.style.transitionDelay = ((i % 5) * 60) + "ms";
      obs.observe(el);
    });
  }

  function boot(){ runSplash(); motion(); }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
