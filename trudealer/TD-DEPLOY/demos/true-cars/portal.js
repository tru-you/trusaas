function checkPin(){
  var pin=document.getElementById('gate-pin').value;
  var inp=document.getElementById('gate-pin');
  if(pin==='1234'||pin==='trucars'||pin==='TruSaaS'){
    document.getElementById('demo-gate').classList.add('hidden');
    sessionStorage.setItem('tc-demo','1');
  } else {
    inp.classList.add('err');
    inp.value='';
    setTimeout(function(){inp.classList.remove('err');},400);
  }
}
document.getElementById('gate-pin').addEventListener('keydown',function(e){if(e.key==='Enter')checkPin();});
if(sessionStorage.getItem('tc-demo')==='1'){document.getElementById('demo-gate').classList.add('hidden');}
/* ============================================================
   TCSA — self-contained data/utility layer for this demo page
   ============================================================ */
window.TCSA = (function(){
  const LEADS_KEY='tcsa_leads_v1';
  const INV_KEY='tcsa_inventory_v1';

  function loadJSON(key){
    let arr;
    try{ arr = JSON.parse(localStorage.getItem(key))||[]; }catch(e){ arr = []; }
    /* backfill ids for any rows saved by an older version of this page */
    let needsSave = false;
    arr.forEach(item=>{ if(!item.id){ item.id = 'x_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); needsSave = true; } });
    if(needsSave) saveJSON(key, arr);
    return arr;
  }
  function saveJSON(key,arr){ try{ localStorage.setItem(key, JSON.stringify(arr)); }catch(e){} }

  const leads = {
    KEY: LEADS_KEY,
    all(){ return loadJSON(LEADS_KEY).sort((a,b)=> new Date(b.created) - new Date(a.created)); },
    add(lead){
      const arr = loadJSON(LEADS_KEY);
      const full = Object.assign({
        id: 'ld_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        created: new Date().toISOString(),
        status: 'New'
      }, lead);
      arr.unshift(full);
      saveJSON(LEADS_KEY, arr);
      window.dispatchEvent(new CustomEvent('tcsa:lead', {detail: full}));
      return full;
    },
    setStatus(id, status){
      const arr = loadJSON(LEADS_KEY);
      const l = arr.find(x=>x.id===id);
      if(l){ l.status = status; saveJSON(LEADS_KEY, arr); }
      return l;
    },
    seedIfEmpty(){
      if(loadJSON(LEADS_KEY).length) return;
      const now = Date.now();
      const seed = [
        {id:'ld_seed1', name:'Thabo Mokoena', source:'TruChat Chat', intent:'BYD Atto 3 — comparing to Kia Niro EV', value:'R620k', phone:'+27 82 118 4432', status:'New', created:new Date(now-1000*60*12).toISOString()},
        {id:'ld_seed2', name:'Amanda Fischer', source:'Finance', intent:'Pre-approval enquiry — Ranger Wildtrak', value:'R810k', phone:'+27 83 550 7712', status:'New', created:new Date(now-1000*60*47).toISOString()},
        {id:'ld_seed3', name:'Kabelo Radebe', source:'Trade-in', intent:'Trade 2019 Fortuner → Everest', value:'R690k', phone:'+27 71 990 2231', status:'Qualified', created:new Date(now-1000*60*60*2).toISOString()},
        {id:'ld_seed4', name:'Zanele Khumalo', source:'360° Enquiry', intent:'Corolla Cross — 360° spin viewed 3x', value:'R470k', phone:'+27 84 302 5510', status:'Contacted', created:new Date(now-1000*60*60*5).toISOString()},
        {id:'ld_seed5', name:'Werner Steyn', source:'Website', intent:'Test drive request — Polo Vivo', value:'R310k', phone:'+27 76 641 8890', status:'Won', created:new Date(now-1000*60*60*20).toISOString()}
      ];
      saveJSON(LEADS_KEY, seed);
    }
  };

  const inventory = {
    KEY: INV_KEY,
    all(){ return loadJSON(INV_KEY); },
    save(arr){ saveJSON(INV_KEY, arr); },
    add(v){
      const arr = loadJSON(INV_KEY);
      const full = Object.assign({ id:'v_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6) }, v);
      arr.unshift(full);
      saveJSON(INV_KEY, arr);
      return full;
    },
    setStatus(id, status){
      const arr = loadJSON(INV_KEY);
      const v = arr.find(x=>x.id===id);
      if(v){ v.status = status; saveJSON(INV_KEY, arr); }
      return v;
    },
    remove(id){
      const arr = loadJSON(INV_KEY).filter(x=>x.id!==id);
      saveJSON(INV_KEY, arr);
    },
    seedIfEmpty(){
      if(loadJSON(INV_KEY).length) return;
      const seed = [
        {id:'v1', year:2024, make:'VW', model:'Golf GTI', body:'hatch', price:620000, status:'Published'},
        {id:'v2', year:2023, make:'Toyota', model:'Hilux Legend RS', body:'bakkie', price:759000, status:'Published'},
        {id:'v3', year:2024, make:'BYD', model:'Dolphin', body:'hatch', price:539000, status:'VIR ready'},
        {id:'v4', year:2022, make:'Audi', model:'Q3 40 TFSI', body:'suv', price:559000, status:'Published'},
        {id:'v5', year:2023, make:'Toyota', model:'Corolla Cross XR', body:'suv', price:429000, status:'In prep'},
        {id:'v6', year:2021, make:'Jeep', model:'Grand Cherokee Limited', body:'suv', price:648000, status:'Reserved'},
        {id:'v7', year:2024, make:'BYD', model:'Seal Premium', body:'sedan', price:699000, status:'Published'},
        {id:'v8', year:2023, make:'Ford', model:'Ranger Wildtrak', body:'bakkie', price:812000, status:'VIR ready'},
        {id:'v9', year:2022, make:'Porsche', model:'Cayenne S', body:'suv', price:1590000, status:'Published'},
        {id:'v10', year:2020, make:'Kia', model:'Sportage EX', body:'suv', price:349000, status:'In prep'},
        {id:'v11', year:2023, make:'Hyundai', model:'Venue Fluid', body:'suv', price:299000, status:'Reserved'},
        {id:'v12', year:2019, make:'Mazda', model:'CX-5 Active', body:'suv', price:329000, status:'In prep'}
      ];
      saveJSON(INV_KEY, seed);
    }
  };

  function fmtPrice(n){
    if(typeof n !== 'number') n = parseInt(String(n).replace(/[^\d]/g,''), 10) || 0;
    return 'R' + n.toLocaleString('en-ZA');
  }

  let toastWrap;
  function toast(msg){
    if(!toastWrap){
      toastWrap = document.createElement('div');
      toastWrap.className = 'tc-toast-wrap';
      document.body.appendChild(toastWrap);
    }
    const el = document.createElement('div');
    el.className = 'tc-toast';
    el.textContent = msg;
    toastWrap.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=>el.remove(), 300);
    }, 3200);
  }

  return { leads, inventory, fmtPrice, toast };
})();
(function(){
  /* live clock */
  const clock=document.getElementById('clock');
  function tick(){ const d=new Date(); clock.textContent=d.toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short'})+' · '+d.toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}); }
  tick(); setInterval(tick,1000*20);

  const avatarColors=['#1466E0','#0E9D98','#C9A24B','#7A5AF8','#D0455B','#12844a'];
  function initials(n){ return (n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
  function colorFor(n){ let s=0; for(const c of (n||'')) s+=c.charCodeAt(0); return avatarColors[s%avatarColors.length]; }
  function timeAgo(iso){ const m=Math.round((Date.now()-new Date(iso))/60000); if(m<1)return'just now'; if(m<60)return m+'m ago'; const h=Math.round(m/60); if(h<24)return h+'h ago'; return Math.round(h/24)+'d ago'; }
  const STATUS_ORDER=['New','Contacted','Qualified','Won'];

  /* ---------------- LEADS ---------------- */
  function leadRow(l, opts){
    opts = opts||{};
    const el=document.createElement('div');
    el.className='lead'+(opts.fresh?' fresh':'');
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(l.status||'New')+1)%STATUS_ORDER.length];
    const actions = opts.actions ? `<div class="lead-actions">
        ${l.phone?`<a class="lact" href="tel:${l.phone.replace(/\s/g,'')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg>Call</a>`:''}
        ${l.phone?`<a class="lact wa" target="_blank" rel="noopener" href="https://wa.me/${l.phone.replace(/[^\d]/g,'')}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-1.5-.8-2.6-1.4-3.6-3.1-.3-.5.3-.5.7-1.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3 1.8.8 2.5.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.2-1.3-.1-.2-.3-.2-.6-.3z"/></svg>WhatsApp</a>`:''}
        <button type="button" class="lact adv" data-advance="${l.id}">Mark ${next}</button>
      </div>` : '';
    el.innerHTML=`<div class="lav" style="background:linear-gradient(135deg,${colorFor(l.name)},${colorFor(l.name)}bb)">${initials(l.name)}</div>
      <div class="lbody">
        <div class="lname">${l.name||'New enquiry'}${opts.fresh||l.status==='New'?'<span class="lnew">New</span>':''}</div>
        <div class="lintent">${l.intent||l.source||'Website enquiry'}</div>
        <div class="lmeta"><span class="src">${l.source||'Website'}</span><span>${l.phone||'—'}</span><span>${timeAgo(l.created)}</span></div>
        ${actions}
      </div>
      <div class="lval">${l.value?`<b>${l.value}</b>`:''}<span class="lstatus ${l.status||'New'}">${l.status||'New'}</span></div>`;
    return el;
  }

  const dashLeadList=document.getElementById('dashLeadList');
  const leadList=document.getElementById('leadList');
  const leadSearch=document.getElementById('leadSearch');
  const leadCount=document.getElementById('leadCount');
  let leadStatusFilter='All';

  function renderDashLeads(){
    const leads=TCSA.leads.all().slice(0,5);
    dashLeadList.innerHTML='';
    if(!leads.length){ dashLeadList.innerHTML='<div class="lead-empty">No leads yet.</div>'; return; }
    leads.forEach(l=>dashLeadList.appendChild(leadRow(l,{actions:false})));
  }
  function renderLeads(){
    const q=(leadSearch.value||'').toLowerCase().trim();
    let leads=TCSA.leads.all();
    if(leadStatusFilter!=='All') leads=leads.filter(l=>(l.status||'New')===leadStatusFilter);
    if(q) leads=leads.filter(l=> (l.name||'').toLowerCase().includes(q) || (l.intent||'').toLowerCase().includes(q) || (l.source||'').toLowerCase().includes(q));
    leadList.innerHTML='';
    leadCount.textContent = leads.length+' lead'+(leads.length===1?'':'s');
    if(!leads.length){ leadList.innerHTML='<div class="lead-empty">No leads match your filters.</div>'; return; }
    leads.forEach(l=>leadList.appendChild(leadRow(l,{actions:true})));
  }
  function renderAllLeadViews(){
    renderDashLeads();
    renderLeads();
    const all=TCSA.leads.all();
    const newCount=all.filter(l=>(l.status||'New')==='New').length;
    document.getElementById('navLeadCount').textContent=newCount;
    document.getElementById('kLeads').textContent=all.filter(l=>{const d=new Date(l.created);return (Date.now()-d)<36e5*24;}).length;
  }
  TCSA.leads.seedIfEmpty();

  leadSearch.addEventListener('input', renderLeads);
  document.getElementById('leadPills').addEventListener('click', e=>{
    const btn=e.target.closest('.mpill'); if(!btn) return;
    document.querySelectorAll('#leadPills .mpill').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    leadStatusFilter=btn.dataset.status;
    renderLeads();
  });
  document.body.addEventListener('click', function(e){
    const adv=e.target.closest('[data-advance]');
    if(!adv) return;
    const id=adv.getAttribute('data-advance');
    const lead=TCSA.leads.all().find(l=>l.id===id);
    if(!lead) return;
    const next=STATUS_ORDER[(STATUS_ORDER.indexOf(lead.status||'New')+1)%STATUS_ORDER.length];
    TCSA.leads.setStatus(id, next);
    TCSA.toast(lead.name+' marked as '+next);
    renderAllLeadViews();
  });

  /* live: new lead lands from storefront (TruChat, finance, trade-in) */
  window.addEventListener('tcsa:lead',e=>{
    TCSA.toast('New lead: '+(e.detail.name||'enquiry'));
    renderAllLeadViews();
  });
  const chime=(()=>{try{const ctx=new(window.AudioContext||window.webkitAudioContext)();return()=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.setValueAtTime(880,ctx.currentTime);o.frequency.setValueAtTime(1108,ctx.currentTime+.08);g.gain.setValueAtTime(.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.35);o.start(ctx.currentTime);o.stop(ctx.currentTime+.4);};}catch(e){return()=>{};}})();
  function showLeadBanner(lead){
    let b=document.querySelector('.lead-banner');
    if(!b){b=document.createElement('div');b.className='lead-banner';document.body.appendChild(b);}
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg><span>New lead from storefront: <b>'+(lead.name||'New enquiry')+'</b> · '+(lead.source||'Website')+'</span><button class="lb-close" onclick="this.parentElement.classList.remove(\'show\')">Dismiss</button>';
    requestAnimationFrame(()=>b.classList.add('show'));
    chime();
    setTimeout(()=>b.classList.remove('show'),6000);
  }
  window.addEventListener('storage',e=>{
    if(e.key!==TCSA.leads.KEY) return;
    const prev=renderAllLeadViews.lastCount||0;
    const cur=TCSA.leads.all().length;
    renderAllLeadViews();
    if(cur>prev){
      const newest=TCSA.leads.all()[0];
      if(newest) showLeadBanner(newest);
    }
    renderAllLeadViews.lastCount=cur;
  });
  renderAllLeadViews.lastCount=TCSA.leads.all().length;

  /* demo fab — fabricate a realistic lead */
  const demoLeads=[
    {name:'Sipho Ndlovu',source:'TruChat Chat',intent:'BYD Dolphin — finance + LVS booking',value:'R540k',phone:'+27 82 447 9910'},
    {name:'Chantal Meyer',source:'Trade-in',intent:'Trade 2020 Polo → Corolla Cross',value:'R430k',phone:'+27 83 771 2204'},
    {name:'Rajesh Naidoo',source:'Finance',intent:'Pre-approval — Hilux Legend RS',value:'R760k',phone:'+27 71 330 8845'},
    {name:'Lindiwe Zulu',source:'360° Enquiry',intent:'Audi Q3 availability + test drive',value:'R560k',phone:'+27 84 220 1176'},
  ];
  let di=0;
  document.getElementById('demoFab').addEventListener('click',()=>{
    const d=demoLeads[di%demoLeads.length]; di++;
    TCSA.leads.add(Object.assign({status:'New'},d));
  });

  /* ---------------- INVENTORY ---------------- */
  const STATUS_COLOR={'Published':'#0E9D98','VIR ready':'#1466E0','In prep':'#C9A24B','Reserved':'#7A5AF8'};
  const invSearch=document.getElementById('invSearch');
  const invGrid=document.getElementById('invGrid');
  const invCount=document.getElementById('invCount');
  const dashInvBoard=document.getElementById('dashInvBoard');
  let invStatusFilter='All';

  function invCard(v){
    const c=STATUS_COLOR[v.status]||'#8792A2';
    const el=document.createElement('div'); el.className='inv-card';
    el.innerHTML=`<div class="ic-accent" style="background:${c}"></div>
      <div class="ic-body">
        <div class="ic-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 17h14l-1.5-5H6.5L5 17zM7 17v2M17 17v2M8 12l1-4h6l1 4"/><circle cx="7.5" cy="17" r="1.4"/><circle cx="16.5" cy="17" r="1.4"/></svg></div>
        <h4>${v.year} ${v.make} ${v.model}</h4>
        <div class="ic-price">${TCSA.fmtPrice(v.price)}</div>
        <div class="ic-meta">${v.body||'vehicle'}</div>
        <span class="ic-status" style="background:${c}22;color:${c}">${v.status}</span>
        <div class="ic-actions">
          <button type="button" data-cycle="${v.id}">Advance</button>
          <button type="button" class="danger" data-remove="${v.id}">Remove</button>
        </div>
      </div>`;
    return el;
  }
  function renderDashInv(){
    const all=TCSA.inventory.all();
    dashInvBoard.innerHTML='';
    if(!all.length){ dashInvBoard.innerHTML='<div class="inv-empty">No vehicles yet.</div>'; return; }
    all.slice(0,4).forEach(v=>dashInvBoard.appendChild(invCard(v)));
    if(dashInvBoard.children.length){ dashInvBoard.style.display='grid'; dashInvBoard.style.gridTemplateColumns='repeat(auto-fill,minmax(200px,1fr))'; dashInvBoard.style.gap='14px'; dashInvBoard.style.padding='18px 20px'; }
  }
  function renderInv(){
    const q=(invSearch.value||'').toLowerCase().trim();
    let all=TCSA.inventory.all();
    if(invStatusFilter!=='All') all=all.filter(v=>v.status===invStatusFilter);
    if(q) all=all.filter(v=> (v.make+' '+v.model+' '+v.year).toLowerCase().includes(q));
    invGrid.innerHTML='';
    invCount.textContent = all.length+' vehicle'+(all.length===1?'':'s');
    if(!all.length){ invGrid.innerHTML='<div class="inv-empty">No vehicles match your filters.</div>'; return; }
    all.forEach(v=>invGrid.appendChild(invCard(v)));
  }
  function renderAllInvViews(){
    renderDashInv();
    renderInv();
    const all=TCSA.inventory.all();
    document.getElementById('navInvCount').textContent=all.length;
    document.getElementById('kInv').textContent=all.length;
    document.getElementById('kInvPub').textContent=all.filter(v=>v.status==='Published').length+' published';
  }
  TCSA.inventory.seedIfEmpty();

  invSearch.addEventListener('input', renderInv);
  document.getElementById('invPills').addEventListener('click', e=>{
    const btn=e.target.closest('.mpill'); if(!btn) return;
    document.querySelectorAll('#invPills .mpill').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    invStatusFilter=btn.dataset.status;
    renderInv();
  });
  const INV_STATUS_ORDER=['In prep','VIR ready','Published','Reserved'];
  document.body.addEventListener('click', e=>{
    const cyc=e.target.closest('[data-cycle]');
    if(cyc){
      const id=cyc.getAttribute('data-cycle');
      const v=TCSA.inventory.all().find(x=>x.id===id);
      if(v){
        const next=INV_STATUS_ORDER[(INV_STATUS_ORDER.indexOf(v.status)+1)%INV_STATUS_ORDER.length];
        TCSA.inventory.setStatus(id, next);
        TCSA.toast(v.year+' '+v.make+' '+v.model+' → '+next);
        renderAllInvViews();
      }
      return;
    }
    const rem=e.target.closest('[data-remove]');
    if(rem){
      const id=rem.getAttribute('data-remove');
      const v=TCSA.inventory.all().find(x=>x.id===id);
      TCSA.inventory.remove(id);
      if(v) TCSA.toast('Removed '+v.year+' '+v.make+' '+v.model+' from inventory');
      renderAllInvViews();
    }
  });

  /* ---------------- UPLOAD VEHICLE ---------------- */
  const drop=document.getElementById('ufDrop');
  const fileInput=document.getElementById('ufFile');
  const thumbs=document.getElementById('ufThumbs');
  let files=[];
  drop.addEventListener('click', ()=>fileInput.click());
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e=>{ addFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', e=>{ addFiles(e.target.files); });
  function addFiles(list){
    [...list].forEach(f=>{
      if(!f.type.startsWith('image/')) return;
      files.push(f);
      const url=URL.createObjectURL(f);
      const th=document.createElement('div'); th.className='th';
      th.innerHTML=`<img src="${url}" alt=""><span class="rm">✕</span>`;
      th.querySelector('.rm').addEventListener('click', ev=>{ ev.stopPropagation(); files=files.filter(x=>x!==f); th.remove(); });
      thumbs.appendChild(th);
    });
  }

  document.getElementById('uploadForm').addEventListener('submit', function(e){
    e.preventDefault();
    const year=parseInt(document.getElementById('ufYear').value,10);
    const make=document.getElementById('ufMake').value.trim();
    const model=document.getElementById('ufModel').value.trim();
    const price=parseInt(document.getElementById('ufPrice').value,10);
    if(!year||!make||!model||!price){ TCSA.toast('Please fill in year, make, model and price.'); return; }
    const v={
      year, make, model,
      variant:document.getElementById('ufVariant').value.trim(),
      colour:document.getElementById('ufColour').value.trim(),
      body:document.getElementById('ufBody').value,
      fuel:document.getElementById('ufFuel').value,
      trans:document.getElementById('ufTrans').value,
      desc:document.getElementById('ufDesc').value.trim(),
      price,
      truePrice:parseInt(document.getElementById('ufTruePrice').value,10)||null,
      km:parseInt(document.getElementById('ufKm').value,10)||null,
      status:document.getElementById('ufStatus').value,
      photos:files.length
    };
    TCSA.inventory.add(v);
    TCSA.toast(year+' '+make+' '+model+' added to inventory');
    this.reset();
    files=[]; thumbs.innerHTML='';
    renderAllInvViews();
    showView('viewInventory');
  });

  /* ---------------- VIEW SWITCHING ---------------- */
  const TITLES={viewDashboard:'Good morning, Cape Town Motors', viewLeads:'Lead Management', viewInventory:'Inventory Management', viewUpload:'Upload a Vehicle'};
  function showView(id){
    document.querySelectorAll('.pview').forEach(v=>v.classList.toggle('active', v.id===id));
    document.querySelectorAll('.pnav-item[data-view]').forEach(i=>i.classList.toggle('on', i.getAttribute('data-view')===id));
    document.getElementById('viewTitle').textContent = TITLES[id]||'Dealer Console';
    window.scrollTo({top:0,behavior:'instant'});
  }
  document.querySelectorAll('.pnav-item[data-view]').forEach(item=>{
    item.addEventListener('click',()=>showView(item.getAttribute('data-view')));
  });
  document.querySelectorAll('.pnav-item[data-toast]').forEach(item=>{
    item.addEventListener('click',()=>{ document.querySelectorAll('.pnav-item').forEach(i=>i.classList.remove('on')); TCSA.toast(item.getAttribute('data-toast')); });
  });
  document.body.addEventListener('click', e=>{
    const g=e.target.closest('[data-goto]');
    if(g) showView(g.getAttribute('data-goto'));
  });

  renderAllLeadViews();
  renderAllInvViews();
})();