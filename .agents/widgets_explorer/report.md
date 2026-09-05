# CDN Widgets & WordPress Plugin — Code Audit & Polish Punch-List

**Audit Date:** 2026-09-02  
**Target Surfaces:** CDN Standalone Widgets (`packages/standalone/`) and WordPress Plugin (`packages/truwidgets-wp/`)  
**Deployment Target:** `cdn.tru-saas.com` & WordPress Plugin Directory

---

## Executive Summary

The TruDealer standalone widgets (`packages/standalone/`) and the companion WordPress plugin (`packages/truwidgets-wp/`) provide a fast, zero-ecosystem embed suite for independent car dealerships. They allow dealerships to deploy soft affordability calculators, repayment tools, test-drive booking, trade-in valuations, enquiry forms, and social sharing to any website with a single `<script>` tag.

This read-only audit identified **10 concrete, actionable refinements** across **Widget DX, UX Polish, Performance, and Code Quality**. All findings are self-contained, high-return adjustments requiring no framework migrations or architectural rewrites.

### Findings Breakdown by Category

| Surface | Widget DX | UX Polish | Performance | Code Quality | Micro-feature | Total |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **CDN Widgets (`packages/standalone/`)** | 3 | 3 | 1 | 1 | — | **8** |
| **WordPress Plugin (`packages/truwidgets-wp/`)** | 2 | — | — | — | — | **2** |
| **Total** | **5** | **3** | **1** | **1** | — | **10** |

---

## Top Quick Wins (S-Effort + High-Impact)

1. **Fix False Error Alarm in TruRepay (`tru-repay.js`)**: Stop showing an error screen when CallMeBot/WhatsApp-only standalone dealers receive quote requests without a configured webhook URL.
2. **Restore Missing TruValue in TruLoader (`tru-loader.js`)**: Add `value`/`tru-value` initialization to `tru-loader.js` and `TruDealer.open('value')` / `TruDealer.closeAll()`.
3. **Add TruValue to WordPress Plugin (`settings.php` & `inject.php`)**: Add `w_value` toggle to WP Admin and injector logic to achieve parity with the CDN suite.
4. **Resilient Inline Mount with MutationObserver (`tru-afford.js` & `tru-repay.js`)**: Adopt the MutationObserver pattern from `tru-value.js` so inline calculators never fail when rendered inside React/Vue/Gutenberg containers.
5. **Universal `tru:lead` CustomEvent Telemetry**: Dispatch the `tru:lead` CustomEvent across all widget lead captures (Afford, Repay, Book, Value) to enable dealer GTM/Meta Pixel analytics tracking.

---

## Prioritised Punch-List of Findings

---

### Finding 1: TruLoader Ignores TruValue and Omits It from `TruDealer` JS API
* **App**: CDN Widgets
* **Category**: Widget DX / Code Quality
* **File**: `packages/standalone/tru-loader/tru-loader.js` (Lines 164–296, 308–324)
* **Effort**: **S** (<20 min)
* **Impact**: **High**

#### Description
`packages/standalone/tru-value/tru-value.js` exists as an active standalone valuation and trade-in widget (documented in `README.md` line 74). However, `tru-loader.js` contains boot handlers for `afford`, `repay`, `form`, `chat`, `book`, and `share`, but completely omits `value`/`tru-value`. If a dealership embeds `<script src="tru-loader.js" data-widgets="afford,repay,value,form">`, the `value` widget is silently ignored and never loaded. Additionally, `root.TruDealer.open` (line 308) and `root.TruDealer.closeAll` (line 319) do not support `value` (and `closeAll` also omits `TruBook`).

