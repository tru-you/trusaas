/* Splash */
(function(){
  var splash = document.getElementById('splash');
  if(!splash) return;
  var done = false;
  function dismiss(){ if(done) return; done = true; splash.classList.add('done'); setTimeout(function(){ splash.remove(); }, 800); }
  setTimeout(function(){ splash.classList.add('done'); setTimeout(function(){ if(!done){ done=true; splash.remove(); } }, 800); }, 1800);
})();

(function(){
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function(){ nav.classList.toggle('scrolled', window.scrollY > 40); }, {passive:true});

  var burger = document.getElementById('navBurger');
  var overlay = document.getElementById('mobileOverlay');
  if(burger){
    burger.addEventListener('click', function(){
      burger.classList.toggle('open');
      overlay.classList.toggle('open');
      document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
    });
    overlay.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        burger.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  var reveals = document.querySelectorAll('.reveal');
  var revealObs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('visible'); revealObs.unobserve(e.target); }});
  }, {threshold:0.1, rootMargin:'0px 0px -40px 0px'});
  reveals.forEach(function(el){ revealObs.observe(el); });

  var filters = document.querySelectorAll('.mod-filter');
  var tiles = document.querySelectorAll('.mod-tile');
  filters.forEach(function(btn){
    btn.addEventListener('click', function(){
      filters.forEach(function(f){ f.classList.remove('on'); });
      btn.classList.add('on');
      var cat = btn.dataset.filter;
      tiles.forEach(function(t){
        t.style.display = (cat === 'all' || t.dataset.cat === cat) ? '' : 'none';
      });
    });
  });

  var fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  if(fine && !reduce){
    document.body.classList.add('has-custom-cursor');
    var dot = document.getElementById('cursorDot');
    var ring = document.getElementById('cursorRing');
    var mx = window.innerWidth/2, my = window.innerHeight/2, rx = mx, ry = my;
    window.addEventListener('mousemove', function(e){
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx+'px'; dot.style.top = my+'px';
    }, {passive:true});
    (function trail(){
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.left = rx+'px'; ring.style.top = ry+'px';
      requestAnimationFrame(trail);
    })();
    var hoverSel = 'a,button,.mod-tile,.pillar-row,.why-card,.api-card,.price-card,.mod-filter,.demo-card,.quote-card';
    document.querySelectorAll(hoverSel).forEach(function(el){
      el.addEventListener('mouseenter', function(){ ring.classList.add('cursor-hover'); });
      el.addEventListener('mouseleave', function(){ ring.classList.remove('cursor-hover'); });
    });
    document.addEventListener('mouseleave', function(){ dot.style.opacity = ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', function(){ dot.style.opacity = ring.style.opacity = '1'; });
  }

  if(!reduce){
    var tiltEls = document.querySelectorAll('.pillar-row,.mod-tile,.api-card,.why-card,.demo-card,.quote-card');
    tiltEls.forEach(function(el){
      var raf = null;
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        var rotY = (px - 0.5) * 8;
        var rotX = (0.5 - py) * 8;
        if(raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function(){
          el.style.transform = 'translateY(-4px) perspective(800px) rotateX('+rotX+'deg) rotateY('+rotY+'deg)';
        });
      });
      el.addEventListener('mouseleave', function(){
        if(raf) cancelAnimationFrame(raf);
        el.style.transform = '';
      });
    });
  }

  var chartEl = document.getElementById('dmsChart');
  if(chartEl){
    var heights = [45,62,38,75,55,82,68,90,58,72,48,85];
    heights.forEach(function(h,i){
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.background = i % 3 === 0 ? 'var(--signal)' : i % 3 === 1 ? 'var(--signal-bright)' : 'var(--blue)';
      bar.style.height = '0%';
      bar.style.opacity = '0.7';
      chartEl.appendChild(bar);
      setTimeout(function(){ bar.style.height = h+'%'; }, 300 + i*80);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var target = document.querySelector(a.getAttribute('href'));
      if(target){ e.preventDefault(); target.scrollIntoView({behavior:'smooth'}); }
    });
  });

  // ══ TRUBOT ══
  var tbFab = document.getElementById('trubotFab');
  var tbPanel = document.getElementById('trubotPanel');
  var tbClose = document.getElementById('trubotClose');
  var tbInput = document.getElementById('trubotInput');
  var tbSend = document.getElementById('trubotSend');
  var tbMessages = document.getElementById('trubotMessages');
  var tbQuick = document.getElementById('trubotQuick');
  var tbBadge = tbFab.querySelector('.trubot-badge');
  var leadCaptured = false;

  function tbToggle(){
    var open = tbPanel.classList.toggle('open');
    tbFab.classList.toggle('open', open);
    if(open){ tbBadge.style.display = 'none'; tbInput.focus(); }
  }
  tbFab.addEventListener('click', tbToggle);
  tbClose.addEventListener('click', tbToggle);

  function tbAddMsg(text, sender, delay){
    if(delay){
      var typing = document.createElement('div');
      typing.className = 'tb-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      tbMessages.appendChild(typing);
      tbMessages.scrollTop = tbMessages.scrollHeight;
      setTimeout(function(){
        tbMessages.removeChild(typing);
        tbAddMsg(text, sender);
      }, delay);
      return;
    }
    var msg = document.createElement('div');
    msg.className = 'tb-msg ' + sender;
    var now = new Date();
    var time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    msg.innerHTML = '<div class="tb-bubble">' + text + '</div><span class="tb-time">' + time + '</span>';
    tbMessages.appendChild(msg);
    tbMessages.scrollTop = tbMessages.scrollHeight;
  }

  function tbShowLeadForm(){
    if(leadCaptured) return;
    tbQuick.style.display = 'none';
    var form = document.createElement('div');
    form.className = 'tb-lead-form';
    form.id = 'tbLeadForm';
    form.innerHTML = '<div class="tb-form-label">Your Details</div>' +
      '<div class="tb-form-fields">' +
      '<input class="tb-form-field" id="tbName" placeholder="Full name" type="text">' +
      '<input class="tb-form-field" id="tbEmail" placeholder="Email address" type="email">' +
      '<input class="tb-form-field" id="tbPhone" placeholder="Phone / WhatsApp" type="tel">' +
      '<input class="tb-form-field" id="tbDealer" placeholder="Dealership name (optional)" type="text">' +
      '<button class="tb-form-submit" id="tbFormSubmit">Submit &amp; Book Demo</button>' +
      '</div>';
    var inputArea = document.querySelector('.tb-input-area');
    inputArea.parentNode.insertBefore(form, inputArea);
    document.getElementById('tbFormSubmit').addEventListener('click', function(){
      var name = document.getElementById('tbName').value.trim();
      var email = document.getElementById('tbEmail').value.trim();
      var phone = document.getElementById('tbPhone').value.trim();
      if(!name || !email){
        tbAddMsg("Please fill in at least your name and email so we can get back to you.", 'bot', 400);
        return;
      }
      leadCaptured = true;
      form.parentNode.removeChild(form);
      tbQuick.style.display = 'flex';
      tbAddMsg("Thanks " + name + "! I've captured your details. Our team will reach out within 24 hours to schedule your personalised demo. In the meantime, feel free to ask me anything about the platform.", 'bot', 800);
    });
  }

  var botResponses = {
    demo: "Great choice! Let me grab your details so our team can set up a personalised walkthrough of TruSaaS.",
    pricing: "TruSaaS offers three tiers: <b>Starter</b> (monthly subscription for independent dealers), <b>Growth</b> (multi-location with Core + Retail + CRM), and <b>Enterprise</b> (custom pricing for groups, fleets and white-label resellers). Want me to connect you with our sales team for a quote?",
    modules: "TruSaaS has <b>22 products</b> across 6 pillars: Core Platform, Digital Retail &amp; Showroom, Sales &amp; CRM, Vehicle Intelligence, Trade Auctions &amp; Recon, and Fleet Commercial &amp; Finance. Each module works standalone or together. Which pillar interests you most?",
    franchise: "<b>TruFlow Lite</b> and <b>Premium</b> are the live DMS demos — stock, CRM, media and recon. Photos only in <b>TruLens</b>. Open the <b>Live demos</b> section on this page (localhost when the stack is running). Want a walkthrough?",
    crm: "<b>TruChat</b> builds dealer bots; leads land in TruFlow. WhatsApp-native for SA. Pair with Flow Lite or Premium. Shall I book a demo with Paul?",
    lens: "<b>TruLens</b> is the guided photo PWA — quality scores, VIR PDFs, export to DMS, web 3D with damage tags. Demo on port 3000 when running.",
    web: "<b>TruWeb</b> is dealer showrooms (MKR, Apex and more). They pull public stock from Flow/TruLens so the site stays live without retyping.",
    fleet: "TruFleet covers the full lifecycle — procurement, utilisation tracking, TCO analysis and disposal. Pair it with <b>TruTruck</b> for heavy commercial — payload configs, COF tracking and fleet tenders.",
    showroom: "Our public consumer demo is <b>true-cars.co.za</b> — open it now. Dealer showrooms (MKR, Apex, etc.) are TruWeb builds. Add Tru360 / TruLens for spin + VIR. Want a walkthrough?",
    truecars: "<b>true-cars.co.za</b> is our live public demo site — Cape Town fair buy &amp; sell experience on the TruSaaS stack. Perfect link to send prospects.",
    vir: "TruVIR delivers digital vehicle inspection reports with 150+ checkpoints and branded PDF output. <b>TruVIR AI</b> takes it further with automated damage detection, severity grading and repair cost estimation from photos. Powered by <b>TruLens</b> visual analytics.",
    recon: "TruRecon manages the full reconditioning workflow — intake, vendor assignment, cost tracking, quality checks and days-to-frontline reporting. Know exactly what every unit costs to get frontline-ready.",
    auction: "TruAuction is our dealer-to-dealer digital auction platform with bidding, reserve pricing, transport coordination and settlement. <b>TruTrade-In</b> handles instant valuations with market-based pricing and customer self-service appraisals.",
    finance: "TruFinance handles multi-bank F&amp;I origination with digital applications, rate comparison and compliance documentation. Pair with <b>TruESE</b> for a full Electronic Sales Environment — digital deal jackets, document assembly and e-signatures.",
    whatsapp: "TruChat has native WhatsApp Business API integration. Send quotes, vehicle photos, documents and automated follow-ups directly via WhatsApp — the channel your customers actually use.",
    marketing: "TruMarketing delivers email, SMS and WhatsApp campaign automation with audience segmentation, A/B testing and ROI attribution. Combine with <b>TruHello</b> for automated customer greeting and first-response flows.",
    fallback: "That's a great question! I can help with info on any of our 22 products, pricing, demos, or technical details. Could you tell me a bit more about what you're looking for? Or I can connect you with our team directly."
  };

  function tbGetResponse(text){
    var t = text.toLowerCase();
    if(t.match(/demo|book|schedule|meeting|call/)) return {key:'demo', showForm:true};
    if(t.match(/pric|cost|how much|subscription|tier|plan/)) return {key:'pricing'};
    if(t.match(/module|product|22|pillar|what do you/)) return {key:'modules'};
    if(t.match(/franchise|dms|dealer management|multi.?brand|flow|premium|lite/)) return {key:'franchise'};
    if(t.match(/crm|lead|pipeline|sales|chat|bot/)) return {key:'crm'};
    if(t.match(/trulens|lens|pwa|photo|shoot/)) return {key:'lens'};
    if(t.match(/true.?cars|truecars\.co|demo site|public demo/)) return {key:'truecars'};
    if(t.match(/truweb|website|mkr|apex|mockup|showroom site/)) return {key:'web'};
    if(t.match(/fleet|telematics|truck|commercial/)) return {key:'fleet'};
    if(t.match(/360|showroom|compare/)) return {key:'showroom'};
    if(t.match(/vir|inspection|damage|ai.*inspect/)) return {key:'vir'};
    if(t.match(/recon|refurb|frontline/)) return {key:'recon'};
    if(t.match(/auction|trade.?in|wholesale/)) return {key:'auction'};
    if(t.match(/finance|f.?i|loan|credit|ese|deal jacket/)) return {key:'finance'};
    if(t.match(/whatsapp/)) return {key:'whatsapp'};
    if(t.match(/market|campaign|email|sms|hello/)) return {key:'marketing'};
    return {key:'fallback'};
  }

  function tbHandleSend(){
    var text = tbInput.value.trim();
    if(!text) return;
    tbAddMsg(text, 'user');
    tbInput.value = '';
    var resp = tbGetResponse(text);
    tbAddMsg(botResponses[resp.key], 'bot', 600 + Math.random() * 600);
    if(resp.showForm){
      setTimeout(tbShowLeadForm, 1800);
    }
  }

  tbSend.addEventListener('click', tbHandleSend);
  tbInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') tbHandleSend(); });

  tbQuick.querySelectorAll('.tb-quick').forEach(function(btn){
    btn.addEventListener('click', function(){
      tbInput.value = btn.dataset.msg;
      tbHandleSend();
    });
  });

  // auto-open hint after 5s
  setTimeout(function(){
    if(!tbPanel.classList.contains('open')){
      tbBadge.style.display = 'block';
    }
  }, 5000);
})();

