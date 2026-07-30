/* Halstead Motor Co. — Motion layer: magnetic buttons + 3D press.
   Desktop (pointer:fine) only — magnetism is meaningless under a thumb, and
   touch devices get the CSS :active press states instead. One shared rAF loop,
   transforms only, so nothing here can trigger layout. */
(function(){
  if(!window.matchMedia("(pointer:fine)").matches) return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var SEL = [
    // Kept deliberately short. Magnetism on every button, nav item and
    // footer link made the whole page feel restless; it now marks the two
    // primary CTAs and the floating rail only.
    ".hero-ctas .btn",
    ".sp-go",
    ".fab-btn"
  ].join(",");

  var FIELD = 90;       // px — how far the pull reaches beyond the element
  var STRENGTH = .38;   // how hard it pulls (0..1)
  var LIFT = 10;        // deg — 3D tilt at the element's edge

  var actives = new Map();   // el -> {mx,my,tilt:[rx,ry]}
  var raf = 0;

  function tick(){
    raf = 0;
    actives.forEach(function(s, btn){
      btn.style.transform =
        "translate(" + s.x.toFixed(1) + "px," + s.y.toFixed(1) + "px)" +
        " perspective(500px) rotateX(" + s.rx.toFixed(2) + "deg) rotateY(" + s.ry.toFixed(2) + "deg)" +
        (s.scale !== 1 ? " scale(" + s.scale + ")" : "");
    });
  }
  function queue(){ if(!raf) raf = requestAnimationFrame(tick); }

  // Cache targets — querySelectorAll per pointermove would be wasteful. The
  // showroom grid re-renders on filter/DMS load, so refresh on its mutations.
  var targets = [];
  function collect(){ targets = Array.prototype.slice.call(document.querySelectorAll(SEL)); }
  collect();
  var grid = document.getElementById("invgrid");
  if(grid) new MutationObserver(collect).observe(grid, {childList:true});
  document.addEventListener("DOMContentLoaded", collect);

  document.addEventListener("pointermove", function(e){
    targets.forEach(function(btn){
      var r = btn.getBoundingClientRect();
      if(!r.width) return;
      var cx = r.left + r.width/2, cy = r.top + r.height/2;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var reachX = r.width/2 + FIELD, reachY = r.height/2 + FIELD;
      if(Math.abs(dx) < reachX && Math.abs(dy) < reachY){
        var nx = dx / reachX, ny = dy / reachY;           // -1..1
        var fall = 1 - Math.max(Math.abs(nx), Math.abs(ny));   // edge falloff
        var f = STRENGTH * (0.35 + 0.65 * fall);
        actives.set(btn, {
          x: dx * f, y: dy * f,
          ry: nx * LIFT * fall + nx * 2,
          rx: -ny * LIFT * fall - ny * 2,
          scale: 1 + 0.03 * fall
        });
        btn.classList.add("is-magnet");
      }else if(actives.has(btn)){
        actives.set(btn, {x:0,y:0,rx:0,ry:0,scale:1});
        // release: let it spring home, then stop driving it
        (function(b){
          setTimeout(function(){
            if(actives.get(b) && actives.get(b).x === 0){
              actives.delete(b);
              b.style.transform = "";
              b.classList.remove("is-magnet");
            }
          }, 260);
        })(btn);
      }
    });
    queue();
  }, {passive:true});

  // spring-back curve while magnetised (CSS transition would fight rAF writes
  // mid-field, so it's only applied on release via the class)
  var st = document.createElement("style");
  st.textContent =
    ".is-magnet{transition:none !important;will-change:transform;}" +
    SEL.split(",").map(function(s){return s+"{transition:transform .45s cubic-bezier(.34,1.56,.64,1);}";}).join("");
  document.head.appendChild(st);
})();