#### Concrete Suggested Fix
In `packages/standalone/tru-loader/tru-loader.js`:
1. Add the `tru-value` boot branch to `boot()`:
```javascript
// 7. TruValue — Trade-in & live market valuation
if (wanted.indexOf("value") !== -1 || wanted.indexOf("tru-value") !== -1) {
  var valueSrc = widgetUrl("tru-value");
  var vTag = document.createElement("script");
  vTag.src = valueSrc;
  vTag.setAttribute("data-dealer", globalCfg.dealer);
  vTag.setAttribute("data-wa", globalCfg.wa);
  vTag.setAttribute("data-accent", globalCfg.accent);
  vTag.setAttribute("data-flow", globalCfg.flow);
  vTag.setAttribute("data-slug", globalCfg.slug);
  if (globalCfg.webhook) vTag.setAttribute("data-webhook", globalCfg.webhook);
  if (globalCfg.cmbKey) vTag.setAttribute("data-callmebot-key", globalCfg.cmbKey);
  if (globalCfg.cmbPhone) vTag.setAttribute("data-callmebot-phone", globalCfg.cmbPhone);
  vTag.setAttribute("data-position", getAttr("data-value-position", globalCfg.position));
  vTag.setAttribute("data-bottom", getAttr("data-value-bottom", "88px"));
  vTag.setAttribute("data-theme", globalCfg.theme);
  applyGlobalStyle(vTag);
  applyPrefixed(vTag, "value");
  document.head.appendChild(vTag);
}
```
2. Update `root.TruDealer.open` and `closeAll`:
```javascript
open: function (widget, payload) {
  var w = String(widget || "").toLowerCase();
  if (w === "afford" && root.TruAfford) root.TruAfford.open(payload);
  if (w === "repay" && root.TruRepay) root.TruRepay.open(payload);
  if (w === "form" && root.TruForm) root.TruForm.open(payload);
  if (w === "book" && (root.TruBook || root.COCBook)) (root.TruBook || root.COCBook).open(payload);
  if (w === "value" && root.TruValue) root.TruValue.open(payload);
  if (w === "chat" && root.TruChatUI) {
    var el = document.getElementById("tc-fab");
    if (el) el.click();
  }
},
closeAll: function () {
  if (root.TruAfford) root.TruAfford.close();
  if (root.TruRepay) root.TruRepay.close();
  if (root.TruForm) root.TruForm.close();
  if (root.TruBook) root.TruBook.close();
  if (root.TruValue) root.TruValue.close();
}
```

---

### Finding 2: TruRepay Displays Error Screen for Webhook-Free Dealers on Lead Submission
* **App**: CDN Widgets
* **Category**: UX / Code Quality
* **File**: `packages/standalone/tru-repay/tru-repay.js` (Lines 629–638, 656–660)
* **Effort**: **S** (<15 min)
* **Impact**: **High**

#### Description
In `packages/standalone/tru-repay/tru-repay.js`:
```javascript
629: function postLead(source) {
630:   cmbNotify(cfg, source || "TruRepay", ...);
631:   if (!(cfg.webhook || (cfg.slug && cfg.flowUrl))) return Promise.resolve(false);
```
When a dealer operates without a webhook or TruFlow DMS (i.e. using CallMeBot WhatsApp notifications or WhatsApp direct CTA), `postLead` returns `Promise.resolve(false)`. When a buyer enters their name and phone and clicks "Send me this quote" (line 656), `postLead` resolves to `false`, causing the widget to call `showState("is-error")`. The shopper sees a red error badge with "Couldn't send that / Something went wrong", despite the CallMeBot notification successfully triggering!

`tru-form.js` (line 876) correctly returns `Promise.resolve(!!(cfg.cmbKey && cfg.cmbPhone))` when no webhook is set.

#### Concrete Suggested Fix
In `packages/standalone/tru-repay/tru-repay.js`, update line 629 to:
```javascript
if (!(cfg.webhook || (cfg.slug && cfg.flowUrl))) {
  return Promise.resolve(!!(cfg.cmbKey && cfg.cmbPhone));
}
```

---

### Finding 3: WordPress Plugin Omits TruValue Trade-in / Valuation Option
* **App**: WordPress Plugin
* **Category**: Widget DX
* **File**: `packages/truwidgets-wp/includes/settings.php` (Lines 40, 120–130) & `packages/truwidgets-wp/includes/inject.php` (Lines 14, 98–128)
* **Effort**: **S** (<20 min)
* **Impact**: **High**