// ==========================================
// INTERACTIVE PLATFORM SIMULATOR (SANDBOX)
// ==========================================
var sandboxState = 0; // 0: Start, 1: Captured, 2: Exported, 3: Viewed, 4: Pricing Adjusted, 5: Published, 6: Chat Qualified, 7: Done

function resetSandbox() {
  sandboxState = 0;
  
  // Reset Step Indicators
  document.querySelectorAll('.play-step-dot').forEach(function(dot, idx) {
    dot.classList.toggle('active', idx === 0);
    dot.classList.remove('completed');
  });

  // Reset Devices
  document.getElementById('sandboxPhone').style.display = '';
  document.getElementById('sandboxBrowser').style.display = '';
  
  // TruLens
  document.getElementById('lensCarImg').style.filter = '';
  document.getElementById('lensScanner').style.display = 'none';
  document.getElementById('lensHotspots').style.display = 'none';
  document.getElementById('lensPopover').style.display = 'none';
  document.getElementById('lensState0').style.display = '';
  document.getElementById('lensState1').style.display = 'none';
  document.getElementById('lensState2').style.display = 'none';
  
  // Browser URLs & views
  document.getElementById('browserUrl').textContent = 'https://premium.tru-saas.com';
  document.getElementById('dmsView').style.display = 'flex';
  document.getElementById('showroomView').style.display = 'none';
  document.getElementById('dmsNotification').classList.remove('show');
  document.getElementById('dmsDashboardStats').style.display = 'block';
  document.getElementById('dmsPublishPanel').style.display = 'none';
  document.getElementById('dmsLeadFeed').style.display = 'none';
  document.getElementById('dmsLeadCount').textContent = '12';
  document.getElementById('dmsStockPrice').value = 'R 295,000';
  document.getElementById('dmsPromoBtn').style.display = '';
  
  // Showroom View
  document.getElementById('showroomHondaCard').style.display = 'none';
  document.getElementById('showroomHondaCard').style.opacity = '0';
  document.getElementById('showroomHondaCard').style.transform = 'translateY(10px)';
  document.getElementById('hondaShowroomPrice').textContent = 'R 295,000';
  document.getElementById('hondaCardBadge').textContent = 'Live Stock';
  document.getElementById('hondaCardBadge').className = 'show-vcard-badge';
  document.getElementById('showChatWidget').style.display = 'none';
  document.getElementById('showChatPanel').classList.remove('show');
  
  // Modal & Success
  document.getElementById('virModal').classList.remove('show');
  document.getElementById('sandboxSuccess').classList.remove('show');
}

