# TruFlow Mobile — Code Audit & Refinement Punch-List

**App Surface**: TruFlow Mobile (`truflow-mobile/`)  
**Audit Date**: 2026-09-02  
**Auditor**: TruFlow Mobile Explorer Agent  
**Focus**: Small, high-return refinements across UX Polish, Performance, Code Quality, and Missing Micro-features.

---

## Executive Summary

TruFlow Mobile is a lightweight vanilla PWA companion app designed for dealership floor staff on mobile devices. It connects to the TruFlow Premium DMS backend via an Express proxy (`server.js`) with offline caching powered by Service Worker (`public/sw.js`).

Overall, the application architecture is clean, responsive, and adheres strictly to the 2026 TruSaaS brand guidelines (`brand.css` tokens, no uppercase, 3D sculpted primary CTA buttons, Inter and IBM Plex Mono typography). However, our deep audit revealed several high-impact edge cases and quality-of-life gaps that affect floor staff in daily showroom usage:
1. The `api()` client does not reject HTTP 4xx/5xx responses, causing false "Saved" / "Added to inventory" toasts on failed API writes.
2. The Service Worker caches 502/504 gateway timeout/proxy error responses without status checks, poisoning the offline cache.
3. WhatsApp click-to-chat links lack international country prefix formatting, causing WhatsApp to fail on local phone numbers (e.g. South African `082...` or UK `07...`).
4. An offline indicator variable (`isOffline`) is computed on connectivity failure but never rendered in the UI.
5. Floor walk-in creation only takes a name string with no phone number field, and lead detail sheets lack contact editing.
6. Stock search omits VIN and registration number matching despite the in-app guide promising VIN search.
7. Vehicle detail sheets only show a single hero image without multi-photo thumbnail browsing.

Below is the prioritised punch-list of 11 concrete, actionable improvements ranked by impact-to-effort ratio.

---

## Findings Summary Matrix

| Category | Total Findings | S-Effort (<30m) | M-Effort (1-3h) | L-Effort (half-day+) | High Impact | Med Impact | Low Impact |
|---|---|---|---|---|---|---|---|
| **Code Quality** | 3 | 3 | 0 | 0 | 1 | 1 | 1 |
| **Performance** | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| **UX Polish** | 4 | 3 | 1 | 0 | 2 | 2 | 0 |
| **Micro-features** | 3 | 1 | 2 | 0 | 1 | 2 | 0 |
| **Total** | **11** | **8** | **3** | **0** | **5** | **5** | **1** |

---

## Top Quick Wins (S-Effort + High-Impact)

1. **Fix `api()` HTTP error handling**: Prevent false-positive "Saved" toasts on network/server errors by rejecting non-2xx responses.
2. **Prevent ServiceWorker cache poisoning**: Check `res.status === 200` before caching API responses so 502/504 proxy errors aren't permanently cached.
3. **Market-aware WhatsApp phone normalization**: Automatically prepend country code (`27` for ZA, `44` for UK, `1` for US) and strip leading zero for seamless one-tap WhatsApping.
4. **Active offline indicator banner**: Expose the already-computed `isOffline` status in the top bar so floor staff know when they are looking at cached data.
5. **VIN and License Plate stock search**: Include `v.vin` and `v.regNumber` in `renderStock()` search filtering.

---

## Detailed Findings Punch-List

### Finding 1: Core `api()` Client Does Not Reject HTTP 4xx/5xx Responses

- **App**: TruFlow Mobile
- **Category**: Code Quality / Reliability
- **File(s)**: `truflow-mobile/public/index.html:716-720`
- **Description**: The core API helper calls `fetch(API + path, opts)` and checks only `if (r.status === 401)`. For any other status code (such as 400 Bad Request, 403 Forbidden, 404 Not Found, 409 Conflict, or 500 Server Error), it unconditionally calls `return r.json()`. Because `r.json()` returns a resolved Promise containing the backend error payload `{ error: "..." }`, downstream callers (such as `POST /api/inventory`, `PUT /api/inventory/:id`, `PUT /api/leads/:id`, and `POST /api/leads`) execute their `.then()` success handler and display misleading "Vehicle updated", "Saved", or "Added to inventory" toasts even when the database write failed.
- **Evidence**:
  ```javascript
  // Lines 716-720 in public/index.html
  function api(method, path, body) {
    var opts = { method: method, headers: hdrs() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function(r) {
      if (r.status === 401) { doLogout(); throw new Error("Session expired"); }
      return r.json();
    });
  }
  ```