#### Description
The WordPress plugin settings page exposes checkboxes for TruAfford, TruRepay, TruForm, TruBook, and TruShare, but lacks `TruValue` (trade-in valuation). Dealers hosting their websites on WordPress cannot enable or configure TruValue from the admin settings page.

#### Concrete Suggested Fix
1. In `packages/truwidgets-wp/includes/inject.php`:
   - Line 14: Add `'value'` to `$all = array('afford', 'repay', 'form', 'book', 'share', 'value');`
   - Line 128: Add injection handler for TruValue:
     ```php
     if (in_array('value', $widgets)) {
         $attrs['data-value-position'] = truw_opt('value_side', 'right');
         truw_bottom($attrs, 'value');
         truw_scale($attrs, 'value');
         if (truw_opt('value_mount')) {
             $attrs['data-value-mount'] = truw_opt('value_mount');
         }
     }
     ```
2. In `packages/truwidgets-wp/includes/settings.php`:
   - Line 40: Add `'w_value'` to `$checks` array and `'value_mount'`, `'value_side'`, `'value_bottom'`, `'value_scale'` to `$text` array.
   - Line 128: Add checkbox field:
     ```php
     truw_field('w_value', 'TruValue', 'checkbox', array('cblabel' => 'Trade-in & market valuation widget'));
     ```
   - Line 178: Add per-widget option fields for `value_mount`.

---

### Finding 4: Inline Mount Fails in SPAs / Dynamic Page Builders (`tru-afford.js` & `tru-repay.js`)
* **App**: CDN Widgets
* **Category**: Performance / Widget DX
* **File**: `packages/standalone/tru-afford/tru-afford.js` (Lines 378–382, 646–650) & `packages/standalone/tru-repay/tru-repay.js` (Lines 366–371, 688–689)
* **Effort**: **S** (<20 min)
* **Impact**: **High**

#### Description
`tru-afford.js` and `tru-repay.js` attempt to find their inline mount container (`data-mount` / `data-target`) immediately upon script execution or `DOMContentLoaded`. In modern WordPress page builders (Elementor, Divi, Gutenberg) and SPA frameworks (Next.js, Vue), container DOM nodes may be rendered asynchronously after `DOMContentLoaded`. When `document.querySelector` fails, `tru-afford.js` falls back to attaching a floating launcher, and `tru-repay.js` attaches a detached element to `document.body`.

`packages/standalone/tru-value/tru-value.js` (lines 530–545) already contains a resilient `MutationObserver` in `boot()` that waits up to 5 seconds for the target selector to appear.

#### Concrete Suggested Fix
In `packages/standalone/tru-afford/tru-afford.js` and `packages/standalone/tru-repay/tru-repay.js`, wrap `mount()` in a `boot()` helper with a MutationObserver:
```javascript
function boot() {
  var targetSel = cfg.mount || cfg.target;
  if (!targetSel || document.querySelector(targetSel)) return mount();
  var done = false;
  var obs = new MutationObserver(function () {
    if (!done && document.querySelector(targetSel)) {
      done = true;
      obs.disconnect();
      mount();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () {
    if (!done) {
      done = true;
      obs.disconnect();
      mount();
    }
  }, 5000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
```

---

### Finding 5: Inconsistent `tru:lead` CustomEvent Analytics Telemetry Across Widgets
* **App**: CDN Widgets
* **Category**: Code Quality / Widget DX
* **File**: `packages/standalone/tru-form/tru-form.js` (Lines 899–905) vs `tru-afford.js` (Line 609), `tru-repay.js` (Line 656), `tru-book.js` (Line 299), `tru-value.js` (Line 495)
* **Effort**: **S** (<30 min)
* **Impact**: **High**

#### Description
`tru-form.js` dispatches a standard DOM CustomEvent on window when a lead is captured:
```javascript
function announceLead(source) {
  try {
    window.dispatchEvent(new CustomEvent("tru:lead", {
      detail: { source: source, product: "TruForm", dealer: cfg.dealer, slug: cfg.slug }
    }));
  } catch (e) {}
}
```
This is essential for dealer agencies and webmasters to trigger Google Tag Manager (GTM), Meta Pixel, Google Analytics 4 (GA4), or TikTok conversion events. However, none of the other lead-generating widgets (`tru-afford.js`, `tru-repay.js`, `tru-book.js`, `tru-value.js`) dispatch this event upon lead completion.

