window.TI = {
  step:0, cond:'excellent', insp:'branch',
  toggles:{fsh:true, accfree:true, finance:false},
  base:{ // benchmark value of a ~2023 example, good condition, ~40k km (ZAR)
    'Toyota':{_d:300000,'hilux':540000,'fortuner':630000,'corolla cross':430000,'corolla':300000,'quest':240000,'starlet':250000,'rav4':520000,'land cruiser':1250000},
    'Volkswagen':{_d:290000,'polo':310000,'polo vivo':215000,'golf gti':610000,'golf r':820000,'golf':420000,'tiguan':520000,'t-cross':360000},
    'Ford':{_d:300000,'ranger':560000,'everest':720000,'fiesta':230000,'figo':190000},
    'BMW':{_d:520000,'3 series':600000,'x3':720000,'1 series':420000,'m4':1500000},
    'Mercedes-Benz':{_d:560000,'c-class':650000,'a-class':520000,'glc':900000},
    'Hyundai':{_d:260000,'i20':250000,'grand i10':200000,'tucson':480000,'creta':390000},
    'Kia':{_d:250000,'picanto':205000,'sonet':330000,'seltos':420000},
    'Suzuki':{_d:220000,'swift':235000,'jimny':420000,'baleno':245000,'fronx':320000},
    'Nissan':{_d:240000,'np200':190000,'magnite':260000,'navara':520000,'x-trail':480000},
    'Isuzu':{_d:300000,'d-max':510000,'kb':360000,'mu-x':650000},
    'Haval':{_d:320000,'jolion':340000,'h6':470000},
    'BYD':{_d:420000,'atto 3':560000,'dolphin':480000,'seal':720000},
    'Other':{_d:280000}
  },
  init(){
    const mk=document.getElementById('tMake');
    Object.keys(this.base).forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;mk.appendChild(o);});
    mk.value='Toyota';
    const yr=document.getElementById('tYear');
    for(let y=2026;y>=2008;y--){const o=document.createElement('option');o.value=y;o.textContent=y;yr.appendChild(o);}
    yr.value=2022;
    // condition + inspection option selects
    document.querySelectorAll('#condGrid .opt').forEach(o=>o.addEventListener('click',()=>{document.querySelectorAll('#condGrid .opt').forEach(x=>x.classList.remove('on'));o.classList.add('on');this.cond=o.dataset.cond;}));
    document.querySelectorAll('#inspGrid .opt').forEach(o=>o.addEventListener('click',()=>{document.querySelectorAll('#inspGrid .opt').forEach(x=>x.classList.remove('on'));o.classList.add('on');this.insp=o.dataset.insp;}));
    document.querySelectorAll('.switch[data-t]').forEach(s=>s.addEventListener('click',()=>{s.classList.toggle('on');this.toggles[s.dataset.t]=s.classList.contains('on');}));
    // prefill from URL (?make=&model=)
    const p=new URLSearchParams(location.search);
    if(p.get('make')&&this.base[p.get('make')]) mk.value=p.get('make');
    if(p.get('model')) document.getElementById('tModel').value=p.get('model');
  },
  go(s){ this.step=Math.max(0,Math.min(3,s));
    document.querySelectorAll('.wiz-panel').forEach(p=>p.classList.toggle('on',+p.dataset.p===this.step));
    document.querySelectorAll('.wiz-steps .ws').forEach(w=>{const n=+w.dataset.s;w.classList.toggle('on',n===this.step);w.classList.toggle('done',n<this.step);});
    document.querySelector('.wizard').scrollIntoView({behavior:'smooth',block:'start'});
  },
  next(){ if(this.step===0 && !this.validate1()) return; this.go(this.step+1); },
  prev(){ this.go(this.step-1); },
  validate1(){
    if(!document.getElementById('tModel').value.trim()){ TCSA.toast('Please enter your model.'); return false; }
    const km=+document.getElementById('tKm').value; if(!km||km<0){ TCSA.toast('Please enter your mileage.'); return false; }
    return true;
  },
  fakeUpload(){ const t=document.getElementById('tThumbs'); if(t.children.length>=4) return;
    const d=document.createElement('div'); d.className='th'; d.innerHTML='<svg viewBox="0 0 24 24" width="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>'; t.appendChild(d);
    TCSA.toast('Photo added — thanks, this sharpens your quote.');
  },
  estimate(){
    const make=document.getElementById('tMake').value;
    const model=document.getElementById('tModel').value.trim().toLowerCase();
    const year=+document.getElementById('tYear').value;
    const km=+document.getElementById('tKm').value;
    const grp=this.base[make]||this.base.Other;
    let base=grp._d;
    Object.keys(grp).forEach(k=>{ if(k!=='_d' && model.includes(k)) base=Math.max(base,grp[k]); });
    // age: benchmark is 2023; +9% per newer year, -9% per older
    const age=1 + (year-2023)*0.09; const ageF=Math.max(0.42,Math.min(1.4,age));
    // mileage vs expected (20k/yr from year)
    const expected=Math.max(10000,(2026-year)*20000);
    const mF=Math.max(0.68,Math.min(1.12,1-(km-expected)/Math.max(expected,1)*0.14));
    const condF={excellent:1.05,good:1.0,fair:0.87}[this.cond];
    let histF=1; if(this.toggles.fsh) histF+=0.04; if(this.toggles.accfree) histF+=0.03; else histF-=0.05;
    let val=base*ageF*mF*condF*histF;
    val=Math.max(25000,Math.round(val/500)*500);
    const retail=Math.round(val*1.14/500)*500;
    return {val,low:Math.round(val*0.95/500)*500,high:Math.round(val*1.05/500)*500,retail,make,model:document.getElementById('tModel').value.trim(),year,km};
  },
  calcAndNext(){
    const e=this.estimate(); this._est=e;
    document.getElementById('offerCar').textContent=`${e.year} ${e.make} ${e.model} · ${e.km.toLocaleString('en-ZA')} km · ${this.cond} condition`;
    document.getElementById('offerRetail').textContent=TCSA.fmtPrice(e.retail);
    document.getElementById('offerRange').textContent=`Estimated range ${TCSA.fmtPrice(e.low)} – ${TCSA.fmtPrice(e.high)}`;
    // count-up
    const el=document.getElementById('offerAmt'); let n=Math.round(e.val*0.7); const step=Math.round((e.val-n)/28);
    const t=setInterval(()=>{ n+=step; if(n>=e.val){n=e.val;clearInterval(t);} el.textContent=TCSA.fmtPrice(n); },26);
    this.go(2);
  },
  submit(){
    const name=document.getElementById('bName').value.trim(), phone=document.getElementById('bPhone').value.trim();
    if(!name||!phone){ TCSA.toast('Please add your name and mobile number.'); return; }
    const e=this._est||this.estimate();
    const rec=TCSA.leads.add({name,phone,source:'Trade-in',
      intent:`Trade-in ${e.year} ${e.make} ${e.model} (${e.km.toLocaleString('en-ZA')}km) · ${this.insp} inspection · ${document.getElementById('bBranch').value}`,
      value:TCSA.fmtPrice(e.val), status:'Qualified'});
    document.getElementById('bookForm').style.display='none';
    document.getElementById('bookDone').style.display='block';
    document.getElementById('doneMsg').innerHTML=`Reference <b>${rec.id}</b> · we'll WhatsApp <b>${phone}</b> within the hour.`;
    document.getElementById('doneAmt').textContent=TCSA.fmtPrice(e.val);
    TCSA.toast('Inspection booked ✓ Offer held for 7 days.');
  }
};
document.addEventListener('DOMContentLoaded',()=>TI.init());