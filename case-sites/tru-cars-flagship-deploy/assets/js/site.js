/* ============================================================
   TRUECAR SA — Shared site behaviour
   Nav · scroll reveals · toast · leads store · AI chatbot
   ============================================================ */
window.TCSA = window.TCSA || {};

/* ---------------- Leads store (localStorage) ---------------- */
TCSA.leads = {
  KEY:'tcsa_leads_v1',
  all(){ try{ return JSON.parse(localStorage.getItem(this.KEY))||[]; }catch(e){ return []; } },
  add(lead){
    const leads = this.all();
    const rec = Object.assign({
      id:'L'+Date.now().toString(36).toUpperCase(),
      created:new Date().toISOString(),
      status:'New', source:'Website'
    }, lead);
    leads.unshift(rec);
    localStorage.setItem(this.KEY, JSON.stringify(leads));
    window.dispatchEvent(new CustomEvent('tcsa:lead', {detail:rec}));
    return rec;
  },
  update(id, patch){
    const leads = this.all().map(l=> l.id===id ? Object.assign(l,patch) : l);
    localStorage.setItem(this.KEY, JSON.stringify(leads));
  },
  clear(){ localStorage.removeItem(this.KEY); },
  seedIfEmpty(){
    if(this.all().length) return;
    const seed = [
      {name:'Thabo Mokoena', phone:'+27 82 551 0032', source:'Trade-in', status:'Qualified', intent:'Trade 2019 Polo → Golf GTI', value:'R680k', created:new Date(Date.now()-36e5*4).toISOString(), id:'LSEED1'},
      {name:'Chef Williams', phone:'+27 83 220 7781', source:'Finance', status:'Contacted', intent:'Pre-approval — Hilux Legend RS', value:'R750k', created:new Date(Date.now()-36e5*26).toISOString(), id:'LSEED2'},
      {name:'Aisha Patel', phone:'+27 71 908 4410', source:'Chatbot', status:'New', intent:'BYD Seal availability + LVS booking', value:'R800k', created:new Date(Date.now()-36e5*2).toISOString(), id:'LSEED3'},
      {name:'Pieter van Wyk', phone:'+27 84 665 1120', source:'Email', status:'Won', intent:'G 63 AMG — Premium Select', value:'R3.9m', created:new Date(Date.now()-36e5*70).toISOString(), id:'LSEED4'},
    ];
    localStorage.setItem(this.KEY, JSON.stringify(seed));
  }
};