#### Concrete Suggested Fix
Add `announceLead` to `tru-afford.js`, `tru-repay.js`, `tru-book.js`, and `tru-value.js` on successful webhook/CallMeBot submission:
```javascript
function announceLead(product, data) {
  try {
    window.dispatchEvent(new CustomEvent("tru:lead", {
      detail: { product: product, dealer: cfg.dealer, slug: cfg.slug, data: data || {} }
    }));
  } catch (e) {}
}
```

---

### Finding 6: TruBook Lacks Shadow DOM Encapsulation, Escape Key Handling, and Confirmation Screen
* **App**: CDN Widgets
* **Category**: Widget DX / UX
* **File**: `packages/standalone/tru-book/tru-book.js` (Lines 125–183, 191–194, 320–327)
* **Effort**: **M** (1.5 hrs)
* **Impact**: **High**

#### Description
1. **Light DOM CSS Collisions**: TruBook injects styles into `document.head` and appends `.tb-modal` directly to `document.body` in the Light DOM (unlike TruAfford, TruRepay, and TruForm which use Shadow DOM). External CSS rules like `h3 { color: ... }`, button styling, or CSS framework resets (Bootstrap/Tailwind) frequently distort modal typography and grid alignments.
2. **Missing Escape Key Handler**: Pressing `Escape` does not dismiss the modal overlay.
3. **Abrupt Modal Dismissal on Submit**: In `confirm()` (lines 320–327), clicking "Confirm Appointment" calls `close()` immediately without showing a "Thank you / Appointment booked" confirmation state.

#### Concrete Suggested Fix
1. Add Escape key listener in `bind()` or `ensureBg()`:
```javascript
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && bg && bg.classList.contains("open")) close();
});
```
2. In `confirm()`, display a confirmation view before closing:
```javascript
bg.innerHTML = '<div class="tb-modal" style="text-align:center;padding:40px 24px">'
  + '<div style="font-size:32px;margin-bottom:12px">✅</div>'
  + '<h3>Appointment Requested!</h3>'
  + '<p class="tb-sub">We have reserved your slot for ' + esc(when) + '. The ' + esc(cfg.dealer) + ' team will confirm via WhatsApp/phone shortly.</p>'
  + '<button class="tb-btn" style="max-width:200px;margin:20px auto 0" id="tbDone">Done</button>'
  + '</div>';
document.getElementById("tbDone").addEventListener("click", close);
```
3. Wrap container inside `attachShadow({ mode: "open" })` with `:host { all: initial }` matching the other suite widgets.

---

### Finding 7: TruRepay Range Slider Background Track Lacks Dynamic Progress Fill
* **App**: CDN Widgets
* **Category**: UX Polish
* **File**: `packages/standalone/tru-repay/tru-repay.js` (Lines 281–285, 539–543)
* **Effort**: **S** (<20 min)
* **Impact**: **Medium**

#### Description
In `tru-repay.js` (lines 281–282):
```css
input[type=range] {
  background: linear-gradient(90deg, var(--tr-signal), var(--tr-signal-bright));
}
```
The track background is statically colored with a full gradient regardless of slider value. When deposit is at 10% or balloon is at 0%, the right (unselected) side of the slider track remains brightly illuminated, visually suggesting the value is 100% filled. In contrast, `tru-afford.js` uses a dynamic `--fill` percentage CSS variable.

#### Concrete Suggested Fix
In `packages/standalone/tru-repay/tru-repay.js`:
1. Update CSS line 282:
```css
background: linear-gradient(90deg, var(--tr-signal) 0%, var(--tr-signal-bright) var(--fill, 50%), var(--tr-fill-2) var(--fill, 50%));
```
2. In `recalc()`, update `--fill` on every slider input:
```javascript
["tr-dep", "tr-term", "tr-bal", "tr-rate"].forEach(function (id) {
  var input = shadow.getElementById(id);
  if (!input) return;
  var min = +input.min, max = +input.max, val = +input.value;
  var pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty("--fill", pct + "%");
});
```