- **Suggested Fix**: Verify `r.ok` before resolving:
  ```javascript
  function api(method, path, body) {
    var opts = { method: method, headers: hdrs() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function(r) {
      if (r.status === 401) { doLogout(); throw new Error("Session expired"); }
      return r.json().then(function(data) {
        if (!r.ok) throw new Error((data && data.error) || ("HTTP " + r.status));
        return data;
      });
    });
  }
  ```
- **Effort**: S (<30 min)
- **Impact**: High

---

### Finding 2: Service Worker Caches 502/504 Error Responses, Poisoning Offline Cache

- **App**: TruFlow Mobile
- **Category**: Performance / Caching
- **File(s)**: `truflow-mobile/public/sw.js:44-49, 57-61`
- **Description**: In `public/sw.js`, when network-first fetches to `/api/*` succeed at the HTTP layer, `res.clone()` is cached into `VERSION` cache without checking `res.status === 200` or `res.ok`. If the upstream backend is cold-starting or restarting, Express proxy `server.js` returns a `502 Bad Gateway` or `504 Backend timeout`. The service worker caches this 502/504 response over previously valid cached data. Subsequent offline visits or cache fallbacks return the cached 502 error instead of valid lead/stock data.
- **Evidence**:
  ```javascript
  // Lines 43-49 in public/sw.js
  if (url.origin === self.location.origin && url.pathname.indexOf("/api/") === 0) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }
  ```
- **Suggested Fix**: Only cache responses if `res.status === 200`:
  ```javascript
  if (url.origin === self.location.origin && url.pathname.indexOf("/api/") === 0) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res.status === 200) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }
  ```
- **Effort**: S (<30 min)
- **Impact**: High

---

### Finding 3: WhatsApp Click-to-Chat Links Lack Country Code Normalisation

- **App**: TruFlow Mobile
- **Category**: UX Polish / Micro-feature
- **File(s)**: `truflow-mobile/public/index.html:897, 1309, 1314`
- **Description**: Quick action WhatsApp buttons in lead list rows and lead detail sheets construct URLs using `phone.replace(/\D/g, "")`. South African local numbers (e.g., `082 123 4567`) and UK numbers (e.g., `07123 456789`) retain their leading `0` (e.g., `https://wa.me/0821234567`). When tapped on mobile, WhatsApp rejects the URL with "Phone number shared via url is invalid".
- **Evidence**:
  ```javascript
  // Line 897 in public/index.html
  (st==="New"&&phone?'<a class="qa wa" href="https://wa.me/'+phone.replace(/\D/g,"")+'" target="_blank" rel="noopener"...

  // Lines 1309 & 1314 in public/index.html
  var pd=phone.replace(/\D/g,"");
  if(pd)actions+='<a class="wa" href="https://wa.me/'+pd+'" target="_blank" rel="noopener">'+svgWa+'WhatsApp</a>';
  ```
- **Suggested Fix**: Introduce a helper `cleanWaPhone(phone)` using the resolved `MARKET.id`:
  ```javascript
  function cleanWaPhone(phone) {
    var d = (phone || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.indexOf("0") === 0) {
      var pfx = (MARKET.id === "uk" ? "44" : MARKET.id === "us" ? "1" : "27");
      d = pfx + d.slice(1);
    }
    return d;
  }
  ```
  And replace `phone.replace(/\D/g,"")` with `cleanWaPhone(phone)` in `leadRow()` and `openLead()`.
- **Effort**: S (<30 min)
- **Impact**: High

---

### Finding 4: `isOffline` Status Computed but Never Displayed to Floor Staff

