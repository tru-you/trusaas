document.getElementById('today').textContent = new Date().toLocaleDateString('en-ZA', {day:'2-digit', month:'short', year:'numeric'});
setTimeout(function(){ window.print(); }, 800);