---

### Finding 8: TruForm Form Validation Errors Do Not Clear on Typing
* **App**: CDN Widgets
* **Category**: UX Polish
* **File**: `packages/standalone/tru-form/tru-form.js` (Lines 793–805, 924–936)
* **Effort**: **S** (<15 min)
* **Impact**: **Medium**

#### Description
When a user attempts to submit `tru-form.js` with missing required fields (First Name, Phone), `validate()` (line 793) applies the `.tf-err` class to the input wrapper, displaying a red border and validation hint. However, no event listeners are registered on `input` or `change` to clear `.tf-err`. The red error warning persists even while the user is actively typing a valid phone number, clearing only if the user presses submit a second time.

#### Concrete Suggested Fix
In `mount()` inside `packages/standalone/tru-form/tru-form.js`, attach input listeners:
```javascript
["tf-fn", "tf-ph", "tf-em"].forEach(function (id) {
  var el = shadow.getElementById(id);
  if (el) {
    el.addEventListener("input", function () {
      setErr(id, false);
    });
  }
});
```

---

### Finding 9: WordPress Plugin Lacks Shortcodes (`[tru_repay]`, `[tru_value]`, etc.) for In-Page Placement
* **App**: WordPress Plugin
* **Category**: Widget DX
* **File**: `packages/truwidgets-wp/includes/inject.php` (Lines 1–138)
* **Effort**: **M** (1 hr)
* **Impact**: **High**

#### Description
`truwidgets.php` currently only provides automatic global injection in `wp_footer`. If a dealer wants to place a finance repayment calculator or trade-in value widget inside a specific Vehicle Detail Page (VDP) template, blog post, or landing page built with Elementor, Divi, or Gutenberg, they have no shortcodes available.

#### Concrete Suggested Fix
In `packages/truwidgets-wp/includes/inject.php`, register shortcodes for inline embeds:
```php
add_shortcode('tru_repay', function ($atts) {
    $a = shortcode_atts(array(
        'price' => '',
        'vehicle' => '',
        'collapsible' => '0'
    ), $atts);
    $target_id = 'tru-repay-' . wp_rand(100, 9999);
    return '<div id="' . esc_attr($target_id) . '" class="tru-repay-inline" data-repay-price="' . esc_attr($a['price']) . '" data-repay-vehicle="' . esc_attr($a['vehicle']) . '"></div>';
});

add_shortcode('tru_value', function ($atts) {
    $target_id = 'tru-value-' . wp_rand(100, 9999);
    return '<div id="' . esc_attr($target_id) . '" class="tru-value-inline"></div>';
});

add_shortcode('tru_afford', function ($atts) {
    $target_id = 'tru-afford-' . wp_rand(100, 9999);
    return '<div id="' . esc_attr($target_id) . '" class="tru-afford-inline"></div>';
});

add_shortcode('tru_form', function ($atts) {
    $target_id = 'tru-form-' . wp_rand(100, 9999);
    return '<div id="' . esc_attr($target_id) . '" class="tru-form-inline"></div>';
});
```

---

### Finding 10: Unify Inline Attribute Aliases (`data-mount` and `data-target`)
* **App**: CDN Widgets
* **Category**: Widget DX
* **File**: `packages/standalone/tru-afford/tru-afford.js` (Line 74), `tru-repay/tru-repay.js` (Line 99), `tru-form/tru-form.js` (Line 97), `tru-value/tru-value.js` (Line 74)
* **Effort**: **S** (<15 min)
* **Impact**: **Medium**

#### Description
As noted in `README.md` (lines 95–98), `tru-afford.js` and `tru-value.js` look for `data-mount`, while `tru-repay.js` and `tru-form.js` look for `data-target`. This causes confusion when developers configure multiple widgets on the same page.

#### Concrete Suggested Fix
Allow all 4 widgets to accept both `data-mount` and `data-target` interchangeably:
```javascript
var mountSelector = attr("data-mount", "") || attr("data-target", "");
```

---