function triggerLensCapture() {
  if (sandboxState !== 0) return;
  var shutter = document.getElementById('shutterFlash');
  var car = document.getElementById('lensCarImg');
  var scanner = document.getElementById('lensScanner');
  var hotspots = document.getElementById('lensHotspots');
  
  // Shutter Flash
  shutter.classList.add('flash');
  setTimeout(function() { shutter.classList.remove('flash'); }, 300);

  // Scan start
  car.style.filter = 'brightness(0.6) contrast(1.2)';
  scanner.style.display = 'block';
  
  // Loading Simulation
  setTimeout(function() {
    scanner.style.display = 'none';
    car.style.filter = '';
    hotspots.style.display = 'block';
    
    // Show hotspots interaction hint
    document.getElementById('lensState0').style.display = 'none';
    document.getElementById('lensState1').style.display = 'block';
    
    // Auto trigger popover details
    var h1 = document.getElementById('hotspot1');
    if (h1) showLensPopover(h1, "Bumper Scratch", "2mm clear coat scratch. Est. repair: R850.");
    sandboxState = 1;
  }, 2000);
}

function showLensPopover(el, title, desc) {
  var pop = document.getElementById('lensPopover');
  if(!pop) return;
  pop.innerHTML = '<b>' + title + '</b><span>' + desc + '</span>';
  pop.style.left = (parseFloat(el.style.left) - 10) + '%';
  pop.style.top = (parseFloat(el.style.top) + 8) + '%';
  pop.style.display = 'block';
}

