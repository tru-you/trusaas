function renderGrid(){
  var sort = document.getElementById('fSort').value;
  var list = TCSA.vehicles.filter(function(v){ return v.category === 'performance'; });
  var cmp = {
    priceAsc:function(a,b){return a.price-b.price;},
    priceDesc:function(a,b){return b.price-a.price;},
    kmAsc:function(a,b){return a.km-b.km;},
    vir:function(a,b){return (b.vir||0)-(a.vir||0);}
  }[sort];
  list.sort(cmp);
  document.getElementById('rc').textContent = list.length;
  var grid = document.getElementById('grid');
  grid.innerHTML = list.map(function(v){
    var card = TCSA.vcard(v);
    return card.replace('class="vcard"','class="vcard perf-vcard"');
  }).join('');
}
document.addEventListener('DOMContentLoaded', renderGrid);
window.addEventListener('tcsa:stock', renderGrid);