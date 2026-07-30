if(TCSA.injectTrustRow) TCSA.injectTrustRow(document.getElementById('certTrust'));
function renderGrid(){
  var q = document.getElementById('fSearch').value.trim().toLowerCase();
  var body = document.getElementById('fBody').value;
  var fuel = document.getElementById('fFuel').value;
  var trans = document.getElementById('fTrans').value;
  var sort = document.getElementById('fSort').value;
  var list = TCSA.vehicles.filter(function(v){
    if(q && !(v.year+' '+v.make+' '+v.model+' '+v.variant+' '+(v.colour||'')).toLowerCase().includes(q)) return false;
    if(body && v.body !== body) return false;
    if(fuel && v.fuel !== fuel) return false;
    if(trans && v.trans !== trans) return false;
    return true;
  });
  var cmp = {
    deal:function(a,b){return TCSA.priceDelta(b).amount-TCSA.priceDelta(a).amount;},
    priceAsc:function(a,b){return a.price-b.price;},
    priceDesc:function(a,b){return b.price-a.price;},
    kmAsc:function(a,b){return a.km-b.km;},
    yearDesc:function(a,b){return b.year-a.year;},
    vir:function(a,b){return b.vir-a.vir;}
  }[sort];
  list.sort(cmp);
  document.getElementById('rc').textContent = list.length;
  document.getElementById('grid').innerHTML = list.map(TCSA.vcard).join('');
  document.getElementById('empty').classList.toggle('hidden', list.length > 0);
}
function clearFilters(){
  document.getElementById('fSearch').value='';
  document.getElementById('fBody').value='';
  document.getElementById('fFuel').value='';
  document.getElementById('fTrans').value='';
  document.getElementById('fSort').value='deal';
  renderGrid();
}
function refreshCounts(){
  document.getElementById('lvsCount').textContent = TCSA.vehicles.filter(function(v){ return v.lvs; }).length;
  renderGrid();
}
document.addEventListener('DOMContentLoaded', function(){
  refreshCounts();
  if (TCSA.loadLiveStock) {
    TCSA.loadLiveStock().then(refreshCounts);
  }
});
window.addEventListener('tcsa:stock', refreshCounts);