// Hover trigger for hotspots inside TruLens mockup
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.lens-hotspot').forEach(function(el) {
    el.addEventListener('mouseenter', function() {
      showLensPopover(el, el.dataset.title, el.dataset.desc);
    });
  });
});

function triggerLensExport() {
  if (sandboxState !== 1) return;
  
  document.getElementById('lensState1').style.display = 'none';
  document.getElementById('lensState2').style.display = 'block';
  
  // Update step indicators
  document.getElementById('pstep1').classList.remove('active');
  document.getElementById('pstep1').classList.add('completed');
  document.getElementById('pstep2').classList.add('active');

  // Trigger Toast Notification on DMS Screen
  setTimeout(function() {
    var toast = document.getElementById('dmsNotification');
    if (toast) toast.classList.add('show');
    sandboxState = 2;
  }, 800);
}

function openDmsImport() {
  if (sandboxState !== 2) return;
  
  // Hide Notification
  var toast = document.getElementById('dmsNotification');
  if (toast) toast.classList.remove('show');
  
  // Transition DMS views
  document.getElementById('dmsDashboardStats').style.display = 'none';
  document.getElementById('dmsPublishPanel').style.display = 'block';
  sandboxState = 3;
}

function applyDmsPromo() {
  if (sandboxState !== 3) return;
  document.getElementById('dmsStockPrice').value = 'R 289,000';
  document.getElementById('dmsPromoBtn').style.display = 'none';
  sandboxState = 4;
}