- **App**: TruFlow Mobile
- **Category**: UX Polish / Offline Indicator
- **File(s)**: `truflow-mobile/public/index.html:784-792, 801`
- **Description**: The app defines `isOffline` and updates it via `setOffline(loadFailed)` and window online/offline listeners, but `isOffline` is never queried or connected to any DOM element. When floor staff walk into a low-signal area on the lot, they receive no visual cue that data is cached or that changes may not have synced.
- **Evidence**:
  ```javascript
  // Lines 784-792 in public/index.html
  var polling=false, loadFailed=false, isOffline=false;
  function setOffline(off){isOffline=off;}
  window.addEventListener("online",function(){if(TOKEN)loadAll();});
  window.addEventListener("offline",function(){setOffline(true);});
  ```
- **Suggested Fix**: Update `setOffline()` to toggle an offline badge in the header or top bar:
  ```javascript
  function setOffline(off) {
    isOffline = off;
    var badge = $("#offlineBadge");
    if (!badge) {
      badge = el("span", "pill dust", "Offline · Cached");
      badge.id = "offlineBadge";
      badge.style.display = "none";
      $(".brand .who").appendChild(badge);
    }
    badge.style.display = off ? "inline-flex" : "none";
    var dot = $(".brand .dot");
    if (dot) dot.style.background = off ? "var(--danger)" : "var(--cyan)";
  }
  ```
- **Effort**: S (<30 min)
- **Impact**: High

---

### Finding 5: Walk-in Lead Creation Missing Phone Field & Leads Lack Contact Editing

- **App**: TruFlow Mobile
- **Category**: Missing Micro-features / UX Polish
- **File(s)**: `truflow-mobile/public/index.html:1303-1358, 1760-1768`
- **Description**: Tapping "+ Walk-in" (`#addLeadBtn`) opens a single-input `showModal` asking only for "Customer name". It does not allow entering a phone number, email, or car of interest. Furthermore, `openLead()` displays contact details in read-only text and only allows updating the status stepper or logging notes. There is no edit modal or input field to update a lead's phone number or email, making it impossible to add a phone number later to enable click-to-dial or WhatsApp.
- **Evidence**:
  ```javascript
  // Lines 1760-1768 in public/index.html
  $("#addLeadBtn").addEventListener("click",function(){
    showModal({title:"Walk-in lead",message:"Add a customer who just walked in.",input:true,placeholder:"Customer name",confirmLabel:"Add"}).then(function(name){
      if(!name)return;
      var parts=name.trim().split(/\s+/), first=parts[0]||"Walk-in", last=parts.slice(1).join(" ")||"";
      api("POST","/api/leads",{firstName:first,lastName:last,source:"Walk-in",status:"New",notes:"Added from the floor"}).then(function(res){
        toast(first+" added as a lead");loadLeads();
      }).catch(function(){toast("Couldn't add — check connection",true);});
    });
  });
  ```
- **Suggested Fix**:
  1. Update walk-in modal or create a dedicated quick bottom-sheet form for walk-ins capturing `First Name`, `Last Name`, `Phone`, and optional `Notes / Vehicle`.
  2. Add an "Edit contact" pencil icon button in `openLead()` allowing staff to update `phone`, `email`, and `firstName`/`lastName` via `PUT /api/leads/:id`.
- **Effort**: M (1-2 hours)
- **Impact**: High

---

### Finding 6: Stock Search Filter Does Not Match VIN or Registration Number

- **App**: TruFlow Mobile
- **Category**: Missing Micro-features / Search UX
- **File(s)**: `truflow-mobile/public/index.html:973`
- **Description**: `renderStock()` filters vehicles by matching against `vName(v) + " " + (v.trim || "") + " " + (v.stockNumber || "")`. It completely omits `v.vin` and `v.regNumber` / `v.licensePlate`. This directly contradicts the built-in Guide (line 1793: "Search: Type a make, model, stock number, or VIN in the search bar").
- **Evidence**:
  ```javascript
  // Line 973 in public/index.html
  return ((vName(v)+" "+(v.trim||"")+" "+(v.stockNumber||"")).toLowerCase().indexOf(q)>=0);
  ```
