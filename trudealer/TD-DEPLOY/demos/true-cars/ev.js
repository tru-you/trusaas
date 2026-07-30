function renderGrid(){
  var sort = document.getElementById('fSort').value;
  var list = TCSA.vehicles.filter(function(v){ return v.fuel === 'Electric' || v.fuel === 'Hybrid'; });
  var cmp = {
    priceAsc:function(a,b){return a.price-b.price;},
    priceDesc:function(a,b){return b.price-a.price;},
    kmAsc:function(a,b){return a.km-b.km;},
    vir:function(a,b){return (b.vir||0)-(a.vir||0);}
  }[sort];
  list.sort(cmp);
  document.getElementById('rc').textContent = list.length;
  document.getElementById('grid').innerHTML = list.map(TCSA.vcard).join('');
}
function refreshEv(){
  var count = TCSA.vehicles.filter(function(v){ return v.fuel === 'Electric' || v.fuel === 'Hybrid'; }).length;
  document.getElementById('evCount').textContent = count;
  renderGrid();
}
document.addEventListener('DOMContentLoaded', refreshEv);
window.addEventListener('tcsa:stock', refreshEv);