function publishStockToShowroom() {
  if (sandboxState !== 3 && sandboxState !== 4) return;
  
  // Sync Animation
  var btn = document.querySelector('#dmsPublishPanel .lens-btn');
  if (!btn) return;
  var prevText = btn.textContent;
  btn.textContent = 'Syncing Stock...';
  btn.disabled = true;
  
  setTimeout(function() {
    btn.textContent = prevText;
    btn.disabled = false;
    
    // Update step indicators
    document.getElementById('pstep2').classList.remove('active');
    document.getElementById('pstep2').classList.add('completed');
    document.getElementById('pstep3').classList.add('active');

    // Switch Browser View to Showroom Domain
    document.getElementById('browserUrl').textContent = 'https://true-cars.co.za/showroom';
    document.getElementById('dmsView').style.display = 'none';
    document.getElementById('showroomView').style.display = 'flex';
    
    // Make Honda card visible
    var hondaCard = document.getElementById('showroomHondaCard');
    if (hondaCard) {
      hondaCard.style.display = 'flex';
      
      // Sync adjusted price
      var price = (sandboxState === 4) ? 'R 289,000' : 'R 295,000';
      document.getElementById('hondaShowroomPrice').textContent = price;
      
      // Flash card animation
      setTimeout(function() {
        hondaCard.style.opacity = '1';
        hondaCard.style.transform = 'translateY(0)';
        
        // Auto open VIR Modal as prompt
        openVirModal();
      }, 200);
    }

    sandboxState = 5;
  }, 1200);
}

function openVirModal() {
  var modal = document.getElementById('virModal');
  if (modal) modal.classList.add('show');
}

function closeVirModal() {
  var modal = document.getElementById('virModal');
  if (modal) modal.classList.remove('show');
  
  // After viewing VIR report, display the chat widget
  if (sandboxState === 5) {
    var widget = document.getElementById('showChatWidget');
    if (widget) {
      widget.style.display = 'grid';
      // Auto pop up the chat panel to keep the simulation guides clear
      setTimeout(toggleShowroomChat, 400);
    }
  }
}

function toggleShowroomChat() {
  var chat = document.getElementById('showChatPanel');
  if (chat) chat.classList.toggle('show');
}