- **Suggested Fix**: Include `v.vin` and `v.regNumber` / `v.licensePlate` in the search string:
  ```javascript
  var searchStr = [vName(v), v.trim, v.stockNumber, v.vin, v.regNumber, v.licensePlate].filter(Boolean).join(" ").toLowerCase();
  return searchStr.indexOf(q) >= 0;
  ```
- **Effort**: S (<15 min)
- **Impact**: Medium

---

### Finding 7: Vehicle Detail Sheet Only Shows Single Hero Photo (No Multi-Photo Preview)

- **App**: TruFlow Mobile
- **Category**: UX Polish / Vehicle Cards
- **File(s)**: `truflow-mobile/public/index.html:1083-1085`
- **Description**: Vehicles in TruFlow have an array of 10-30 images (`v.images` and `v.extrasPhotos`). When opening a vehicle in `openVeh()`, only the primary hero image is rendered in `<div class="vhero">`. The only way to see other photos is to tap "photos" which opens the external TruLens web app in a separate browser tab. Floor staff presenting a car to a customer cannot flip through interior or detail photos within TruFlow Mobile.
- **Evidence**:
  ```javascript
  // Lines 1083-1085 in public/index.html
  var heroHtml = hero
    ? '<div class="vhero"><img class="bg" src="'+esc(hero)+'" alt="">...</div>'
    : '<div class="vhero" ...>...</div>';
  ```
- **Suggested Fix**: Add a horizontal thumbnail carousel below the hero image or inside `.vhero` when `v.images.length > 1`:
  ```javascript
  var thumbsHtml = (v.images && v.images.length > 1)
    ? '<div class="vthumbs" style="display:flex;gap:8px;overflow-x:auto;padding:8px 0;margin-top:8px;">' +
      v.images.map(function(img, idx) {
        return '<img src="' + esc(img) + '" style="width:64px;height:48px;border-radius:6px;object-fit:cover;cursor:pointer;border:1px solid var(--glass-line);" onclick="$(\'.vhero img.bg\').src=\'' + esc(img) + '\'">';
      }).join("") + '</div>'
    : '';
  ```
- **Effort**: M (1-2 hours)
- **Impact**: High

---

### Finding 8: Lead Stage Filter Chips Missing "Test Drive Scheduled" Stage

- **App**: TruFlow Mobile
- **Category**: UX Polish / Navigation
- **File(s)**: `truflow-mobile/public/index.html:1941`
- **Description**: The chips bar on the Leads screen initializes with `["All","New","Contacted","Negotiating","Closed Won"]`. The stage `"Test Drive Scheduled"` (mapped to `"Test drive"` in `LEAD_LBL`) is completely omitted. Floor staff cannot filter their leads to view upcoming test drives without manually scrolling through "All".
- **Evidence**:
  ```javascript
  // Line 1941 in public/index.html
  chips($("#leadChips"),["All","New","Contacted","Negotiating","Closed Won"],function(v){leadFilter=v;renderLeads();});
  ```
- **Suggested Fix**: Update the chips configuration to include `"Test drive"` and update `renderLeads()` filter matching:
  ```javascript
  chips($("#leadChips"), ["All", "New", "Contacted", "Test drive", "Negotiating", "Won"], function(v) {
    leadFilter = v === "Test drive" ? "Test Drive Scheduled" : v === "Won" ? "Closed Won" : v;
    renderLeads();
  });
  ```
- **Effort**: S (<15 min)
- **Impact**: Medium

---

### Finding 9: Call and WhatsApp Actions Do Not Auto-Log Contact Timestamp

- **App**: TruFlow Mobile
- **Category**: UX Polish / Automation Gap
- **File(s)**: `truflow-mobile/public/index.html:1312-1316`
- **Description**: The in-app Guide (line 1782) explicitly states: *"Tap the Call or WhatsApp button in the quick actions bar. The call is logged automatically."* However, the buttons are plain `<a>` tags with `href="tel:..."` and `href="https://wa.me/..."` with no click event handlers. Tapping them does not update `lastContactedAt` or append a journey log entry in the DMS.
- **Evidence**:
  ```javascript
  // Lines 1312-1316 in public/index.html
  var actions='<div class="ldact">';
  if(phone)actions+='<a href="tel:'+esc(phone.replace(/\s/g,""))+'">'+svgCall+'Call</a>';
  if(pd)actions+='<a class="wa" href="https://wa.me/'+pd+'" target="_blank" rel="noopener">'+svgWa+'WhatsApp</a>';
  if(email)actions+='<a href="mailto:'+esc(email)+'">'+svgMail+'Email</a>';
  actions+='</div>';
  ```
