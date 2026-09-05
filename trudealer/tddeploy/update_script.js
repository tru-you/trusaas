const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Navigation menu less glassmorphic
html = html.replace('background:rgba(255,255,255,.88)', 'background:rgba(255,255,255,0.98)');

// 2. Fix the live-hero-wrap to look like a phone screen and move the "Open Fullscreen" button
// The user wants it to look like a mobile phone, and the sandbox button explicitly labeled.
const findVisualStr = `<div class="live-hero-wrap" style="margin-top:0;box-shadow:0 24px 60px -15px rgba(0,0,0,0.6), 0 0 30px -4px rgba(13,148,136,0.3);border-radius:18px;">
              <div class="live-hero-head">
                <span>🌐 www.true-cars.co.za · Custom Built</span>
                <span class="live-tag"><span></span> LIVE SITE</span>
              </div>
              <div class="live-hero-frame" style="height:380px;min-height:340px;">
                <div class="iframe-skeleton"></div>
                <iframe src="https://true-cars.co.za" loading="lazy" title="True-Cars SA live dealership showroom - custom designed from the ground up" style="width:100%;height:100%;border:0;display:block;" onload="this.parentElement.classList.add('iframe-loaded')"></iframe>
              </div>
              <div class="live-hero-foot">
                <span>100 Web Vitals · Live DMS Stock Sync</span>
                <a href="https://true-cars.co.za" target="_blank" rel="noopener">Open www.true-cars.co.za ↗</a>
              </div>
            </div>`;

const replaceVisualStr = `<div style="text-align:center; margin-bottom: 24px;">
              <a class="mod-btn-primary" href="https://true-cars.co.za" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; justify-content:center; padding: 12px 24px; background:#0B7C72; color:#fff; border-radius:100px; font-weight:600; text-decoration:none;">
                Open Desktop View ↗
              </a>
            </div>
            <div class="mc-preview pv-phone" style="background:none; border:none; box-shadow:none; margin: 0 auto; padding:0; width: 100%; display: flex; justify-content: center;">
              <div class="phone-fr" style="width: 320px; height: 650px; max-height:80vh; position: relative;">
                <div class="live-hero-head" style="position: absolute; top: 0; left: 0; right: 0; padding: 8px; font-size: 9px; background: #26303C; color: #fff; z-index: 10; display: flex; justify-content: space-between; border-radius: 18px 18px 0 0;">
                  <span>🌐 LIVE SITE</span>
                </div>
                <div class="iframe-skeleton"></div>
                <iframe src="https://true-cars.co.za" loading="lazy" style="width:100%; height:calc(100% - 26px); margin-top:26px; border:0; display:block;" onload="this.parentElement.classList.add('iframe-loaded')"></iframe>
              </div>
            </div>`;

html = html.replace(findVisualStr, replaceVisualStr);

// Also we need to remove the original "Open Fullscreen" button from .mod-panel-actions
const findButtonStr = `<a class="mod-btn-primary" href="https://true-cars.co.za" target="_blank" rel="noopener">
              Open Fullscreen ↗
            </a>`;
html = html.replace(findButtonStr, '');

// 3. Add www.fouchemotors.co.za client card
// I'll clone the existing "True-Cars SA" case card and modify it.
const trueCarsCardStart = html.indexOf('<article class="case">');
const nextCaseStart = html.indexOf('<article class="case">', trueCarsCardStart + 10);
if(trueCarsCardStart !== -1 && nextCaseStart !== -1) {
    const trueCarsCard = html.substring(trueCarsCardStart, nextCaseStart);
    const foucheCard = trueCarsCard
        .replace('True-Cars SA', 'Fouche Motors')
        .replace('https://true-cars.co.za', 'https://fouchemotors.co.za')
        .replace('OPEN LIVE ↗', 'OPEN LIVE ↗')
        .replace('National, Online', 'Vanderbijlpark, ZA')
        .replace('DMS-Driven E-Commerce', 'Full Digital Transformation')
        .replace('360° virtual showroom', 'Seamless stock and leads flow');
    
    // Insert after True-Cars card
    html = html.substring(0, nextCaseStart) + foucheCard + html.substring(nextCaseStart);
}

// 4. Update Truchat AI widget link
// The user wants it to say "Powered by TruDealer" and link.
// Wait, is there a truchat.js being loaded here? Let's check for "truchat" or "chat"
// In `trudealer/tddeploy/index.html` there might be a script tag for it.
// Wait, the user said "just make sure says powered by TruDealer and link". This is a config for the widget.
// The script might be: <script src="https://truchat-api.tru-saas.com/..."></script> or similar.
// If it's loaded via a script tag, we might need to modify the script src, or add a data attribute.

fs.writeFileSync('index.html', html);
console.log('Update done');
