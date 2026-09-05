# TruFlow Mobile Audit — Handoff Report

## 1. Observation

Direct code examination of `truflow-mobile/` identified the following concrete observations:

- **`public/index.html:716-720`**:
  ```javascript
  function api(method,path,body){
    var opts={method:method,headers:hdrs()};
    if(body)opts.body=JSON.stringify(body);
    return fetch(API+path,opts).then(function(r){
      if(r.status===401){doLogout();throw new Error("Session expired");}
      return r.json();
    });
  }
  ```
  `api()` returns `r.json()` without checking `r.ok`, resolving errors as successful promise resolutions.

- **`public/sw.js:44-49`**:
  ```javascript
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
  `sw.js` caches all HTTP responses regardless of `res.status`, causing 502/504 proxy responses from cold start/restarts to overwrite valid cached data in offline storage.

- **`public/index.html:897, 1309`**:
  ```javascript
  (st==="New"&&phone?'<a class="qa wa" href="https://wa.me/'+phone.replace(/\D/g,"")+'" target="_blank" rel="noopener"...
  var pd=phone.replace(/\D/g,"");
  if(pd)actions+='<a class="wa" href="https://wa.me/'+pd+'" target="_blank" rel="noopener">'+svgWa+'WhatsApp</a>';
  ```
  Phone numbers with local leading zeroes (e.g. `0821234567`) are passed directly to `wa.me/`, which WhatsApp rejects as invalid.

- **`public/index.html:784, 789`**:
  ```javascript
  var polling=false, loadFailed=false, isOffline=false;
  function setOffline(off){isOffline=off;}
  ```
  `isOffline` is tracked on failed requests and window events, but no DOM element queries or renders it.

- **`public/index.html:973`**:
  ```javascript
  return ((vName(v)+" "+(v.trim||"")+" "+(v.stockNumber||"")).toLowerCase().indexOf(q)>=0);
  ```
  Stock search does not include `v.vin` or `v.regNumber`.

- **`public/index.html:1083-1085`**:
  `openVeh()` only injects `vHero(v)` into `.vhero`; other images in `v.images` are inaccessible inside the app.

- **`public/index.html:1941`**:
  `chips($("#leadChips"),["All","New","Contacted","Negotiating","Closed Won"],...)` omits `"Test Drive Scheduled"` / `"Test drive"`.

- **`public/index.html:1312-1316`**:
  Call and WhatsApp links in the lead sheet have no click event listeners to update `lastContactedAt` or log activity.

- **`public/index.html:1760-1768`**:
  Walk-in lead creation uses `showModal({title:"Walk-in lead", ... input:true})`, capturing only name with no phone or notes input.

- **`public/index.html:1716`**:
  `e.target.reset()` on vehicle add does not clear `$("#aMvOut")`.

- **`public/index.html:1296`**:
  `todayISO()` evaluates `new Date().toISOString().slice(0, 10)`, using UTC date rather than local timezone.

---

## 2. Logic Chain

1. **Error Masking Chain**: `fetch()` resolves for any HTTP response (including 400, 403, 404, 500). Because `api()` does not evaluate `r.ok`, the parsed `{ error: "..." }` JSON resolves the promise. Handlers at lines 1227, 1284, and 1715 assume resolved promises indicate success, displaying positive toasts ("Vehicle updated", "Saved") while database state remains unchanged.
2. **Offline Poisoning Chain**: When `fetch(req)` returns a 502/504 from the Express proxy (`server.js`), `sw.js` clones and writes the response to cache. When the handset goes offline, `caches.match(req)` serves the cached 502 error instead of previous valid state.
3. **WhatsApp Failure Chain**: WhatsApp's `wa.me/` endpoint requires numbers in E.164 without `+` or leading `0`. Sanitizing with `replace(/\D/g, "")` leaves `082...`, causing WhatsApp Web/Mobile to fail.
4. **Offline Blindness Chain**: Staff on the yard lose network connectivity; `setOffline(true)` sets the internal variable, but without UI reflection, users attempt actions without understanding why live updates or chat aren't responding.
5. **Workflow Friction Chain**: Walk-in prospects are created with name only because the prompt has one text input; because `openLead()` lacks contact editing, staff cannot subsequently add the customer's phone number from mobile, breaking quick-dial and WhatsApp workflows.

---

## 3. Caveats

- **Backend Coupling**: `truflow-mobile` is a companion client for `truflow-premium`. Backend APIs (`/api/leads`, `/api/inventory`, `/api/tasks`) are shared with the desktop DMS. Suggested client changes preserve all existing request/response schemas.
- **Service Worker Scope**: Testing ServiceWorker cache eviction requires browser refresh and cache version bumping.
- **No Native Frameworks**: The codebase is vanilla HTML/CSS/JS without React or build tooling. All suggestions are plain JS DOM manipulations that require no bundling step.

---

## 4. Conclusion

TruFlow Mobile has a solid design and core feature set matching the TruSaaS 2026 brand. Implementing the 11 identified improvements—especially the 5 top quick wins (API error rejection, ServiceWorker 200 check, WhatsApp number formatting, offline UI badge, and VIN search)—will significantly elevate reliability, data integrity, and daily floor workflow efficiency without architectural risk.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify API Error Handling**:
   - Inspect `public/index.html:716-720`.
   - Send an invalid payload (e.g. invalid vehicle ID) via `api("PUT", "/api/inventory/invalid_id", {})` and confirm that it resolves rather than rejects.
2. **Verify Service Worker Caching**:
   - Inspect `public/sw.js:44-48`.
   - Simulate a 502 response from backend and observe that the response is written to CacheStorage under `tfm-2026-08-31a`.
3. **Verify WhatsApp Number Formatting**:
   - Inspect `public/index.html:897, 1309`.
   - Test a lead with phone `0821234567`; observe link generates `https://wa.me/0821234567` instead of `https://wa.me/27821234567`.
4. **Verify Stock Search**:
   - Inspect `public/index.html:973`.
   - Search for a VIN string in `#stockSearch` on inventory containing that VIN; observe zero results returned.
5. **Verify Full Report**:
   - Read complete punch-list at `c:\Users\pgdeb\dev\TruSaaS\TruDealerMaster\.agents\truflow_mobile_explorer\report.md`.