- **Suggested Fix**: Attach click handlers to the action links that automatically update the lead's `lastContactedAt` and append an entry to `journey`:
  ```javascript
  function autoLogContact(channel) {
    var l = findLead(curLeadId); if (!l) return;
    var journey = (l.journey || []).slice();
    journey.push({ time: stampNow(), at: new Date().toISOString(), action: channel, detail: "Outbound " + channel + " from mobile" });
    api("PUT", "/api/leads/" + curLeadId, { lastContactedAt: todayISO(), journey: journey }).then(function(res) {
      if (res && res.lead) updateLeadCache(res.lead);
      renderHome(); renderLeads();
    }).catch(function() {});
  }
  ```
- **Effort**: S (<30 min)
- **Impact**: Medium

---

### Finding 10: Add Vehicle Form Reset Leaves Stale Live Market Value Preview

- **App**: TruFlow Mobile
- **Category**: UX Polish / Form Hygiene
- **File(s)**: `truflow-mobile/public/index.html:1716`
- **Description**: When a vehicle is added via `#addForm`, `e.target.reset()` resets the form inputs, but does not empty `#aMvOut`. If the dealer performed a "Live Market Value" check while creating the car, the market value scan card remains visible in `#aMvOut`. When navigating back to Add Vehicle later, the previous vehicle's valuation is displayed.
- **Evidence**:
  ```javascript
  // Line 1716 in public/index.html
  api("POST","/api/inventory",vehicle).then(function(){
    toast(year+" "+make+" "+model+" added to inventory");e.target.reset();loadInventory();go("stock");if(btn)btn.disabled=false;
  }).catch(...);
  ```
- **Suggested Fix**: Clear `#aMvOut` on reset:
  ```javascript
  e.target.reset();
  var mvOut = $("#aMvOut");
  if (mvOut) mvOut.innerHTML = "";
  ```
- **Effort**: S (<10 min)
- **Impact**: Low

---

### Finding 11: `todayISO()` Uses UTC Timestamp Causing Timezone Inaccuracies

- **App**: TruFlow Mobile
- **Category**: Code Quality / Timezone Hygiene
- **File(s)**: `truflow-mobile/public/index.html:1296, 1676`
- **Description**: `todayISO()` is implemented as `new Date().toISOString().slice(0, 10)`. `toISOString()` produces a UTC-based timestamp. In South Africa (UTC+2) between 00:00 and 02:00 local time, this returns yesterday's date. As a result, follow-up tasks due today are misclassified as upcoming during late-night or early-morning floor prep.
- **Evidence**:
  ```javascript
  // Line 1296 in public/index.html
  function todayISO(){return new Date().toISOString().slice(0,10);}
  ```
- **Suggested Fix**: Use local date components:
  ```javascript
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  ```
- **Effort**: S (<10 min)
- **Impact**: Low

---

## Suggested Implementation Roadmap

1. **Sprint 1 (Quick Wins - S Effort)**:
   - Patch `api()` client error handling (Finding 1).
   - Patch Service Worker `sw.js` cache status check (Finding 2).
   - Add `cleanWaPhone()` helper for WhatsApp URLs (Finding 3).
   - Connect `isOffline` state to top offline badge (Finding 4).
   - Add `vin` and `regNumber` to stock search filter (Finding 6).
   - Update lead filter chips to include "Test drive" (Finding 8).
   - Auto-log contact on Call/WhatsApp taps (Finding 9).
   - Clean up `#aMvOut` and fix `todayISO()` timezone calculation (Findings 10 & 11).

2. **Sprint 2 (Micro-features - M Effort)**:
   - Multi-field walk-in lead capture + lead contact edit modal (Finding 5).
   - Multi-photo carousel in vehicle detail sheet (Finding 7).