function simulateChatPreQual() {
  if (sandboxState !== 5) return;
  
  var msgs = document.getElementById('showChatMessages');
  var opts = document.getElementById('showChatOptions');
  if (!msgs || !opts) return;
  opts.style.display = 'none';

  // User message
  var uMsg = document.createElement('div');
  uMsg.className = 'show-chat-bubble user';
  uMsg.textContent = 'Check Soft Affordability';
  msgs.appendChild(uMsg);
  msgs.scrollTop = msgs.scrollHeight;

  // Bot response 1: asking details
  setTimeout(function() {
    var bMsg = document.createElement('div');
    bMsg.className = 'show-chat-bubble bot';
    bMsg.innerHTML = 'Sure! Pre-qualifying R289,000 over 72 months.<br><b>Expected Repayments:</b> R4,500/mo. Budget approved?';
    msgs.appendChild(bMsg);
    
    var inlineOpts = document.createElement('div');
    inlineOpts.style.cssText = 'display:flex; gap:6px; margin-top:6px;';
    inlineOpts.innerHTML = '<button class="show-chat-opt" style="padding:4px 8px; font-size:9px;" onclick="simulateChatPreQualStep2(this)">Yes, pre-qualify me</button>';
    bMsg.appendChild(inlineOpts);
    
    msgs.scrollTop = msgs.scrollHeight;
  }, 800);
}

function simulateChatPreQualStep2(btnEl) {
  if (btnEl) btnEl.disabled = true;
  var msgs = document.getElementById('showChatMessages');
  if (!msgs) return;
  
  // User message
  var uMsg = document.createElement('div');
  uMsg.className = 'show-chat-bubble user';
  uMsg.textContent = 'Yes, pre-qualify me';
  msgs.appendChild(uMsg);
  msgs.scrollTop = msgs.scrollHeight;

  // Bot response: Pre-approved
  setTimeout(function() {
    var bMsg = document.createElement('div');
    bMsg.className = 'show-chat-bubble bot';
    bMsg.innerHTML = '🎉 <b>Pre-Approved!</b> Wesbank & ABSA estimated approval rate is 98% with excellent credit. Submit to DMS?';
    msgs.appendChild(bMsg);
    
    var inlineOpts = document.createElement('div');
    inlineOpts.style.cssText = 'display:flex; gap:6px; margin-top:6px;';
    inlineOpts.innerHTML = '<button class="show-chat-opt" style="padding:4px 8px; font-size:9px;" onclick="simulateChatPreQualSubmit(this)">Submit Lead</button>';
    bMsg.appendChild(inlineOpts);
    
    msgs.scrollTop = msgs.scrollHeight;
  }, 800);
}

function simulateChatPreQualSubmit(btnEl) {
  if (btnEl) btnEl.disabled = true;
  var msgs = document.getElementById('showChatMessages');
  if (!msgs) return;
  
  // User message
  var uMsg = document.createElement('div');
  uMsg.className = 'show-chat-bubble user';
  uMsg.textContent = 'Submit Lead (John Doe)';
  msgs.appendChild(uMsg);
  msgs.scrollTop = msgs.scrollHeight;

  setTimeout(function() {
    var bMsg = document.createElement('div');
    bMsg.className = 'show-chat-bubble bot';
    bMsg.textContent = 'Awesome John! Lead sent to our Cape Town desk. A sales consultant will contact you via WhatsApp shortly.';
    msgs.appendChild(bMsg);
    msgs.scrollTop = msgs.scrollHeight;
    
    // Close chat after delay, update indicators
    setTimeout(function() {
      var panel = document.getElementById('showChatPanel');
      if (panel) panel.classList.remove('show');
      
      document.getElementById('pstep3').classList.remove('active');
      document.getElementById('pstep3').classList.add('completed');
      document.getElementById('pstep4').classList.add('active');
      
      // Go back to DMS view to show lead arrival
      setTimeout(function() {
        document.getElementById('browserUrl').textContent = 'https://premium.tru-saas.com';
        document.getElementById('showroomView').style.display = 'none';
        document.getElementById('dmsView').style.display = 'flex';
        
        // Open lead view, increment lead count
        document.getElementById('dmsDashboardStats').style.display = 'block';
        document.getElementById('dmsPublishPanel').style.display = 'none';
        document.getElementById('dmsLeadCount').textContent = '13';
        document.getElementById('dmsLeadText').textContent = 'John Doe — Honda Civic pre-approved (R4,500/mo)';
        document.getElementById('dmsLeadFeed').style.display = 'block';
        
        // Show Simulator Complete Success Screen after delay
        setTimeout(function() {
          document.getElementById('pstep4').classList.remove('active');
          document.getElementById('pstep4').classList.add('completed');
          document.getElementById('sandboxSuccess').classList.add('show');
          sandboxState = 6;
        }, 1800);
      }, 800);
    }, 1000);
  }, 800);
}

function simulateChatDemoBook() {
  alert("For checking the capture to showroom pipeline, please select 'Check Soft Affordability'!");
}