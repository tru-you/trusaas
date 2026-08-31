/* ============================================================
   TRUECAR SA — TruSaaS TruOrbit mock player
   Same interaction model as TruLens /embed/web3d-viewer.html:
   orbit frames · drag scrub · play · damage tags by azimuth.
   Uses mock frames (SVG turntable) or gallery photos when present.
   ============================================================ */
(function () {
  window.TCSA = window.TCSA || {};

  const COLOURS = {
    "Kings Red": "#c62828",
    "Lapiz Blue": "#1f5fd0",
    "Surf Blue": "#2f8fd0",
    "Coral Pink": "#e06a8a",
    "Arctic White": "#e6ebf1",
    "Nebula Blue": "#2b4a8a",
    "Graphite Grey": "#5a6675",
    "Reflex Silver": "#b3bdc8",
    "Candy White": "#e6ebf1",
    "Sedona Orange": "#e07b3a",
    "Attitude Black": "#2a313b",
    "Platinum White": "#e6ebf1",
    "Obsidian Black": "#242a33",
    "GT Silver": "#c3cad2",
    "Santorini Black": "#262b33",
    "São Paulo Yellow": "#f2c200",
    Black: "#1a1f28",
    White: "#e8eef5",
    Silver: "#b8c0cc",
    Grey: "#6b7280",
    Blue: "#2563eb",
    Red: "#dc2626",
  };

  function carSVG(kind, colour) {
    const c = colour || "#3a72d6";
    const dk = "#12326e";
    const gl = "#c7ddf7";
    if (kind === "side")
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 230" width="600" height="230">
      <ellipse cx="300" cy="206" rx="255" ry="13" fill="#0a1420" opacity=".25"/>
      <path d="M36 168 C36 150 58 143 84 140 L150 118 C168 96 210 78 300 78 C372 78 430 84 470 108 C500 118 540 128 556 140 C566 148 566 160 560 172 L556 184 C556 190 550 194 542 194 L54 194 C44 194 36 186 36 176 Z" fill="${c}"/>
      <path d="M172 116 C196 96 236 88 300 88 C356 88 402 96 436 116 L300 130 L182 130 Z" fill="${gl}" opacity=".92"/>
      <path d="M300 88 L300 130 M388 92 L406 130" stroke="${dk}" stroke-width="2" opacity=".45"/>
      <path d="M60 180 L548 180" stroke="#fff" stroke-width="2" opacity=".35"/>
      <rect x="544" y="146" width="14" height="20" rx="4" fill="#fff2c4"/><rect x="38" y="150" width="10" height="16" rx="3" fill="#ff7a7a"/>
      <circle cx="176" cy="196" r="42" fill="#0e1826"/><circle cx="176" cy="196" r="42" fill="none" stroke="#8fa8c9" stroke-width="3"/><circle cx="176" cy="196" r="17" fill="#3a4f6d"/>
      <circle cx="430" cy="196" r="42" fill="#0e1826"/><circle cx="430" cy="196" r="42" fill="none" stroke="#8fa8c9" stroke-width="3"/><circle cx="430" cy="196" r="17" fill="#3a4f6d"/>
    </svg>`;
    if (kind === "front")
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 230" width="440" height="230">
      <ellipse cx="220" cy="208" rx="190" ry="12" fill="#0a1420" opacity=".25"/>
      <path d="M70 176 C70 146 86 112 116 100 C140 84 164 78 220 78 C276 78 300 84 324 100 C354 112 370 146 370 176 L370 188 C370 195 364 198 356 198 L84 198 C76 198 70 192 70 184 Z" fill="${c}"/>
      <path d="M120 104 C142 88 166 84 220 84 C274 84 298 88 320 104 L306 138 L134 138 Z" fill="${gl}" opacity=".9"/>
      <rect x="160" y="150" width="120" height="18" rx="5" fill="#0e1826" opacity=".55"/>
      <rect x="82" y="146" width="46" height="20" rx="7" fill="#fff2c4"/><rect x="312" y="146" width="46" height="20" rx="7" fill="#fff2c4"/>
      <circle cx="120" cy="198" r="28" fill="#0e1826"/><circle cx="120" cy="198" r="28" fill="none" stroke="#8fa8c9" stroke-width="3"/>
      <circle cx="320" cy="198" r="28" fill="#0e1826"/><circle cx="320" cy="198" r="28" fill="none" stroke="#8fa8c9" stroke-width="3"/>
    </svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 230" width="440" height="230">
      <ellipse cx="220" cy="208" rx="190" ry="12" fill="#0a1420" opacity=".25"/>
      <path d="M70 176 C70 150 86 120 116 108 C140 92 164 86 220 86 C276 86 300 92 324 108 C354 120 370 150 370 176 L370 188 C370 195 364 198 356 198 L84 198 C76 198 70 192 70 184 Z" fill="${c}"/>
      <path d="M126 112 C146 98 168 94 220 94 C272 94 294 98 314 112 L304 140 L136 140 Z" fill="${gl}" opacity=".8"/>
      <rect x="90" y="148" width="52" height="18" rx="5" fill="#ff7a7a"/><rect x="298" y="148" width="52" height="18" rx="5" fill="#ff7a7a"/>
      <circle cx="120" cy="198" r="28" fill="#0e1826"/><circle cx="320" cy="198" r="28" fill="#0e1826"/>
    </svg>`;
  }

  function svgDataUri(svg, flip) {
    const wrapped = flip
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 230" width="600" height="230"><g transform="translate(600,0) scale(-1,1)">${svg.replace(/<\/?svg[^>]*>/g, "")}</g></svg>`
      : svg;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(wrapped);
  }

  /** Build a TruLens-shaped package for demos */
  TCSA.buildMockWeb3DPackage = function (v) {
    const paint = COLOURS[v.colour] || COLOURS[v.color] || "#3a72d6";
    const gallery = (v.gallery && v.gallery.length ? v.gallery : v.img ? [v.img] : []).filter(Boolean);
    const frames = [];
    const N = gallery.length >= 6 ? Math.min(gallery.length, 24) : 12;

    if (gallery.length >= 4) {
      for (let i = 0; i < N; i++) {
        frames.push({
          azimuth: i / N,
          image: gallery[i % gallery.length],
          slot: "orbit_" + i,
        });
      }
    } else {
      // Synthetic turntable: side → front → side-flip → rear
      const sequence = [
        { kind: "side", flip: false },
        { kind: "side", flip: false },
        { kind: "front", flip: false },
        { kind: "front", flip: false },
        { kind: "side", flip: true },
        { kind: "side", flip: true },
        { kind: "rear", flip: false },
        { kind: "rear", flip: false },
        { kind: "side", flip: false },
        { kind: "side", flip: false },
        { kind: "front", flip: false },
        { kind: "rear", flip: false },
      ];
      sequence.forEach(function (s, i) {
        frames.push({
          azimuth: i / sequence.length,
          image: svgDataUri(carSVG(s.kind, paint), s.flip),
          slot: s.kind + "_" + i,
        });
      });
    }

    const vir = Number(v.vir) || 92;
    const tags =
      vir >= 96
        ? [
            { label: "Windscreen stone chip — 5 mm, repairable", severity: "info", azimuth: 0.08, elevation: 0.22 },
            { label: "Tyres ~70% tread · Michelin", severity: "info", azimuth: 0.72, elevation: 0.78 },
          ]
        : vir >= 93
          ? [
              { label: "Front bumper scuff — light, buffs out", severity: "attention", azimuth: 0.12, elevation: 0.55 },
              { label: "Rear alloy kerb rash — cosmetic", severity: "attention", azimuth: 0.62, elevation: 0.72 },
              { label: "Full service history verified", severity: "info", azimuth: 0.35, elevation: 0.35 },
            ]
          : [
              { label: "Front-left scuff — quoted R850 respray", severity: "attention", azimuth: 0.15, elevation: 0.58 },
              { label: "Windscreen chip — top corner", severity: "critical", azimuth: 0.05, elevation: 0.2 },
              { label: "Rear alloy kerb mark", severity: "attention", azimuth: 0.68, elevation: 0.75 },
              { label: "No structural accident damage", severity: "info", azimuth: 0.4, elevation: 0.4 },
            ];

    return {
      stockNumber: v.stockNumber || v.id || "DEMO",
      background: gallery.length >= 4 ? "photo-orbit" : "studio-mock",
      mock: true,
      vehicle: {
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.variant || "",
        colour: v.colour || "",
      },
      frames: frames,
      damageTags: tags,
      video: null,
    };
  };

  function severityClass(s) {
    return s === "critical" ? "critical" : s === "attention" ? "attention" : "info";
  }

  /**
   * Mount TruOrbit player into container (replaces 360 spin).
   * pkg: TruLens package or omit to build mock from vehicle.
   */
  TCSA.mountWeb3D = function (container, pkgOrVehicle) {
    if (!container) return;
    const pkg =
      pkgOrVehicle && pkgOrVehicle.frames
        ? pkgOrVehicle
        : TCSA.buildMockWeb3DPackage(pkgOrVehicle || {});

    const frames = pkg.frames || [];
    let idx = 0;
    let playing = false;
    let playTimer = null;
    let dragX = null;

    container.innerHTML = `
      <div class="w3d-root">
        <div class="w3d-stage" id="w3dStage">
          <div class="w3d-floor"></div>
          <img class="w3d-media" id="w3dMedia" alt="TruOrbit spin" draggable="false" />
          <div class="w3d-tags" id="w3dTags"></div>
          <div class="w3d-pop" id="w3dPop"></div>
          <div class="w3d-badge">TruOrbit</div>
          <div class="w3d-hint" id="w3dHint">Drag to orbit · tap pins for damage</div>
          ${pkg.mock ? '<div class="w3d-mockpill">TruOrbit mock package</div>' : ""}
        </div>
        <div class="w3d-controls">
          <button type="button" id="w3dPrev" aria-label="Previous">‹</button>
          <button type="button" class="w3d-play" id="w3dPlay">Play</button>
          <div class="w3d-scrub">
            <input id="w3dScrub" type="range" min="0" max="${Math.max(frames.length - 1, 0)}" value="0" step="1" />
          </div>
          <button type="button" id="w3dNext" aria-label="Next">›</button>
        </div>
        <div class="w3d-meta">
          <span><strong>${pkg.vehicle.year || ""} ${pkg.vehicle.make || ""} ${pkg.vehicle.model || ""}</strong> · ${pkg.stockNumber}</span>
          <span id="w3dFrameMeta">Frame 1 / ${frames.length}</span>
        </div>
        <div class="w3d-legend">
          <span><i class="info"></i>Info</span>
          <span><i class="attention"></i>Attention</span>
          <span><i class="critical"></i>Critical</span>
          <span>${(pkg.damageTags || []).length} tags · ${frames.length} frames${pkg.mock ? " · mock" : ""}</span>
        </div>
      </div>
    `;

    const stage = container.querySelector("#w3dStage");
    const media = container.querySelector("#w3dMedia");
    const scrub = container.querySelector("#w3dScrub");
    const tagsEl = container.querySelector("#w3dTags");
    const pop = container.querySelector("#w3dPop");
    const playBtn = container.querySelector("#w3dPlay");
    const hint = container.querySelector("#w3dHint");
    const frameMeta = container.querySelector("#w3dFrameMeta");

    function stopPlay() {
      playing = false;
      playBtn.classList.remove("on");
      playBtn.textContent = "Play";
      if (playTimer) clearInterval(playTimer);
      playTimer = null;
    }

    function showFrame(i, instant) {
      if (!frames.length) return;
      idx = ((i % frames.length) + frames.length) % frames.length;
      scrub.value = String(idx);
      if (!instant) media.classList.add("fading");
      const apply = function () {
        media.src = frames[idx].image;
        media.classList.remove("fading");
      };
      if (instant) apply();
      else setTimeout(apply, 45);

      const az = frames[idx].azimuth;
      tagsEl.innerHTML = "";
      (pkg.damageTags || []).forEach(function (t) {
        const d = Math.min(Math.abs(t.azimuth - az), 1 - Math.abs(t.azimuth - az));
        if (d > 0.14) return;
        const el = document.createElement("button");
        el.type = "button";
        el.className = "w3d-tag " + severityClass(t.severity);
        el.style.left = 18 + t.azimuth * 64 + "%";
        el.style.top = 22 + (t.elevation || 0.4) * 52 + "%";
        el.title = t.label;
        el.onclick = function (ev) {
          ev.stopPropagation();
          tagsEl.querySelectorAll(".w3d-tag").forEach(function (x) {
            x.classList.remove("active");
          });
          el.classList.add("active");
          pop.className = "w3d-pop on";
          const left = Math.min(Math.max(el.offsetLeft, 90), stage.clientWidth - 100);
          const top = Math.min(Math.max(el.offsetTop + 18, 40), stage.clientHeight - 80);
          pop.style.left = left + "px";
          pop.style.top = top + "px";
          pop.innerHTML =
            '<div class="sev ' +
            severityClass(t.severity) +
            '">' +
            (t.severity || "info") +
            "</div><b>Damage / note</b><div class=\"label\">" +
            t.label +
            "</div>";
          hint.style.display = "none";
        };
        tagsEl.appendChild(el);
      });
      frameMeta.textContent = "Frame " + (idx + 1) + " / " + frames.length + " · " + (pkg.background || "orbit");
    }

    container.querySelector("#w3dPrev").onclick = function () {
      stopPlay();
      showFrame(idx - 1);
    };
    container.querySelector("#w3dNext").onclick = function () {
      stopPlay();
      showFrame(idx + 1);
    };
    scrub.oninput = function () {
      stopPlay();
      showFrame(Number(scrub.value), true);
    };
    playBtn.onclick = function () {
      if (playing) {
        stopPlay();
        return;
      }
      if (!frames.length) return;
      playing = true;
      playBtn.classList.add("on");
      playBtn.textContent = "Pause";
      playTimer = setInterval(function () {
        showFrame(idx + 1, true);
      }, 360);
    };

    stage.addEventListener("pointerdown", function (e) {
      if (e.target.classList && e.target.classList.contains("w3d-tag")) return;
      stage.setPointerCapture(e.pointerId);
      dragX = e.clientX;
      stage.classList.add("dragging");
      stopPlay();
      pop.className = "w3d-pop";
    });
    stage.addEventListener("pointermove", function (e) {
      if (dragX == null || !frames.length) return;
      const dx = e.clientX - dragX;
      if (Math.abs(dx) > 16) {
        showFrame(idx + (dx > 0 ? -1 : 1), true);
        dragX = e.clientX;
        hint.style.display = "none";
      }
    });
    stage.addEventListener("pointerup", function () {
      dragX = null;
      stage.classList.remove("dragging");
    });
    stage.addEventListener("click", function (e) {
      if (e.target.classList && e.target.classList.contains("w3d-tag")) return;
      pop.className = "w3d-pop";
    });

    media.onload = function () {
      container.classList.add("w3d-loaded");
    };
    if (frames.length) showFrame(0, true);
    else container.innerHTML = '<div class="w3d-err">No TruOrbit frames in package</div>';

    return { showFrame: showFrame, package: pkg };
  };

  /** Local Honda orbit frames shipped with the site (real 360 stills) */
  TCSA.buildHondaOrbitPackage = function (vehicle) {
    const v = vehicle || {};
    const frames = [];
    for (let i = 1; i <= 36; i++) {
      frames.push({
        azimuth: (i - 1) / 36,
        image: "assets/img/360-honda/slide-" + i + ".webp",
        slot: "honda_" + i,
      });
    }
    return {
      stockNumber: v.stockNumber || v.id || "TRU3D-HOME",
      background: "photo-orbit",
      mock: false,
      vehicle: {
        year: v.year || 2022,
        make: v.make || "Honda",
        model: v.model || "Civic",
        trim: v.variant || "TruOrbit demo orbit",
        colour: v.colour || "",
      },
      frames: frames,
      damageTags: [
        { label: "Front bumper scuff — light, buffs out", severity: "attention", azimuth: 0.12, elevation: 0.55 },
        { label: "Full service history verified", severity: "info", azimuth: 0.35, elevation: 0.35 },
        { label: "Rear alloy kerb rash — cosmetic", severity: "attention", azimuth: 0.62, elevation: 0.72 },
        { label: "Tyres ~70% tread · Michelin", severity: "info", azimuth: 0.72, elevation: 0.78 },
      ],
      video: null,
    };
  };

  function fetchWithTimeout(url, ms) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, ms || 2800);
    return fetch(url, { cache: "no-store", mode: "cors", signal: ctrl ? ctrl.signal : undefined }).finally(function () {
      clearTimeout(t);
    });
  }

  /** Try live TruLens package, else Honda orbit, else SVG mock */
  TCSA.loadWeb3DForVehicle = async function (container, vehicle, opts) {
    opts = opts || {};
    const stock = vehicle && (vehicle.stockNumber || vehicle.id);
    const preferLocal = opts.preferLocalOrbit !== false; /* homepage defaults to shipped frames */

    /* Homepage / demos: always show real orbit immediately, then optionally upgrade */
    if (opts.useHondaOrbit || (preferLocal && opts.homeDemo)) {
      TCSA.mountWeb3D(container, TCSA.buildHondaOrbitPackage(vehicle));
    }

    if (stock && !opts.skipLive) {
      const apis = [
        "https://lens.tru-saas.com/api/public/web3d/" + encodeURIComponent(stock || ""),
      ];
      for (let i = 0; i < apis.length; i++) {
        try {
          const res = await fetchWithTimeout(apis[i], opts.timeoutMs || 2800);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.package && data.package.frames && data.package.frames.length) {
            return TCSA.mountWeb3D(container, data.package);
          }
        } catch (e) {
          /* timeout / CORS / cold start — keep local */
        }
      }
    }

    /* If we already mounted Honda, leave it */
    if (container.querySelector(".w3d-root")) return null;

    if (opts.useHondaOrbit !== false) {
      return TCSA.mountWeb3D(container, TCSA.buildHondaOrbitPackage(vehicle));
    }
    return TCSA.mountWeb3D(container, TCSA.buildMockWeb3DPackage(vehicle || {}));
  };
})();