/* ---------------- Toast ---------------- */
TCSA.toast = function(msg){
  let t = document.querySelector('.toast');
  if(!t){ t=document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg><span>${msg}</span>`;
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(TCSA._toastT);
  TCSA._toastT = setTimeout(()=>t.classList.remove('show'), 3200);
};

/* ============================================================
   i18n — English (primary) · Afrikaans · isiXhosa
   Key = the English source string. Elements marked [data-i18n]
   translate on language change. Nav/CTAs auto-tagged by text.
   ============================================================ */
TCSA.i18n = {
  lang: (localStorage.getItem('tcsa_lang')||'en'),
  dict: {
    // nav
    "Buy a Car":{af:"Koop 'n Motor",xh:"Thenga Imoto"},
    "Sell / Trade-in":{af:"Verkoop / Inruil",xh:"Thengisa / Ananisa"},
    "Finance":{af:"Finansiering",xh:"Inkxaso-Mali"},
    "Premium Select":{af:"Premium Keur",xh:"Ukukhetha Okugqwesileyo"},
    "Our Technology":{af:"Die TruSaaS-stelsel",xh:"Itekhnoloji Yethu"},
    "Lead Portal":{af:"Loodportaal",xh:"Iphothali yeLeads"},
    "Browse Stock":{af:"Blaai Voorraad",xh:"Khangela Isitokhwe"},
    "Browse the Stock":{af:"Blaai deur die Voorraad",xh:"Khangela Isitokhwe"},
    "Sell My Car":{af:"Verkoop My Motor",xh:"Thengisa Imoto Yam"},
    // hero
    "Cape Town · The Mother City":{af:"Kaapstad · Die Moederstad",xh:"IKapa · IDolophu EnguMama"},
    "The fair way to buy a car in South Africa.":{af:"Die regverdige manier om 'n motor in Suid-Afrika te koop.",xh:"Indlela efanelekileyo yokuthenga imoto eMzantsi Afrika."},
    "Every car with a 360° inspection, an honest TruPrice, and a live video walk-around — from BYD electric to the trusty Hilux.":{af:"Elke motor met 'n 360°-inspeksie, 'n eerlike TruPrice, en 'n regstreekse video-deurstap — van BYD elektries tot die betroubare Hilux.",xh:"Yonke imoto ineenkcukacha ze-360°, ixabiso le-TruPrice elinyanisekileyo, kunye nevidiyo bukhoma — ukusuka kwi-BYD yombane ukuya kwiHilux ethembekileyo."},
    "Sell / Value My Car":{af:"Verkoop / Waardeer My Motor",xh:"Thengisa / Xabisa Imoto Yam"},
    // section headers used across pages
    "Why True-Cars SA":{af:"Waarom True-Cars SA",xh:"Kutheni i-True-Cars SA"},
    "Featured stock":{af:"Uitgesoekte voorraad",xh:"Isitokhwe esibalulekileyo"},
    "Find your next car":{af:"Vind jou volgende motor",xh:"Fumana imoto yakho elandelayo"},
    // trade / finance CTAs
    "Value my car in 60 sec":{af:"Waardeer my motor in 60 sek",xh:"Xabisa imoto yam kwi-60s"},
    "Get pre-approved in 2 minutes →":{af:"Kry vooraf-goedkeuring in 2 minute →",xh:"Fumana imvume kwimizuzu emi-2 →"}
  },
  langs:[['en','EN'],['af','AF'],['xh','XH']],
  t(en){ if(this.lang==='en') return en; const e=this.dict[en]; return (e&&e[this.lang])||en; },
  autoTag(){
    const sel='.nav-links a, .mobile-menu a, .nav-cta a span, .nav-cta a, [data-i18n]';
    document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(el=>{ if(this.dict[el.textContent.trim()]) el.setAttribute('data-i18n',''); });
    document.querySelectorAll('.nav-cta a span, .hero-ctas a span, .hero-ctas .btn').forEach(el=>{ const txt=el.childNodes.length===1&&el.firstChild.nodeType===3?el.textContent.trim():null; if(txt&&this.dict[txt]) el.setAttribute('data-i18n',''); });
  },
  apply(){
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const en = el.dataset.en || el.textContent.trim();
      el.dataset.en = en;
      el.textContent = this.t(en);
    });
    document.documentElement.setAttribute('lang', this.lang);
    document.querySelectorAll('.lang-switch button').forEach(b=>b.classList.toggle('on', b.dataset.l===this.lang));
  },
  set(l){ this.lang=l; localStorage.setItem('tcsa_lang',l); this.apply();
    // refresh TruChat greeting language if she hasn't opened yet
    if(TCSA.chat && !TCSA.chat._greeted){/* greet uses lang at open time */}
  },
  mountSwitch(){
    const make=()=>{ const w=document.createElement('div'); w.className='lang-switch';
      w.innerHTML=this.langs.map(([l,lbl])=>`<button data-l="${l}"${l===this.lang?' class="on"':''}>${lbl}</button>`).join('');
      w.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>this.set(b.dataset.l)));
      return w; };
    document.querySelectorAll('.nav-cta').forEach(c=>{ if(!c.querySelector('.lang-switch')) c.insertBefore(make(), c.firstChild); });
    document.querySelectorAll('.mobile-menu').forEach(m=>{ if(!m.querySelector('.lang-switch')){ const s=make(); s.style.marginTop='8px'; m.appendChild(s); } });
  },
  init(){ this.autoTag(); this.mountSwitch(); this.apply(); }
};

/* ============================================================
   Brand — True-Cars SA homage wordmark (chrome "True" + spectrum "Car")
   Auto-applied to every .brand element site-wide.
   ============================================================ */
TCSA.brandHTML = '<img class="tc-logo-img" src="assets/brand/truecars-nav.png" alt="TrueCars" decoding="async">';
TCSA.brandHTMLFull = '<img class="tc-logo-img tc-logo-full" src="assets/brand/truecars-wordmark.png" alt="TrueCars — Demo Site" decoding="async">';
TCSA.upgradeBrand = function(){
  document.querySelectorAll('.brand').forEach(a=>{
    a.classList.add('tc-brand');
    a.innerHTML = a.closest('.foot-brand') ? TCSA.brandHTMLFull : TCSA.brandHTML;
  });
};

/* ---------------- Nav + reveals ---------------- */
TCSA.initChrome = function(){
  const nav = document.querySelector('.nav');
  if(nav){
    /* Transparent-over-hero only on pages with a dark full-bleed hero (homepage).
       Every other page starts solid so the nav is never white-on-white. */
    const hasDarkHero = !!document.querySelector('header.hero');
    const onScroll = ()=> nav.classList.toggle('solid', !hasDarkHero || window.scrollY>40);
    onScroll(); window.addEventListener('scroll', onScroll, {passive:true});
    const burger = nav.querySelector('.hamburger');
    const menu = document.querySelector('.mobile-menu');
    if(burger && menu){
      const closeMenu = () => { burger.classList.remove('open'); menu.classList.remove('open'); document.body.style.overflow=''; };
      const openMenu  = () => { burger.classList.add('open');    menu.classList.add('open');    document.body.style.overflow='hidden'; };
      burger.addEventListener('click', () => menu.classList.contains('open') ? closeMenu() : openMenu());
      // Close on any link or button click (including hash anchors and the ✕ button)
      menu.addEventListener('click', e => { if(e.target.closest('a,button')) closeMenu(); });
      // Close on Escape key
      document.addEventListener('keydown', e => { if(e.key==='Escape' && menu.classList.contains('open')) closeMenu(); });
      // Close when clicking the dark backdrop
      menu.addEventListener('click', e => { if(e.target===menu) closeMenu(); });
    }
  }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:.08, rootMargin:'0px 0px -4% 0px'});
  const revealEls = document.querySelectorAll('.rv,.rv-scale,.rv-left,.rv-right');
  revealEls.forEach(el=>io.observe(el));
  // Immediately reveal elements already in the viewport on page load
  requestAnimationFrame(()=>{
    revealEls.forEach(el=>{
      const r = el.getBoundingClientRect();
      if(r.top < window.innerHeight && r.bottom > 0){ el.classList.add('in'); io.unobserve(el); }
    });
  });

  /* animated counters */
  const cio = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const el=e.target, target=parseFloat(el.dataset.count), dur=1400, t0=performance.now();
      const pre=el.dataset.pre||'', suf=el.dataset.suf||'', dec=parseInt(el.dataset.dec||'0');
      function tick(now){ const p=Math.min(1,(now-t0)/dur); const val=target*(1-Math.pow(1-p,3));
        el.textContent = pre + val.toLocaleString('en-ZA',{minimumFractionDigits:dec,maximumFractionDigits:dec}) + suf;
        if(p<1) requestAnimationFrame(tick); }
      requestAnimationFrame(tick); cio.unobserve(el);
    });
  }, {threshold:.5});
  document.querySelectorAll('[data-count]').forEach(el=>cio.observe(el));
};

/* ============================================================
   AI CHATBOT — "TruChat", True-Cars SA assistant (EN · AF · XH)
   Animated SVG avatar · finance pre-approval · needs assessment
   ============================================================ */
TCSA.chat = {
  ctx:{ stage:'idle', lead:{}, fin:{} },

  _av:`<svg class="luna-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="luna-bg" cx="38%" cy="28%" r="70%"><stop offset="0%" stop-color="#3b9eff"/><stop offset="100%" stop-color="#0e4cc4"/></radialGradient></defs>
    <circle cx="24" cy="24" r="22" fill="none" stroke="#15C7C0" stroke-width="2" class="luna-ring"/>
    <circle cx="24" cy="24" r="20" fill="url(#luna-bg)"/>
    <ellipse cx="16.5" cy="20" rx="2.6" ry="3.4" fill="white" class="luna-el"/>
    <ellipse cx="31.5" cy="20" rx="2.6" ry="3.4" fill="white" class="luna-er"/>
    <circle cx="17.3" cy="21" r="1.4" fill="#041830"/>
    <circle cx="32.3" cy="21" r="1.4" fill="#041830"/>
    <circle cx="17.9" cy="20.2" r="0.5" fill="white"/>
    <circle cx="32.9" cy="20.2" r="0.5" fill="white"/>
    <path d="M15 29 Q24 36 33 29" stroke="white" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="37" cy="11" r="5" fill="#15C7C0" stroke="white" stroke-width="1.5" class="luna-dot"/>
  </svg>`,

  /* Legacy Luna FAB + strip + panel — DISABLED.
     True-Cars uses truchat/true-cars widget only (#tc-fab). */
  mount(){
    this._purgeLegacy();
    return;
  },

  _purgeLegacy(){
    document.querySelectorAll(
      '.fab-luna, .fab-btn.fab-luna, .luna-strip, .chat-panel, .fab-rail, .luna-fab, .chat-fab'
    ).forEach(function(el){
      if(el.closest && el.closest('#tc-widget-root')) return;
      el.remove();
    });
  },

  openWith(text){
    this._purgeLegacy();
    if(window.TrueCarsTruChatWidget && typeof window.TrueCarsTruChatWidget.open==='function'){
      window.TrueCarsTruChatWidget.open();
      return;
    }
    if(TCSA.loadTruChat){
      TCSA.loadTruChat(function(){
        if(window.TrueCarsTruChatWidget) window.TrueCarsTruChatWidget.open();
      });
    }
  },
  body(){ return document.getElementById('chatBody'); },
  say(html,who){ const m=document.createElement('div'); m.className='msg '+(who||'bot'); m.innerHTML=html; this.body().appendChild(m); this.scroll(); return m; },
  quick(opts){ const q=document.createElement('div'); q.className='msg-quick'; opts.forEach(o=>{ const b=document.createElement('button'); b.textContent=o; b.onclick=()=>{ this.say(o,'user'); q.remove(); setTimeout(()=>this.respond(o),300); }; q.appendChild(b); }); this.body().appendChild(q); this.scroll(); },
  typing(){ const t=document.createElement('div'); t.className='chat-typing'; t.innerHTML='<i></i><i></i><i></i>'; this.body().appendChild(t); this.scroll(); return t; },
  scroll(){ const b=this.body(); b.scrollTop=b.scrollHeight; },
  botThen(fn,delay){ const t=this.typing(); setTimeout(()=>{ t.remove(); fn(); },delay||650); },

  greet(){
    const lang=(TCSA.i18n&&TCSA.i18n.lang)||'en';
    const g={
      en:{ msg:`Sawubona / Molo / Hi there! 👋 I'm <b>TruChat</b>, your True-Cars SA assistant — always here to help.<br><br>I can <b>find your perfect car</b>, work out <b>monthly finance</b>, get a <b>free trade-in value</b>, explain our <b>TruOrbit + VIR</b>, or tell you about our <b>free countrywide delivery</b>. What would you like to do?`,
           q:['Help me find a car','Work out finance','Value my trade-in','Free nationwide delivery'] },
      af:{ msg:`Hallo! 👋 Ek is <b>TruChat</b>, jou True-Cars SA-assistent. Ek kan 'n motor vir jou vind, finansiering uitwerk, jou inruil waardeer of aflewering reël. Waarmee kan ek help?`,
           q:["Vind vir my 'n motor",'Werk finansiering uit','Waardeer my inruil','Gratis landwye aflewering'] },
      xh:{ msg:`Molo! 👋 NdinguTruChat, umncedisi wakho we-True-Cars SA. Ndingakufumanela imoto, ndenze imali-mboleko, ndixabise imoto yakho, okanye ndihlele ukuhanjiswa kwamahhala. Ungathanda ntoni?`,
           q:['Ndifumanele imoto','Yenza imali-mboleko','Xabisa imoto yam','Ukuhanjiswa kwamahhala'] }
    };
    const p=g[lang]||g.en;
    this.botThen(()=>{ this.say(p.msg); this.quick(p.q); },500);
  },

  respond(text){
    const t=text.toLowerCase();
    const c=this.ctx;

    /* ── Finance application stages ── */
    if(c.stage==='fin_income'){
      const num=parseFloat(text.replace(/[^\d.]/g,''));
      if(!num||num<2000) return this.botThen(()=>{ this.say(`I didn't quite catch that — could you please enter your gross monthly income as a number? For example: <b>25000</b>`); });
      c.fin.income=num;
      c.stage='fin_deposit';
      const cap=TCSA.fmtPrice(Math.round(num*0.3*72));
      return this.botThen(()=>{
        this.say(`Thank you! With a gross income of <b>${TCSA.fmtPrice(num)}/mo</b>, banks typically qualify you for a vehicle up to approximately <b>${cap}</b> (30% of income over 72 months — subject to credit approval).`);
        this.say(`How much deposit are you able to put down? Please type an amount, or choose:`);
        this.quick(['R0 — no deposit','R10 000','R25 000','R50 000+']);
      });
    }

    if(c.stage==='fin_deposit'){
      const dep=/r0|no deposit|zero/.test(t)?0:(parseFloat(text.replace(/[^\d.]/g,''))||0);
      c.fin.deposit=dep;
      c.stage='fin_term';
      return this.botThen(()=>{
        this.say(`Understood — deposit of <b>${TCSA.fmtPrice(dep)}</b>. What repayment term would you prefer?`);
        this.quick(['48 months (4 years)','60 months (5 years)','72 months (6 years)']);
      });
    }

    if(c.stage==='fin_term'){
      const term=t.includes('48')?48:t.includes('60')?60:72;
      c.fin.term=term;
      c.stage='fin_name';
      const r=0.00979167;
      const pv=(c.fin.income*0.28)*(1-Math.pow(1+r,-term))/r;
      const maxPrice=Math.round(pv+c.fin.deposit);
      c.fin.maxPrice=maxPrice;
      return this.botThen(()=>{
        this.say(`Based on your income of <b>${TCSA.fmtPrice(c.fin.income)}/mo</b>, a deposit of <b>${TCSA.fmtPrice(c.fin.deposit)}</b> and a <b>${term}-month</b> term at 11.75% — you're likely looking at:<div class="fin-result"><span class="fin-max">${TCSA.fmtPrice(maxPrice)}</span><span class="fin-lbl">estimated vehicle budget</span></div>`);
        this.say(`This is an indicative estimate and doesn't affect your credit score. To get a <b>real pre-approval</b> from our Seriti F&I desk (Wesbank, Absa, FNB, Nedbank, MFC), I just need a couple of details.`);
        this.say(`What's your name, please?`);
      },900);
    }

    if(c.stage==='fin_name'){
      c.lead.name=text;
      c.stage='fin_phone';
      return this.botThen(()=>{ this.say(`A pleasure, <b>${text.split(' ')[0]}</b>! What's the best mobile number for our F&I consultant to reach you on?`); });
    }

    if(c.stage==='fin_phone'){
      c.lead.phone=text; c.stage='idle';
      const rec=TCSA.leads.add({source:'Finance Pre-approval',name:c.lead.name,phone:c.lead.phone,finBudget:c.fin.maxPrice});
      const price=c.fin.maxPrice;
      const matches=TCSA.vehicles.filter(v=>v.price<=price*1.05&&!v.premium).slice(0,3);
      return this.botThen(()=>{
        this.say(`You're all set ✅ Reference <b>${rec.id}</b>. Our F&I consultant will WhatsApp you — usually within the hour during business hours. Thank you, ${c.lead.name.split(' ')[0]}!`);
        if(matches.length){
          this.say(`While you wait, here are some great options within your budget:`);
          matches.forEach(v=>{ const d=TCSA.priceDelta(v); const tag=d.below?` · <b style="color:var(--teal-deep)">${TCSA.fmtPrice(d.amount)} below TruPrice</b>`:''; this.say(`<b>${v.year} ${v.make} ${v.model}</b><br>${v.variant} · ${v.km.toLocaleString('en-ZA')} km${tag}<br><a href="vehicle.html?id=${v.id}" style="color:var(--blue);font-weight:700">View 360° →</a>`); });
        }
        this.quick(['Browse more cars','How does delivery work?','Talk to a human']);
        c.lead={}; c.fin={};
      },900);
    }

    /* ── Lead capture stages ── */
    if(c.stage==='ask_name'){ c.lead.name=text; c.stage='ask_phone'; return this.botThen(()=>{ this.say(`A pleasure, <b>${text.split(' ')[0]}</b>! What's the best mobile number for our team to reach you on?`); }); }
    if(c.stage==='ask_phone'){ c.lead.phone=text; c.stage='idle'; const rec=TCSA.leads.add(Object.assign({source:c.lead.source||'Chatbot'},c.lead)); return this.botThen(()=>{ this.say(`You're booked in ✅ Reference <b>${rec.id}</b>. Our team will be in touch shortly — thank you so much!`); this.quick(['Browse cars','Work out finance','Ask me something']); c.lead={}; }); }

    /* ── Needs assessment stages ── */
    if(c.stage==='needs_body'){
      c.lead.body=(/suv|cross/.test(t)?'suv':/sedan/.test(t)?'sedan':/hatch/.test(t)?'hatch':/bakkie|4x4/.test(t)?'bakkie':/coupe|sport/.test(t)?'coupe':null);
      c.stage='needs_budget';
      return this.botThen(()=>{ this.say(`Wonderful choice! And what's your approximate budget?`); this.quick(['Under R250 000','R250k – R500k','R500k – R1 million','R1 million+']); });
    }
    if(c.stage==='needs_budget'){
      const max=/under|r250|250 000/.test(t)?250000:/500k|r500/.test(t)?500000:/r1m|1 mil|million\+|r1 000/.test(t)?99000000:1000000;
      c.lead.maxPrice=max;
      c.stage='needs_fuel';
      return this.botThen(()=>{ this.say(`Almost there! Any fuel preference?`); this.quick(['Petrol','Diesel','Electric / Hybrid','No preference']); });
    }
    if(c.stage==='needs_fuel'){
      const fuel=/diesel/.test(t)?'Diesel':/electric|hybrid/.test(t)?'Electric':/petrol/.test(t)?'Petrol':null;
      c.stage='idle';
      return this.stock({body:c.lead.body,maxPrice:c.lead.maxPrice,fuel});
    }

    /* ── Intent routing ── */
    if(/trade|sell my|value my|what.*worth/.test(t)) return this.tradeIn();
    if(/finance|instal|monthly|afford|pre.?approv|repay|pre.?qual|loan|bond/.test(t)) return this.financeApp();
    if(/lvs|live view|video call|walk.?around|stream/.test(t)) return this.lvs();
    if(/vir|360|spin|inspect|damage|condition|report/.test(t)) return this.vir();
    if(/deliver|nationwide|ship|bring.*car|countrywide|free ship/.test(t)) return this.deliveryInfo();
    if(/human|agent|call me|speak|contact me|sales person|real person/.test(t)) return this.human();
    if(/truecar price|truprice|cost saving|below market|good deal|savings|benchmark/.test(t)) return this.costSavingsInfo();
    if(/delivery map|show.*map|map.*deliver/.test(t)){ window.location.href='#delivery'; return this.botThen(()=>{ this.say(`I've scrolled you down to our <b>interactive delivery map</b>! Click any province to see the estimated delivery time. 🗺️`); this.quick(['Find me a car','Work out finance']); }); }
    if(/premium|luxury|g.?63|porsche|ferrari|rolls|bentley|lambo|aston|cullinan|maybach|puros/.test(t)) return this.stock({premium:true,perf:false});
    if(/performance|m4|m5|m3|amg|gt[i3s]|hot hatch|fast car|sports car/.test(t)) return this.stock({perf:true});
    if(/ev|electric|byd|hybrid/.test(t)) return this.stock({fuel:'Electric'});
    if(/bakkie|hilux|4x4|4×4|truck/.test(t)) return this.stock({body:'bakkie'});
    if(/budget|affordable|entry|cheap|first car|polo|under r/.test(t)) return this.stock({maxPrice:300000});
    if(/find|help.*car|looking|recommend|suggest|show me|what.*have|suv|sedan|hatch|inventory|stock/.test(t)) return this.needsFlow();
    if(/truecars|platform|modules|dms|system|technology behind/i.test(t)) return this.botThen(()=>{
      this.say(`<b>TruSaaS</b> is the dealer technology platform powering everything you see here — the 360° spin, VIR reports, TruChat (that's me 👋), live video walkarounds, DMS, CRM, and multi-portal listings. <a href="technology.html" style="color:var(--blue);font-weight:700">Explore the full platform →</a>`);
      this.quick(['Show me the TruOrbit + VIR','Book a live viewing','Find me a car']);
    });
    if(/whatsapp/.test(t)) return this.human();
    if(/hi|hello|sawubona|howzit|hey|thanks|thank you|pleasure|lekker|great|wow/.test(t)) return this.botThen(()=>{ this.say(`Thank you — it's truly my pleasure! 😊 Is there anything else I can help you with?`); this.quick(['Help me find a car','Work out finance','Free delivery info']); });

    const hit=TCSA.vehicles.find(v=>t.includes(v.model.toLowerCase().split(' ')[0])||t.includes(v.make.toLowerCase()));
    if(hit) return this.showVehicle(hit);
    return this.botThen(()=>{ this.say(`I'd love to assist! I'm best at <b>finding cars</b>, <b>finance pre-approval</b>, <b>trade-in valuations</b>, <b>VIR explained</b>, and our <b>free nationwide delivery</b>. Which one can I help with today?`); this.quick(['Help me find a car','Work out finance','Value my trade-in','Free delivery info']); });
  },

  needsFlow(){ this.ctx.stage='needs_body'; this.botThen(()=>{ this.say(`I'd love to help you find the perfect car! Let's narrow it down together. Which body style appeals to you most?`); this.quick(['SUV / Crossover','Sedan','Hatchback','Bakkie / 4x4','Coupe / Sportscar']); }); },

  stock(f){
    f=f||{};
    let list=TCSA.vehicles.slice();
    if(f.premium===true&&!f.perf) list=list.filter(v=>v.premium&&v.price>=2000000);
    else if(f.perf) list=list.filter(v=>v.premium&&v.price<2000000&&['coupe','sedan'].includes(v.body));
    else if(f.fuel) list=list.filter(v=>v.fuel===f.fuel);
    else if(f.body) list=list.filter(v=>v.body===f.body);
    if(f.maxPrice) list=list.filter(v=>v.price<=f.maxPrice);
    if(f.q) list=list.filter(v=>(v.make+' '+v.model).toLowerCase().includes(f.q));
    if(!f.perf&&!f.premium&&f.fuel) list=list.filter(v=>v.fuel===f.fuel);
    if(!f.perf&&!f.premium&&f.body) list=list.filter(v=>v.body===f.body);
    list=list.slice(0,3);
    this.botThen(()=>{
      if(!list.length){ this.say(`I don't have an exact match right now — but new stock arrives daily! Would you like me to let our team know to look out for something perfect for you?`); this.quick(['Yes, notify me','Broaden my search','Talk to a human']); return; }
      const label=f.perf?'performance beauties 🏎️':f.premium?'hand-curated True Premium vehicles ✨':'great options';
      this.say(`Excellent taste! Here are some ${label} — all with a full TruOrbit + VIR inspection and <b>free nationwide delivery</b>:`);
      list.forEach(v=>{
        const d=TCSA.priceDelta(v);
        const tag=d.below?` · <b style="color:var(--teal-deep)">${TCSA.fmtPrice(d.amount)} below TruPrice</b>`:' · <span style="color:var(--ok)">✓ Fair TruPrice</span>';
        this.say(`<b>${v.year} ${v.make} ${v.model}</b><br>${v.variant} · ${v.km.toLocaleString('en-ZA')} km${tag}<br><a href="vehicle.html?id=${v.id}" style="color:var(--blue);font-weight:700">View 360° & VIR →</a>`);
      });
      this.quick(['Work out finance','Book a live viewing','Browse all vehicles']);
    },750);
  },

  showVehicle(v){ this.botThen(()=>{ const m=TCSA.monthly(v.price); const d=TCSA.priceDelta(v); const sav=d.below?`<br>💰 <b style="color:var(--teal-deep)">${TCSA.fmtPrice(d.amount)} below TrueCar market price</b>`:''; this.say(`Wonderful choice! 😊<br><b>${v.year} ${v.make} ${v.model}</b> — ${v.variant}<br>Asking: <b>${TCSA.fmtPrice(v.price)}</b> · ~<b>${TCSA.fmtPrice(m)}/mo</b>${sav}<br>VIR score: <b>${v.vir}/100</b>${v.lvs?' · Live viewing available 🎥':''}<br><a href="vehicle.html?id=${v.id}" style="color:var(--blue);font-weight:700">View full TruOrbit + VIR →</a>`); this.quick(["Work out finance on this","Book a live viewing","What's TruPrice?"]); }); },

  financeApp(){ this.ctx.fin={}; this.ctx.lead.source='Finance Pre-approval'; this.botThen(()=>{ this.say(`Of course — let me help you find out exactly what you qualify for! Our F&I desk works with all major SA banks: <b>Wesbank, Absa, FNB, Nedbank and MFC</b>.`); this.say(`This won't affect your credit score at all. To give you an accurate estimate, could you please tell me your <b>gross monthly income</b> (before tax)?`); this.ctx.stage='fin_income'; }); },

  tradeIn(){ this.ctx.lead.source='Trade-in'; this.botThen(()=>{ this.say(`Absolutely — we'll buy your car even if you don't buy from us! Fair, fast and completely hassle-free 🤝`); this.say(`Our True-Cars trade-in valuation is benchmarked against live market data, so you'll always receive a fair offer. Our clients are often pleasantly surprised by what we offer!`); this.quick(['Get my instant online estimate','Book a scan & valuation','Talk to a human']); }); },

  lvs(){ this.botThen(()=>{ this.say(`<b>LVS — Live Video Stream</b> 🎥<br>A True-Cars product specialist does a live walk-around on a video call — on <em>your</em> schedule, from wherever you are in South Africa.`); this.say(`You can ask them to show the engine bay, tyres, underbody, boot space, interior — anything you'd want to check in person. No surprises on collection day, guaranteed.`); this.say(`When would suit you best for a live viewing?`); this.quick(['Today','This weekend','Book me in now','Tell me more first']); }); },

  vir(){ this.botThen(()=>{ this.say(`🔍 <b>VIR — Verified Inspection Report</b><br>Every True-Cars SA vehicle is independently inspected and scored out of 100. The full report covers:`); this.say(`• <b>360° exterior spin</b> — drag to rotate the car, tap any flagged mark to see the close-up photo and description<br>• <b>Damage hotspots</b> — every scratch, scuff and dent documented with GPS-tagged photos<br>• <b>Mechanical checklist</b> — service history, fluids, tyres, brakes, test drive notes<br>• <b>VIR score / 100</b> — so you can compare vehicles at a glance with total confidence`); this.say(`Would you like me to open a live TruOrbit + VIR example for you?`); this.quick(['Show me a 360° car','Book a live viewing','Find me a car']); }); },

  deliveryInfo(){ this.botThen(()=>{ this.say(`🚚 <b>Countrywide Free Delivery — R0 fee, door to door, anywhere in SA</b><br>We deliver on enclosed transporters for full protection. Here's what to expect:`); this.say(`📍 <b>Cape Town & surrounds</b> — same-day or next morning<br>📍 <b>Gauteng, KZN, Eastern Cape</b> — 1–2 business days<br>📍 <b>Free State, Mpumalanga, North West</b> — 1–2 business days<br>📍 <b>Limpopo, Northern Cape</b> — 2–3 business days`); this.say(`Payment is completed before dispatch, and you'll receive live GPS tracking of your vehicle. Would you like to explore the delivery map, or can I help you find your next car?`); this.quick(['Find me a car','Work out finance','Talk to a human']); }); },

  costSavingsInfo(){ this.botThen(()=>{ this.say(`💡 <b>TruPrice — Total Transparency</b><br>For every vehicle in our inventory, we run a real-time market analysis comparing similar make, model, year, and km across all SA listings.`); this.say(`This gives us the <b>TruPrice</b> — what a genuinely fair market price looks like. When our asking price is <em>below</em> the TruPrice, we badge it as a <b>"True-Cars Deal"</b>.<br><br>No negotiation anxiety. No hidden margins. Just a fair price, every time.`); this.quick(['Show me True-Cars Deals','Find me a car','Work out finance']); }); },

  human(){ this.ctx.lead.source='Chatbot'; this.botThen(()=>{ this.say(`Of course — our team is friendly and always happy to help! You can WhatsApp us right now on <b>${TCSA.brandPhoneDisplay}</b>, or leave your details and we'll call you back promptly.`); const w=document.createElement('div'); w.className='msg-quick'; w.innerHTML=`<button onclick="window.open('https://wa.me/${TCSA.brandPhone.replace('+','')}','_blank')">💬 Open WhatsApp</button><button id="cbLeave">Leave my details</button>`; this.body().appendChild(w); this.scroll(); document.getElementById('cbLeave').onclick=()=>{ w.remove(); this.startCapture(); }; }); },

  startCapture(src){ if(src) this.ctx.lead.source=src; this.ctx.stage='ask_name'; this.botThen(()=>{ this.say(`Not a problem at all! Let's get you connected with our team. Could I please have your name?`); }); },
};

