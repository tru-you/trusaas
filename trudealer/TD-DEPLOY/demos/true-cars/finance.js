window.FIN = {
  init(){
    document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');
      const p=t.dataset.tab; document.querySelectorAll('.panel').forEach(pn=>pn.classList.toggle('on',pn.dataset.panel===p));
    }));
    ['price','dep','term','bal','rate'].forEach(id=>document.getElementById(id).addEventListener('input',()=>this.repay()));
    ['budget','aDepR','aTermR','aRateR'].forEach(id=>document.getElementById(id).addEventListener('input',()=>this.afford()));
    // rate loosely linked to term/deposit could be added; keep manual
    this.repay(); this.afford();
    // prefill price from ?price=
    const p=new URLSearchParams(location.search); if(p.get('price')){document.getElementById('price').value=p.get('price');this.repay();}
  },
  pmt(principal, annualRate, term, balloonAmt){
    const r=annualRate/100/12;
    const pv=principal - balloonAmt/Math.pow(1+r,term);
    return pv*r/(1-Math.pow(1+r,-term));
  },
  repay(){
    const price=+price_.value, depPct=+dep.value, term=+term_.value, balPct=+bal.value, rate=+rate_.value;
    const deposit=price*depPct/100, balloon=price*balPct/100, financed=price-deposit;
    const m=this.pmt(financed,rate,term,balloon);
    document.getElementById('pPrice').textContent=TCSA.fmtPrice(price);
    document.getElementById('pDep').textContent=depPct+'% · '+TCSA.fmtPrice(Math.round(deposit));
    document.getElementById('pTerm').textContent=term+' months';
    document.getElementById('pBal').textContent=balPct+'% · '+TCSA.fmtPrice(Math.round(balloon));
    document.getElementById('pRate').textContent=rate.toFixed(2)+'%';
    const totalPaid=m*term+balloon, interest=totalPaid-financed;
    document.getElementById('rMonthly').innerHTML=TCSA.fmtPrice(Math.round(m))+'<small>/mo</small>';
    document.getElementById('rFin').textContent=TCSA.fmtPrice(Math.round(financed));
    document.getElementById('rInt').textContent=TCSA.fmtPrice(Math.round(interest));
    document.getElementById('rBalloon').textContent=TCSA.fmtPrice(Math.round(balloon));
    document.getElementById('rTotal').textContent=TCSA.fmtPrice(Math.round(totalPaid+deposit));
  },
  afford(){
    const budget=+document.getElementById('budget').value, deposit=+document.getElementById('aDepR').value, term=+document.getElementById('aTermR').value, rate=+document.getElementById('aRateR').value;
    const r=rate/100/12;
    // max financed from instalment: financed = m * (1-(1+r)^-n)/r  (no balloon)
    const financed=budget*(1-Math.pow(1+r,-term))/r;
    const maxPrice=Math.round((financed+deposit)/1000)*1000;
    document.getElementById('aBudget').textContent=TCSA.fmtPrice(budget);
    document.getElementById('aDep').textContent=TCSA.fmtPrice(deposit);
    document.getElementById('aTerm').textContent=term+' months';
    document.getElementById('aRate').textContent=rate.toFixed(2)+'%';
    document.getElementById('aMax').textContent=TCSA.fmtPrice(maxPrice);
    document.getElementById('aFin').textContent=TCSA.fmtPrice(Math.round(financed));
    document.getElementById('aDepShow').textContent=TCSA.fmtPrice(deposit);
    document.getElementById('aInst').textContent=TCSA.fmtPrice(budget)+'/mo';
    const matches=TCSA.vehicles.filter(v=>v.price<=maxPrice).length;
    document.getElementById('aMatch').textContent=matches+' cars in stock fit this budget.';
    document.getElementById('aBrowse').href='certi-used.html?maxPrice='+maxPrice;
  },
  apply(){
    const name=document.getElementById('apName').value.trim(), phone=document.getElementById('apPhone').value.trim();
    const income=+document.getElementById('apIncome').value, nett=+document.getElementById('apNett').value;
    if(!name||!phone){ TCSA.toast('Please add your name and mobile.'); return; }
    if(!document.getElementById('apConsent').checked){ TCSA.toast('Please tick consent to run the soft check.'); return; }
    if(!income){ TCSA.toast('Please add your gross monthly income.'); return; }
    // simple affordability scoring
    const car=document.getElementById('apCar').value.trim();
    const dispo=(nett||income*0.72)*0.28; // ~28% of take-home available for instalment
    let score=Math.min(96, Math.max(35, Math.round(45 + (dispo/9000)*40)));
    if(document.getElementById('apEmp').value!=='Permanently employed') score-=8;
    score=Math.max(30,Math.min(97,score));
    const verdict = score>=70?'Pre-approved in principle 🎉': score>=50?'Likely to qualify 👍':'Let\'s find the right deal';
    const rec=TCSA.leads.add({name,phone,source:'Finance',
      intent:`Pre-approval · income ${TCSA.fmtPrice(income)} · ${document.getElementById('apEmp').value}${car?' · '+car:''}`,
      value: car||('~'+TCSA.fmtPrice(Math.round(dispo*45))), status: score>=70?'Qualified':'New'});
    document.getElementById('apForm').style.display='none';
    document.getElementById('apDone').style.display='block';
    document.getElementById('apVerdict').textContent=verdict;
    document.getElementById('apMsg').innerHTML=`Reference <b>${rec.id}</b> · our F&I desk will WhatsApp <b>${phone}</b> shortly with your options.`;
    document.getElementById('apScore').textContent=`Approval likelihood ${score}%`;
    setTimeout(()=>document.getElementById('apBar').style.width=score+'%',150);
    document.getElementById('apDone').scrollIntoView({behavior:'smooth',block:'center'});
  }
};
// alias range els with reserved names
const price_=document.getElementById('price'), dep=document.getElementById('dep'), term_=document.getElementById('term'), bal=document.getElementById('bal'), rate_=document.getElementById('rate');
document.addEventListener('DOMContentLoaded',()=>FIN.init());