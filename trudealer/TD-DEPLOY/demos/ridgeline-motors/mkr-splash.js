/* Ridgeline Motors — 3D WebGL splash intro.
   Three.js rotating shield emblem with orbiting torus rings, particles,
   HUD frame, GSAP entrance. Once per session via sessionStorage. */
(function(){
  try{ if(sessionStorage.getItem("mkrSplashSeen")) return; }catch(e){}
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try{
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if(conn && (conn.saveData || /(^|-)(2g|slow-2g)$/.test(conn.effectiveType||""))) return;
  }catch(e){}
  if(typeof THREE === "undefined" || typeof gsap === "undefined") return;

  var el = document.createElement("div");
  el.className = "mkr-splash";
  el.setAttribute("role","dialog");
  el.setAttribute("aria-label","Ridgeline Motors intro");
  el.innerHTML =
    '<canvas id="mkrSpl3d"></canvas>'
    +'<div class="mkr-splash-vignette" aria-hidden="true"></div>'
    +'<div class="mkr-splash-grid" aria-hidden="true"></div>'
    +'<div class="mkr-splash-hud" aria-hidden="true">'
      +'<div class="mkr-splash-ht tl"><span class="mkr-splash-dot"></span> RIDGELINE MOTORS</div>'
      +'<div class="mkr-splash-ht tr">3D STAGE</div>'
      +'<div class="mkr-splash-ht bl">PREMIUM PRE-OWNED</div>'
      +'<div class="mkr-splash-ht br">DRAG TO ROTATE</div>'
    +'</div>'
    +'<main class="mkr-splash-viewport">'
      +'<header class="mkr-splash-head" id="mkrSplHead">'
        +'<h1 class="mkr-splash-title"><span class="rl">Ridgeline</span> <span class="mt">Motors</span></h1>'
        +'<div class="mkr-splash-sub">Premium Pre-Owned</div>'
      +'</header>'
      +'<div class="mkr-splash-cta" id="mkrSplCta">'
        +'<button class="mkr-splash-enter" id="mkrSplEnter">Enter Showroom'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'
      +'</div>'
    +'</main>';

  var done = false;

  function mount(){
    document.body.appendChild(el);
    document.body.style.overflow = "hidden";

    var canvas = el.querySelector("#mkrSpl3d");
    var W = window.innerWidth, H = window.innerHeight;

    /* ── Three.js scene ── */
    var renderer = new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true});
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
    camera.position.z = 13;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var orangeLight = new THREE.PointLight(0xff6d00, 3.5, 40);
    orangeLight.position.set(5, 5, 5);
    scene.add(orangeLight);
    var whiteLight = new THREE.PointLight(0xffffff, 2.5, 40);
    whiteLight.position.set(-5, -5, -2);
    scene.add(whiteLight);

    var group = new THREE.Group();
    scene.add(group);

    /* orbiting rings */
    var r1 = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.035, 16, 100),
      new THREE.MeshStandardMaterial({color:0xff6d00, emissive:0xff3d00, emissiveIntensity:0.8, roughness:0.2})
    );
    r1.rotation.x = Math.PI/3;
    group.add(r1);

    var r2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.0, 0.02, 16, 100),
      new THREE.MeshBasicMaterial({color:0xff6d00, wireframe:true, transparent:true, opacity:0.35})
    );
    r2.rotation.y = Math.PI/4;
    group.add(r2);

    /* shield emblem */
    var shape = new THREE.Shape();
    shape.moveTo(0, 2);
    shape.lineTo(-1.8, 0.5);
    shape.lineTo(-1.2, -1.8);
    shape.lineTo(0, -2.5);
    shape.lineTo(1.2, -1.8);
    shape.lineTo(1.8, 0.5);
    shape.closePath();

    var geo = new THREE.ExtrudeGeometry(shape, {depth:0.4, bevelEnabled:true, bevelSegments:5, steps:2, bevelSize:0.1, bevelThickness:0.1});
    geo.center();

    var chromeMat = new THREE.MeshStandardMaterial({color:0x1e293b, roughness:0.1, metalness:0.95});
    var orangeMat = new THREE.MeshStandardMaterial({color:0xff6d00, emissive:0xff3d00, emissiveIntensity:0.4, roughness:0.15, metalness:0.5});
    group.add(new THREE.Mesh(geo, [chromeMat, orangeMat]));
    group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0xff6d00, wireframe:true, transparent:true, opacity:0.35})));

    /* particles */
    var pGeo = new THREE.BufferGeometry();
    var pos = new Float32Array(200*3);
    for(var i=0;i<600;i+=3){ pos[i]=(Math.random()-.5)*30; pos[i+1]=(Math.random()-.5)*30; pos[i+2]=(Math.random()-.5)*30; }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({size:0.045, color:0xff6d00, transparent:true, opacity:0.5}));
    scene.add(particles);

    /* drag interaction */
    var dragging=false, prev={x:0,y:0}, vel={x:0,y:0};
    el.addEventListener("pointerdown",function(e){ dragging=true; prev={x:e.clientX,y:e.clientY}; });
    el.addEventListener("pointermove",function(e){
      if(!dragging) return;
      vel.x=(e.clientX-prev.x)*0.005; vel.y=(e.clientY-prev.y)*0.005;
      group.rotation.y+=vel.x; group.rotation.x+=vel.y;
      prev={x:e.clientX,y:e.clientY};
    });
    el.addEventListener("pointerup",function(){ dragging=false; });

    var clock = new THREE.Clock();
    var raf;
    function animate(){
      if(done) return;
      raf = requestAnimationFrame(animate);
      var t = clock.getElapsedTime();
      if(!dragging){
        vel.x*=0.95; vel.y*=0.95;
        group.rotation.y += vel.x + 0.012;
        group.rotation.x += vel.y;
      }
      r1.rotation.z = t*0.2;
      r2.rotation.z = -t*0.15;
      group.position.y = Math.sin(t*0.8)*0.25;
      particles.rotation.y = t*0.015;
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", function onResize(){
      if(done){ window.removeEventListener("resize",onResize); return; }
      var w=window.innerWidth, h=window.innerHeight;
      camera.aspect=w/h; camera.updateProjectionMatrix();
      renderer.setSize(w,h);
    });

    /* GSAP entrance */
    gsap.timeline({defaults:{ease:"power3.out"}})
      .to("#mkrSplHead",{opacity:1,y:0,duration:1,delay:0.3})
      .to("#mkrSplCta",{opacity:1,y:0,duration:0.8},"-=0.5");

    /* dismiss */
    function dismiss(){
      if(done) return;
      done = true;
      if(raf) cancelAnimationFrame(raf);
      try{ sessionStorage.setItem("mkrSplashSeen","1"); }catch(e){}
      el.classList.add("out");
      document.body.style.overflow = "";
      setTimeout(function(){
        renderer.dispose(); scene.clear();
        el.remove();
      }, 900);
    }

    el.querySelector("#mkrSplEnter").addEventListener("click", dismiss);
    setTimeout(dismiss, 13000);
  }

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