/* Any element with data-chat="..." opens the bot with that message */
TCSA.initChatTriggers = function(){
  document.addEventListener('click',(e)=>{
    const el=e.target.closest('[data-chat]');
    if(!el) return;
    e.preventDefault();
    /* Prefer True-Cars TruChat widget */
    if(window.TrueCarsTruChatWidget && typeof window.TrueCarsTruChatWidget.open==='function'){
      window.TrueCarsTruChatWidget.open();
      return;
    }
    if(TCSA.chat && typeof TCSA.chat.openWith==='function'){
      TCSA.chat.openWith(el.getAttribute('data-chat')||'');
    }
  });
};

/** Load True-Cars TruChat (True) once */
TCSA.loadTruChat = function(done){
  if(window.__TRUECARS_TRUCHAT_WIDGET__ || document.getElementById('tc-widget-root')){
    if(done) done();
    return;
  }
  var base = 'truchat/';
  function load(src, attrs, next){
    var s = document.createElement('script');
    s.src = src;
    if(attrs) Object.keys(attrs).forEach(function(k){ s.setAttribute(k, attrs[k]); });
    s.onload = function(){ next && next(); };
    s.onerror = function(){ console.warn('[TCSA] TruChat load failed', src); next && next(); };
    document.body.appendChild(s);
  }
  load(base + 'shared/qualifier.js?v=3', null, function(){
    load(base + 'shared/chat-core.js?v=5', null, function(){
      load(base + 'true-cars/config.js?v=4', null, function(){
        load(base + 'true-cars/widget.js?v=4', { 'data-bottom': '24px', 'data-position': 'right' }, function(){
          if(done) done();
        });
      });
    });
  });
};

