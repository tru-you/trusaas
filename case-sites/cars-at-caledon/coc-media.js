/* Caledon Media — real 360 frame-spin and walkaround video in the vehicle modal.
 *
 * The stage that ships in vd-upgrade.js is a mirrored-image illusion: there is
 * no real 360 and no video. This wraps openVehicleDetail and, when the DMS has
 * actually sent media, adds a Photos / 360° / Video switcher over the stage.
 *
 * DMS fields consumed (mapped through in mkr-shared.js mapApi):
 *   spin          array of frame URLs, in rotation order (any count; 24–72 typical)
 *   video         mp4/webm URL, or a YouTube / Vimeo link
 *   videoPoster   still to show before playback
 *
 * With none of those present nothing changes — the existing stage stays exactly
 * as it is, so mock stock and thin feeds still look right.
 */
(function () {
  "use strict";

  function mediaOf(car) {
    if (!car) return { spin: [], video: "", poster: "", tags: [] };
    var spin = car.spin || car.spinImages || car.images360 || car.spin360 || car.threeSixty || [];
    if (typeof spin === "string") spin = spin.split(/[,\s]+/).filter(Boolean);
    if (!Array.isArray(spin)) spin = [];
    return {
      spin: spin.filter(Boolean),
      video: car.video || car.videoUrl || car.walkaroundVideo || "",
      poster: car.videoPoster || car.img || "",
      tags: normaliseTags(car.tags || car.damage || car.damageTags || car.findings || [], spin.length)
    };
  }

  /* Inspection findings pinned to the walkaround. Each tag needs a position on
     the car (x/y as 0–1 of the frame) and which frame it's visible on — the app
     may give a frame index or an angle in degrees. Anything without a usable
     position is dropped rather than guessed at. */
  function normaliseTags(list, frameCount) {
    if (!Array.isArray(list) || !frameCount) return [];
    return list.map(function (t) {
      var frame = t.frame != null ? Number(t.frame)
        : (t.angle != null ? Math.round(Number(t.angle) / 360 * frameCount) : null);
      var x = t.x != null ? Number(t.x) : null;
      var y = t.y != null ? Number(t.y) : null;
      if (frame == null || x == null || y == null || isNaN(frame) || isNaN(x) || isNaN(y)) return null;
      var sev = String(t.severity || t.grade || "note").toLowerCase();
      return {
        frame: ((frame % frameCount) + frameCount) % frameCount,
        x: x > 1 ? x / 100 : x,               // accept 0–1 or percentages
        y: y > 1 ? y / 100 : y,
        label: t.label || t.title || t.type || "Noted",
        note: t.note || t.description || "",
        photo: t.photo || t.image || "",
        sev: /major|severe|high/.test(sev) ? "major" : /minor|low|cosmetic/.test(sev) ? "minor" : "note"
      };
    }).filter(Boolean);
  }

  /* ---------- video source handling ---------- */
  function embedUrl(url) {
    var yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
    if (yt) return "https://www.youtube-nocookie.com/embed/" + yt[1] + "?rel=0&playsinline=1&autoplay=1";
    var vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
    if (vm) return "https://player.vimeo.com/video/" + vm[1] + "?autoplay=1";
    return null; // treat as a direct file
  }

  /* ---------- 360 spin ---------- */
  function buildSpin(panel, frames, tags) {
    var imgs = [];
    var loaded = 0, cur = 0, ready = false;
    tags = tags || [];

    var wrap = document.createElement("div");
    wrap.className = "vd-spin";
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", "360 degree view — drag to rotate");
    wrap.tabIndex = 0;

    var load = document.createElement("div");
    load.className = "vd-spin-load";
    load.innerHTML = '<div class="bar"><i></i></div><span>Loading 360 — 0%</span>';
    var bar = load.querySelector("i"), lbl = load.querySelector("span");

    frames.forEach(function (src, i) {
      var im = new Image();
      im.alt = "";
      im.decoding = "async";
      if (i === 0) im.className = "on";
      im.addEventListener("load", tick);
      im.addEventListener("error", tick);
      im.src = src;
      imgs.push(im);
      wrap.appendChild(im);
    });

    function tick() {
      loaded++;
      var pct = Math.round(loaded / frames.length * 100);
      bar.style.width = pct + "%";
      lbl.textContent = "Loading 360 — " + pct + "%";
      if (loaded >= frames.length) {
        ready = true;
        load.remove();
        autoSpin();
      }
    }

    function show(i) {
      cur = ((i % frames.length) + frames.length) % frames.length;
      imgs.forEach(function (im, n) { im.classList.toggle("on", n === cur); });
      var deg = Math.round(cur / frames.length * 360);
      var degEl = panel.querySelector(".vd-spin-deg");
      if (degEl) degEl.textContent = deg + "°";
      paintTags();
    }

    /* Tags are anchored to a frame, so they appear as that part of the car comes
       round and fade as it turns away — the shortest way round the circle. */
    var tagLayer = null, tagsOn = true, WINDOW = 2;
    function paintTags() {
      var layer = tagLayer || wrap.querySelector(".vd-spin-tags");
      if (!layer) return;
      // Read the live frame off the DOM rather than trusting a captured
      // variable — the pins must never disagree with the image on screen.
      var shown = Array.prototype.findIndex.call(wrap.querySelectorAll("img"), function (im) {
        return im.classList.contains("on");
      });
      if (shown < 0) shown = cur;
      Array.prototype.forEach.call(layer.children, function (el, n) {
        var t = tags[n];
        if (!t) return;
        var d = Math.abs(t.frame - shown);
        d = Math.min(d, frames.length - d);
        var visible = tagsOn && d <= WINDOW;
        el.style.opacity = visible ? String(1 - d / (WINDOW + 1)) : "0";
        el.style.pointerEvents = visible && d === 0 ? "auto" : "none";
      });
    }

    // One slow revolution on open so it reads as a 360 without being touched.
    function autoSpin() {
      if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
      var n = 0;
      var t = setInterval(function () {
        if (dragged) { clearInterval(t); return; }
        show(cur + 1);
        if (++n >= frames.length) clearInterval(t);
      }, 45);
    }

    var dragging = false, lastX = 0, acc = 0, dragged = false;
    var STEP = 6; // px of drag per frame

    wrap.addEventListener("pointerdown", function (e) {
      if (!ready) return;
      dragging = true; dragged = true; lastX = e.clientX; acc = 0;
      wrap.classList.add("grabbing");
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      acc += e.clientX - lastX;
      lastX = e.clientX;
      while (Math.abs(acc) >= STEP) {
        show(cur + (acc > 0 ? 1 : -1));
        acc += acc > 0 ? -STEP : STEP;
      }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      wrap.addEventListener(ev, function () { dragging = false; wrap.classList.remove("grabbing"); });
    });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { dragged = true; show(cur + 1); }
      if (e.key === "ArrowLeft") { dragged = true; show(cur - 1); }
    });

    var scrub = document.createElement("div");
    scrub.className = "vd-spin-scrub";
    scrub.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.5 20A9 9 0 1 0 4 10l-3 0"/></svg>'
      + "Drag to spin &middot; " + frames.length + " frames &middot; <b class=\"vd-spin-deg\">0&deg;</b>";

    panel.appendChild(wrap);

    /* ----- inspection tag layer ----- */
    if (tags.length) {
      tagLayer = document.createElement("div");
      tagLayer.className = "vd-spin-tags";
      tags.forEach(function (t, n) {
        var pin = document.createElement("button");
        pin.type = "button";
        pin.className = "vd-spin-pin " + t.sev;
        pin.style.left = (t.x * 100) + "%";
        pin.style.top = (t.y * 100) + "%";
        pin.setAttribute("aria-label", t.label + (t.note ? " — " + t.note : ""));
        pin.innerHTML = '<span class="dot"></span>'
          + '<span class="card"><b>' + t.label + "</b>"
          + (t.note ? "<span>" + t.note + "</span>" : "")
          + (t.photo ? '<img src="' + t.photo + '" alt="">' : "")
          + "</span>";
        pin.addEventListener("click", function (e) {
          e.stopPropagation();
          Array.prototype.forEach.call(tagLayer.children, function (o) {
            if (o !== pin) o.classList.remove("open");
          });
          pin.classList.toggle("open");
        });
        tagLayer.appendChild(pin);
      });
      wrap.appendChild(tagLayer);

      // Repaint off a light poll rather than the spin's call path. Calling
      // paintTags() from show() proved unreliable here — the pins would stick
      // on whichever frame was current when they were built — so this reads the
      // DOM on a timer and self-corrects no matter what moved the frame. It
      // stops as soon as the panel leaves the document.
      var last = "";
      var poll = setInterval(function () {
        if (!document.body.contains(wrap)) { clearInterval(poll); return; }
        var shown = Array.prototype.findIndex.call(wrap.querySelectorAll("img"), function (im) {
          return im.classList.contains("on");
        });
        // Composite key: the frame AND whether tags are switched on, so the
        // toggle takes effect at once rather than on the next rotation.
        var key = shown + "|" + (tagsOn ? 1 : 0);
        if (key !== last) { last = key; paintTags(); }
      }, 120);

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "vd-spin-tagbtn on";
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>'
        + '<span>' + tags.length + " inspection tag" + (tags.length === 1 ? "" : "s") + "</span>";
      toggle.addEventListener("click", function () {
        tagsOn = !tagsOn;
        toggle.classList.toggle("on", tagsOn);
        if (!tagsOn) Array.prototype.forEach.call(tagLayer.children, function (o) { o.classList.remove("open"); });
        paintTags();
      });
      panel.appendChild(toggle);
      paintTags();
    }

    panel.appendChild(load);
    panel.appendChild(scrub);
    return { show: show };
  }

  /* ---------- video ---------- */
  function buildVideo(panel, url, poster) {
    var box = document.createElement("div");
    box.className = "vd-video";

    var play = document.createElement("button");
    play.type = "button";
    play.className = "vd-video-play";
    play.setAttribute("aria-label", "Play walkaround video");
    if (poster) play.style.backgroundImage = "url('" + poster + "')";
    play.innerHTML = '<span class="ring"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>'
      + '<span class="cap">Play walkaround</span>';

    // Nothing downloads until it's asked for — keeps the modal light.
    play.addEventListener("click", function () {
      var embed = embedUrl(url);
      if (embed) {
        var f = document.createElement("iframe");
        f.src = embed;
        f.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen";
        f.allowFullscreen = true;
        f.title = "Vehicle walkaround video";
        box.appendChild(f);
      } else {
        var v = document.createElement("video");
        v.src = url;
        v.controls = true;
        v.autoplay = true;
        v.playsInline = true;
        v.preload = "auto";
        if (poster) v.poster = poster;
        box.appendChild(v);
        var p = v.play();
        if (p && p.catch) p.catch(function () { v.controls = true; });
      }
      play.remove();
    });

    box.appendChild(play);
    panel.appendChild(box);
  }

  /* ---------- stage enhancement ---------- */
  function enhance(car) {
    var stage = document.getElementById("vdStage");
    if (!stage) return;

    var m = mediaOf(car);
    var hasSpin = m.spin.length >= 8;   // fewer frames than this judders — not a real spin
    var hasVideo = !!m.video;
    if (!hasSpin && !hasVideo) return;  // leave the existing stage alone

    // Claim the stage synchronously, before any node is built. Guarding on
    // ".vd-media-tabs" (appended last) let a second call slip in and build a
    // rival set of panels — the DOM then showed one build while the repaint
    // closures belonged to the other, so the tags froze.
    if (stage.getAttribute("data-coc-media") === "1") return;
    stage.setAttribute("data-coc-media", "1");

    var tabs = document.createElement("div");
    tabs.className = "vd-media-tabs";
    tabs.setAttribute("role", "tablist");

    var panels = {};
    function addPanel(key) {
      var p = document.createElement("div");
      p.className = "vd-media-panel";
      p.setAttribute("role", "tabpanel");
      stage.appendChild(p);
      panels[key] = p;
      return p;
    }

    if (hasSpin) buildSpin(addPanel("spin"), m.spin, m.tags);
    if (hasVideo) buildVideo(addPanel("video"), m.video, m.poster);

    // Every vehicle comes off the inspection app with a 360 walkaround, so the
    // spin leads and photos sit behind it.
    var defs = [];
    if (hasSpin) defs.push({ k: "spin", t: "360°" });
    defs.push({ k: "photos", t: "Photos" });
    if (hasVideo) defs.push({ k: "video", t: "Video", live: true });
    var first = defs[0].k;

    function select(k) {
      Array.prototype.forEach.call(tabs.children, function (b) {
        var on = b.getAttribute("data-k") === k;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      Object.keys(panels).forEach(function (n) { panels[n].classList.toggle("on", n === k); });
      stage.classList.toggle("media-alt", k !== "photos");
    }

    defs.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "vd-media-tab" + (d.k === first ? " on" : "");
      b.setAttribute("data-k", d.k);
      b.setAttribute("role", "tab");
      b.innerHTML = d.t + (d.live ? "<i></i>" : "");
      b.addEventListener("click", function () { select(d.k); });
      tabs.appendChild(b);
    });

    stage.appendChild(tabs);
    select(first);
  }

  function init() {
    var native = window.openVehicleDetail;
    if (typeof native !== "function") return;
    window.openVehicleDetail = function (car) {
      var out = native.apply(this, arguments);
      // Build on the next tick: vd-upgrade.js finishes writing the stage's
      // innerHTML first. Injecting inside that window would get the nodes
      // re-serialised out from under us, silently dropping every listener.
      setTimeout(function () { try { enhance(car); } catch (e) {} }, 0);
      return out;
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.COCMedia = { mediaOf: mediaOf };
})();