/* ============================================================
   PREMIUM UX — scroll progress, page transitions, 3D tilt,
   magnetic button glow, card spotlight, ambient particles
   ============================================================ */

/* Scroll progress bar */
TCSA.scrollProgress = function(){
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if(h > 0) bar.style.transform = `scaleX(${window.scrollY / h})`;
  };
  window.addEventListener('scroll', update, {passive:true});
  update();
};

/* Page transition — intercept internal links */
TCSA.pageTransitions = function(){
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if(!a || a.target === '_blank' || a.getAttribute('href').startsWith('#') || a.getAttribute('href').startsWith('http') || a.getAttribute('href').startsWith('javascript') || e.metaKey || e.ctrlKey) return;
    const href = a.getAttribute('href');
    if(!href.endsWith('.html') && !href.includes('.html?')) return;
    e.preventDefault();
    document.body.classList.add('page-leaving');
    setTimeout(() => { window.location.href = href; }, 250);
  });
};

/* 3D tilt on vehicle cards */
TCSA.cardTilt = function(){
  if(matchMedia('(pointer:coarse)').matches) return;
  document.addEventListener('mousemove', e => {
    const card = e.target.closest('.vcard');
    if(!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.classList.add('tilt-active');
    card.style.transform = `perspective(800px) rotateY(${x*6}deg) rotateX(${-y*6}deg) translateY(-6px)`;
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
  document.addEventListener('mouseleave', e => {
    const card = e.target.closest('.vcard');
    if(card){ card.classList.remove('tilt-active'); card.style.transform = ''; }
  }, true);
};

/* Magnetic glow on gradient buttons */
TCSA.btnGlow = function(){
  if(matchMedia('(pointer:coarse)').matches) return;
  document.addEventListener('mousemove', e => {
    const btn = e.target.closest('.btn-grad');
    if(!btn) return;
    const r = btn.getBoundingClientRect();
    btn.style.setProperty('--bx', (e.clientX - r.left) + 'px');
    btn.style.setProperty('--by', (e.clientY - r.top) + 'px');
  });
};

/* Ambient particles in hero */
TCSA.heroParticles = function(){
  const hero = document.querySelector('header.hero');
  if(!hero || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const container = document.createElement('div');
  container.className = 'hero-particles';
  hero.querySelector('.hero-scene').appendChild(container);
  for(let i = 0; i < 18; i++){
    const p = document.createElement('i');
    const dur = 6 + Math.random() * 10;
    const left = Math.random() * 100;
    const delay = Math.random() * dur;
    const size = 2 + Math.random() * 3;
    const drift = -40 + Math.random() * 80;
    p.style.cssText = `left:${left}%;bottom:-${size}px;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;--drift:${drift}px;`;
    if(Math.random() > 0.6) p.style.background = 'rgba(20,102,224,.4)';
    container.appendChild(p);
  }
};

/* Parallax depth on hero layers */
TCSA.heroParallax = function(){
  const hero = document.querySelector('header.hero');
  if(!hero || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const sky = hero.querySelector('.hero-sky');
  const sun = hero.querySelector('.hero-sun');
  const mountains = hero.querySelector('.hero-mountains');
  const grid = hero.querySelector('.hero-grid');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const s = window.scrollY;
      if(s < window.innerHeight * 1.2){
        if(sky) sky.style.transform = `translateY(${s * 0.15}px)`;
        if(sun) sun.style.transform = `translateY(${s * 0.25}px) scale(${1 + s * 0.0003})`;
        if(mountains) mountains.style.transform = `translateY(${s * 0.08}px)`;
        if(grid) grid.style.transform = `translateY(${s * 0.1}px)`;
      }
      ticking = false;
    });
  }, {passive:true});
};

/* ============================================================
   ELEGANT FLOATING DEMO CTA — Auto-injected on every page
   Expandable pill · Dismissible · WhatsApp green · Remembers choice
   ============================================================ */
/* Green floating "Book a free demo" WhatsApp pill — disabled */
TCSA.demoFloat = function(){ return; };

/* ============================================================
   Floating Action Group — WhatsApp · Test Drive · LVS
   Brand-coloured, expandable pill on bottom-left
   ============================================================ */
/* Right-side floating FAB rail disabled (WA / test drive / LVS / AI call / Luna) */
TCSA.waFab = function(){
  /* Remove every legacy floating control; keep only True-Cars TruChat (#tc-widget-root) */
  document.querySelectorAll(
    '.fab-rail, .fab-btn, .demo-float, .tcsa-sticky-wa, .luna-fab, .chat-fab, .fab-luna, .luna-strip, .chat-panel, a.fab-wa'
  ).forEach(function(el){
    if(el.closest && el.closest('#tc-widget-root')) return;
    if(el.id === 'tc-fab' || el.id === 'tc-panel' || el.id === 'tc-tip') return;
    el.remove();
  });
  if(TCSA.chat && typeof TCSA.chat._purgeLegacy==='function') TCSA.chat._purgeLegacy();
};

/* ============================================================
   AI RECEPTIONIST — simulated inbound-call demo
   ============================================================ */
TCSA.openAiCall = function(){
  if (document.getElementById('aiCallOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'aiCallOverlay'; overlay.className = 'ai-call-overlay';
  overlay.innerHTML = `
    <div class="ai-call-modal" role="dialog" aria-label="AI Receptionist demo">
      <button class="ai-call-x" aria-label="Close">&#10005;</button>
      <div class="ai-call-head">
        <div class="ai-call-avatar">
          <span class="ai-call-ring r1"></span><span class="ai-call-ring r2"></span><span class="ai-call-ring r3"></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
        </div>
        <div class="ai-call-who">
          <div class="ai-call-name">TruVoice · AI Receptionist</div>
          <div class="ai-call-num" id="aiCallStatus">Dialling <b>+27 62 050 2091</b>…</div>
        </div>
        <div class="ai-call-timer" id="aiCallTimer">00:00</div>
      </div>
      <div class="ai-call-transcript" id="aiCallTx"></div>
      <div class="ai-call-actions">
        <a class="ai-call-btn ai-call-real" href="tel:+27620502091"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg><span>Call for real</span></a>
        <button class="ai-call-btn ai-call-hangup" id="aiCallHang"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5a12 12 0 0 0-8.5 3.5c-.7.7-1 1.7-.7 2.6l.7 2.6c.2.8.9 1.4 1.7 1.4h2.6c.9 0 1.6-.6 1.7-1.4l.4-1.7a10 10 0 0 1 3.9 0l.4 1.7c.1.8.8 1.4 1.7 1.4h2.6c.8 0 1.5-.6 1.7-1.4l.7-2.6c.3-.9 0-1.9-.7-2.6A12 12 0 0 0 12 5z"/></svg><span>Hang up</span></button>
      </div>
      <div class="ai-call-footer"><span class="ai-call-brand">Powered by <b>TruVoice</b> · voice AI on the TruSaaS platform</span></div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('show'));

  const close = () => { overlay.classList.remove('show'); setTimeout(()=>overlay.remove(), 320); };
  overlay.querySelector('.ai-call-x').addEventListener('click', close);
  overlay.querySelector('#aiCallHang').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  /* Timer + status transitions */
  const status = overlay.querySelector('#aiCallStatus');
  const timer = overlay.querySelector('#aiCallTimer');
  const tx = overlay.querySelector('#aiCallTx');
  let secs = 0, ivalT;
  setTimeout(()=>{ status.innerHTML = 'Connected · <b>+27 62 050 2091</b>'; overlay.querySelector('.ai-call-head').classList.add('live'); ivalT = setInterval(()=>{ secs++; timer.textContent = String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0'); }, 1000); playScript(); }, 1600);

  /* Scripted convo — feels like an actual call */
  const script = [
    { who:'ai',   t:"True-Cars SA, this is TruVoice — how can I help?" , delay: 400 },
    { who:'user', t:"Hi, do you have any Toyota Fortuners under R600k?", delay: 2200 },
    { who:'ai',   t:"Let me check the live inventory… I see three matches. A 2021 Fortuner 4×4 Auto at R579,900 with 65,000 km, a 2020 4×2 Manual at R495,000, and a 2022 GX 2.4 at R610,000.", delay: 1800 },
    { who:'user', t:"Can you WhatsApp me the shortlist?", delay: 3200 },
    { who:'ai',   t:"Absolutely. What's the best number for you?", delay: 900 },
    { who:'user', t:"Same one I called from.", delay: 2000 },
    { who:'ai',   t:"Perfect — sending now, with TruOrbit + VIRs, TruPrice benchmarks and finance calculators. Anything else?", delay: 1400 },
    { who:'user', t:"That's it, thanks.", delay: 2400 },
    { who:'ai',   t:"Pleasure. Look out for the WhatsApp in a few seconds. Have a great one.", delay: 900 }
  ];
  function bubble(who, text){
    const b = document.createElement('div');
    b.className = 'ai-call-bubble ' + who;
    b.innerHTML = `<span class="tag">${who==='ai'?'TruVoice':'Caller'}</span><span class="txt"></span>`;
    tx.appendChild(b);
    tx.scrollTop = tx.scrollHeight;
    typeInto(b.querySelector('.txt'), text);
  }
  function typeInto(el, text){
    let i=0; const step = () => {
      el.textContent = text.slice(0, ++i);
      tx.scrollTop = tx.scrollHeight;
      if (i < text.length) setTimeout(step, 18 + Math.random()*22);
    }; step();
  }
  function playScript(){
    let acc = 0;
    script.forEach(m => { acc += m.delay; setTimeout(()=>{ if (!overlay.isConnected) return; bubble(m.who, m.t); }, acc); });
  }
};

/* ============================================================
   POLISH — scroll indicator, cursor glow, back-to-top, ripple
   ============================================================ */

/* Hero scroll indicator — subtle chevron telling users to scroll */
TCSA.scrollIndicator = function(){
  const hero = document.querySelector('header.hero');
  if(!hero || hero.querySelector('.hero-scroll-indicator')) return;
  const el = document.createElement('div');
  el.className = 'hero-scroll-indicator';
  el.innerHTML = '<span class="si-label">Scroll</span><span class="si-chev"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>';
  hero.appendChild(el);
};

/* Cursor glow — subtle gradient orb following the mouse on desktop */
TCSA.cursorGlow = function(){
  if(matchMedia('(pointer:coarse)').matches || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);
  let timer;
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    if(!glow.classList.contains('show')) glow.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => glow.classList.remove('show'), 3000);
  });
  document.addEventListener('mouseleave', () => glow.classList.remove('show'));
};

/* Back to top button */
TCSA.backToTop = function(){
  if(document.querySelector('.back-to-top')) return;
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 15l-6-6-6 6"/></svg>';
  btn.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  document.body.appendChild(btn);
  let ticking = false;
  window.addEventListener('scroll', () => {
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      btn.classList.toggle('visible', window.scrollY > window.innerHeight * 0.6);
      ticking = false;
    });
  }, {passive:true});
};

/* Ripple effect on clickable elements */
TCSA.btnRipple = function(){
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn, .qs-go, .ax-modtile, .prod-card, .chip, .vtag');
    if(!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
};

/* Auto-format number inputs with thousand separators */
TCSA.inputFormat = function(){
  document.querySelectorAll('input[inputmode="numeric"]').forEach(input => {
    const format = () => {
      const raw = input.value.replace(/\D/g, '');
      if(raw) input.value = parseInt(raw, 10).toLocaleString('en-ZA');
      else input.value = '';
    };
    input.addEventListener('blur', format);
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^\d\s]/g, '');
    });
  });
};

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  TCSA.upgradeBrand();
  TCSA.i18n.init();
  TCSA.initChrome();
  TCSA.markActiveNav();
  /* Kill legacy Luna/rail FABs first, then load True-Cars TruChat only */
  TCSA.waFab();
  if(!document.body.hasAttribute('data-no-chat') && TCSA.loadTruChat){
    TCSA.loadTruChat(function(){
      TCSA.waFab(); /* second pass after async load — never re-add Luna */
      if(TCSA.initChatTriggers) try { TCSA.initChatTriggers(); } catch(e){}
    });
  }
  TCSA.leads.seedIfEmpty();
  TCSA.scrollProgress();
  TCSA.pageTransitions();
  TCSA.cardTilt();
  TCSA.btnGlow();
  TCSA.heroParticles();
  TCSA.heroParallax();
  TCSA.scrollIndicator();
  TCSA.cursorGlow();
  TCSA.backToTop();
  TCSA.btnRipple();
  TCSA.inputFormat();
});

/* ---------------- Active nav highlight ---------------- */
TCSA.markActiveNav = function(){
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a=>{
    const href = (a.getAttribute('href')||'').split('#')[0].split('/').pop().toLowerCase();
    if(href && href===page) a.classList.add('active');
  });
};
