const CATALOG = [
  { id:"TC001", brand:"FORD", model:"Ranger 2.0 SiT XLT D/C", year:2022, price:489900, km:"42 000 km", fuel:"Diesel", trans:"Automatic", badge:"Hot Deal" },
  { id:"TC002", brand:"TOYOTA", model:"Hilux 2.8 GD-6 Legend RS", year:2021, price:549900, km:"51 000 km", fuel:"Diesel", trans:"Automatic", badge:"Low KM" },
  { id:"TC003", brand:"VOLKSWAGEN", model:"Polo 1.0 TSI Life", year:2023, price:299900, km:"18 000 km", fuel:"Petrol", trans:"Manual", badge:"Popular" },
  { id:"TC004", brand:"AUDI", model:"A3 Sportback 35 TFSI", year:2022, price:449900, km:"28 000 km", fuel:"Petrol", trans:"Automatic", badge:"Mint" },
  { id:"TC005", brand:"BMW", model:"320i M Sport", year:2021, price:529900, km:"35 000 km", fuel:"Petrol", trans:"Automatic", badge:"Executive" },
  { id:"TC006", brand:"MERCEDES-BENZ", model:"C200 AMG Line", year:2022, price:589900, km:"22 000 km", fuel:"Petrol", trans:"Automatic", badge:"Just In" },
  { id:"TC007", brand:"ISUZU", model:"D-Max 3.0 TD LS D/C", year:2020, price:379900, km:"68 000 km", fuel:"Diesel", trans:"Automatic", badge:"Workhorse" },
  { id:"TC008", brand:"HYUNDAI", model:"Tucson 2.0 Executive", year:2023, price:419900, km:"15 000 km", fuel:"Petrol", trans:"Automatic", badge:"Near New" },
  { id:"TC009", brand:"SUZUKI", model:"Swift 1.2 GL", year:2022, price:189900, km:"32 000 km", fuel:"Petrol", trans:"Manual", badge:"Budget Friendly" },
  { id:"TC010", brand:"NISSAN", model:"Navara 2.5 dCi LE D/C", year:2021, price:429900, km:"55 000 km", fuel:"Diesel", trans:"Automatic", badge:"4x4 Ready" }
];

const CFG = {
  dealerName: "True-Cars",
  assistantName: "Ray",
  salesWhatsApp: "27620502091",
  brandPrimary: "#00f2fe",
  brandPrimaryDark: "#0284c7",
  address: "15 Victory Way, Simonstown, 7441, Cape Town",
  hoursText: "Mon-Fri: 08:00 - 17:30\nSaturday: 08:30 - 14:00\nSunday: Closed",
  greetingAI: "Welcome to **{dealer}**! I'm **{assistant}**, your AI showroom guide. Looking for pre-owned stock, trade-in valuations, or finance help?",
  greetingHuman: "Howzit! You're connected to the **{dealer} Sales Desk**. How can our team help you today?",
  suggestionsAI: ["Browse stock", "Trade-in valuation", "Showroom hours", "Finance help"],
  suggestionsHuman: ["Call me back", "Book test drive", "Finance pre-approval", "WhatsApp me"],
  proxyUrl: "https://ruchat-api-proxy.leads-5de.workers.dev",
  apiMode: "proxy",
  financeRate: 11.5,
  website: "https://true-cars.co.za"
};

let soundOn = false;
let currentTab = 'ai';
let session = { name: "Prospect", phone: "", email: "", vehicleInterest: null, qualified: false, booking: null, handoffStep: null, preferredContact: null };
let chatHistory = { ai:[], human:[] };
let apiMessages = [];
let pendingBooking = null;
let calendarState = { year: 2026, month: 6, selectedDate: null, selectedSlot: null };
let activeCalendarId = 0;

/* ===== LEAD STORAGE ===== */
function getLeads(){
  try{ return JSON.parse(localStorage.getItem('truchat-leads') || '[]'); }
  catch(e){ return []; }
}
function saveLead(lead){
  const leads = getLeads();
  lead.id = 'L' + Date.now().toString(36).toUpperCase();
  lead.capturedAt = new Date().toISOString();
  leads.unshift(lead);
  localStorage.setItem('truchat-leads', JSON.stringify(leads));
  return lead;
}

/* ===== CALENDAR LOGIC ===== */
function getDaysInMonth(y, m){ return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m){ return new Date(y, m, 1).getDay(); }
function isPastDate(y, m, d){
  const today = new Date(); today.setHours(0,0,0,0);
  const check = new Date(y, m, d);
  return check < today;
}
function getAvailableSlots(y, m, d){
  const dow = new Date(y, m, d).getDay();
  if(dow === 0) return [];
  if(dow === 6) return ["08:30","09:30","10:30","11:30","12:30","13:30"];
  return ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"];
}

function buildCalendarHTML(calId){
  const { year, month, selectedDate, selectedSlot } = calendarState;
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  let html = '<div class="cal-widget" data-cal-id="' + calId + '">';
  html += '<div class="cal-header"><button class="cal-nav" onclick="calPrevMonth(' + calId + ')">&#8249;</button><b>' + monthNames[month] + ' ' + year + '</b><button class="cal-nav" onclick="calNextMonth(' + calId + ')">&#8250;</button></div>';
  html += '<div class="cal-grid">';
  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => html += '<div class="cal-dow">' + d + '</div>');
  for(let i=0;i<firstDay;i++) html += '<div class="cal-day disabled"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const dow = new Date(year, month, d).getDay();
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
    const isPast = isPastDate(year, month, d);
    const isWeekendDay = dow === 0 || dow === 6;
    const disabled = isPast || isWeekendDay;
    const selected = selectedDate && selectedDate.d === d && selectedDate.m === month && selectedDate.y === year;
    let cls = "cal-day";
    if(disabled) cls += " disabled";
    if(selected) cls += " selected";
    if(isToday && !selected) cls += " today";
    if(disabled){ html += '<div class="' + cls + '">' + d + '</div>'; }
    else { html += '<div class="' + cls + '" onclick="calSelectDate(' + d + ',' + month + ',' + year + ',' + calId + ')">' + d + '</div>'; }
  }
  html += '</div>';
  if(selectedDate){
    const slots = getAvailableSlots(selectedDate.y, selectedDate.m, selectedDate.d);
    const dowName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(selectedDate.y, selectedDate.m, selectedDate.d).getDay()];
    html += '<div style="font-size:11px;color:var(--muted);margin-top:10px;font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;">Available slots for ' + dowName + ' ' + selectedDate.d + ' ' + monthNames[selectedDate.m] + '</div>';
    html += '<div class="cal-slots">';
    slots.forEach(slot => {
      const sel = selectedSlot === slot;
      html += '<div class="cal-slot ' + (sel ? 'selected' : '') + '" onclick="calSelectSlot(\'' + slot + '\',' + calId + ')">' + slot + '</div>';
    });
    html += '</div>';
  }
  const canConfirm = selectedDate && selectedSlot;
  html += '<button class="cal-confirm" ' + (canConfirm ? '' : 'disabled') + ' onclick="calConfirm(' + calId + ')">Confirm Booking</button>';
  html += '</div>';
  return html;
}

function findCalendarWidget(calId){
  return document.querySelector('.cal-widget[data-cal-id="' + calId + '"]');
}

function calPrevMonth(calId){
  calendarState.month--;
  if(calendarState.month < 0){ calendarState.month = 11; calendarState.year--; }
  calendarState.selectedDate = null; calendarState.selectedSlot = null;
  refreshCalendar(calId);
}
function calNextMonth(calId){
  calendarState.month++;
  if(calendarState.month > 11){ calendarState.month = 0; calendarState.year++; }
  calendarState.selectedDate = null; calendarState.selectedSlot = null;
  refreshCalendar(calId);
}
function calSelectDate(d, m, y, calId){
  calendarState.selectedDate = { d, m, y };
  calendarState.selectedSlot = null;
  refreshCalendar(calId);
}
function calSelectSlot(slot, calId){
  calendarState.selectedSlot = slot;
  refreshCalendar(calId);
}
function refreshCalendar(calId){
  const existing = findCalendarWidget(calId);
  if(existing){
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildCalendarHTML(calId);
    existing.parentNode.replaceChild(wrapper.firstChild, existing);
  }
}

function calConfirm(calId){
  const { selectedDate, selectedSlot } = calendarState;
  if(!selectedDate || !selectedSlot) return;
  const dateStr = selectedDate.y + '-' + String(selectedDate.m + 1).padStart(2,'0') + '-' + String(selectedDate.d).padStart(2,'0');
  pendingBooking = { date: dateStr, time: selectedSlot, vehicle: session.vehicleInterest };

  const calWidget = findCalendarWidget(calId);
  if(calWidget){
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildLeadFormHTML();
    calWidget.parentNode.replaceChild(wrapper.firstChild, calWidget);
  }
}

/* ===== LEAD FORM ===== */
function buildLeadFormHTML(){
  const vehicleOptions = CATALOG.map(v => '<option value="' + v.id + '">' + v.year + ' ' + v.brand + ' ' + v.model + '</option>').join('');
  let html = '<div class="lead-widget" id="leadWidget">';
  html += '<div class="lead-title">Almost there!</div>';
  html += '<div class="lead-sub">Pop your details below so we can confirm your booking.</div>';
  html += '<div class="lead-field"><label>Full Name</label><input type="text" id="leadName" placeholder="e.g. John Smith" value="' + (session.name !== 'Prospect' ? session.name : '') + '"></div>';
  html += '<div class="lead-field"><label>Phone Number</label><input type="tel" id="leadPhone" placeholder="e.g. 082 123 4567" value="' + session.phone + '"></div>';
  html += '<div class="lead-field"><label>Email</label><input type="email" id="leadEmail" placeholder="e.g. john@email.com" value="' + session.email + '"></div>';
  html += '<div class="lead-field"><label>Preferred Vehicle</label><select id="leadVehicle"><option value="">Select a vehicle...</option>' + vehicleOptions + '</select></div>';
  html += '<button class="lead-submit" onclick="submitLead()">Confirm & Book</button>';
  html += '</div>';
  return html;
}

function submitLead(){
  const name = document.getElementById('leadName').value.trim();
  const phone = document.getElementById('leadPhone').value.trim();
  const email = document.getElementById('leadEmail').value.trim();
  const vehicleId = document.getElementById('leadVehicle').value;
  if(!name || !phone){ alert('Please enter your name and phone number.'); return; }
  session.name = name; session.phone = phone; session.email = email;
  const vehicle = vehicleId ? CATALOG.find(v => v.id === vehicleId) : (session.vehicleInterest || null);
  const lead = saveLead({
    name, phone, email,
    vehicle: vehicle ? vehicle.year + ' ' + vehicle.brand + ' ' + vehicle.model : 'Not specified',
    vehicleId: vehicle ? vehicle.id : '',
    source: 'TruChat AI',
    status: pendingBooking ? 'booked' : 'new',
    booking: pendingBooking || null,
    notes: ''
  });
  const form = document.getElementById('leadWidget');
  if(form){
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildBookingConfirmHTML(lead, vehicle);
    form.parentNode.replaceChild(wrapper.firstChild, form);
  }
  if(soundOn) playSuccessSound();
  pendingBooking = null;
}

function buildBookingConfirmHTML(lead, vehicle){
  const bk = lead.booking;
  const dateObj = new Date(bk.date + 'T' + bk.time);
  const dateFormatted = dateObj.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let html = '<div class="booking-card">';
  html += '<div class="bk-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>';
  html += '<div class="bk-title">Booking Confirmed!</div>';
  html += '<div class="bk-ref">Ref: ' + lead.id + '</div>';
  html += '<div class="bk-row"><span class="bk-label">Name</span><span class="bk-val">' + lead.name + '</span></div>';
  html += '<div class="bk-row"><span class="bk-label">Date</span><span class="bk-val">' + dateFormatted + '</span></div>';
  html += '<div class="bk-row"><span class="bk-label">Time</span><span class="bk-val">' + bk.time + '</span></div>';
  if(vehicle){
    html += '<div class="bk-row"><span class="bk-label">Vehicle</span><span class="bk-val">' + vehicle.year + ' ' + vehicle.brand + ' ' + vehicle.model + '</span></div>';
  }
  html += '<div class="bk-row"><span class="bk-label">Phone</span><span class="bk-val">' + lead.phone + '</span></div>';
  html += '<div class="bk-note">A confirmation SMS will be sent shortly. If you need to reschedule, WhatsApp us on <b>+' + CFG.salesWhatsApp + '</b> quoting reference <b>' + lead.id + '</b>.</div>';
  html += '</div>';
  return html;
}

/* ===== LEADS PANEL ===== */
function toggleLeadsPanel(){
  const panel = document.getElementById('leadsPanel');
  if(!panel) return;
  panel.classList.toggle('open');
  if(panel.classList.contains('open')) renderLeadsPanel();
}

function renderLeadsPanel(){
  const leads = getLeads();
  const countEl = document.getElementById('lpCount');
  if(countEl) countEl.textContent = leads.length + ' lead' + (leads.length !== 1 ? 's' : '');
  const body = document.getElementById('lpBody');
  if(!body) return;
  if(!leads.length){ body.innerHTML = '<div class="lp-empty">No leads captured yet.</div>'; return; }
  body.innerHTML = leads.map(l => {
    const date = new Date(l.capturedAt).toLocaleString('en-ZA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return '<div class="lp-lead">' +
      '<div class="lp-top"><span class="lp-name">' + (l.name || 'Unknown') + '</span><span class="lp-time">' + date + '</span></div>' +
      '<div class="lp-meta"><span>' + (l.phone || '-') + '</span>' + (l.email ? '<span>' + l.email + '</span>' : '') + (l.preferredContact ? '<span>' + l.preferredContact + '</span>' : '') + '<span>' + (l.vehicle || '-') + '</span></div>' +
      '<span class="lp-status ' + (l.status || 'new') + '">' + (l.status || 'new') + '</span>' +
      (l.booking ? '<div style="margin-top:6px;font-size:11px;color:var(--muted);">Booking: ' + l.booking.date + ' at ' + l.booking.time + '</div>' : '') +
      '</div>';
  }).join('');
}

function exportLeads(){
  const leads = getLeads();
  if(!leads.length){ alert('No leads to export.'); return; }
  const headers = ['ID','Name','Phone','Email','Vehicle','Status','Preferred Contact','Booking Date','Booking Time','Source','Captured At'];
  const rows = leads.map(l => [
    l.id, l.name, l.phone, l.email || '', l.vehicle || '', l.status || 'new',
    l.preferredContact || '',
    l.booking ? l.booking.date : '', l.booking ? l.booking.time : '', l.source || 'TruChat', l.capturedAt
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(f => '"' + String(f).replace(/"/g,'""') + '"').join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'truchat-leads-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

/* ===== AUDIO ===== */
function playSuccessSound(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }catch(e){}
}

/* ===== KNOWLEDGE BASE ===== */
const KNOWLEDGE_BASE = `You are Ray, the friendly digital assistant for True-Cars, a premium pre-owned vehicle dealership based in Simonstown, Cape Town, South Africa.

## About True-Cars
True-Cars is a premium pre-owned vehicle dealership based in Simonstown, Cape Town, with deep roots in the South African motor trade. We handpick quality used vehicles and give straight answers — no pressure, no games. Ray is the digital assistant; a real person from the yard takes over on WhatsApp once a customer is ready to move.

## Contact & Location
- Address: 15 Victory Way, Simonstown, 7441, Cape Town
- Sales / WhatsApp: 062 050 2091
- Landline: 021 007 0393
- Email: sales@true-cars.co.za
- Website: true-cars.co.za (browse full live stock here)

## Trading Hours
- Monday to Friday: 08:00 – 17:30
- Saturday: 08:30 – 14:00
- Sunday: Closed
- Public holidays: hours vary — best to phone ahead`;

const LOCAL_CONTEXT = `## Local Context — Bakkies & South African Lingo
Vehicle words: "bakkie" = pickup/utility; "double cab"/"D/C" = 4-door bakkie; "single cab"/"S/C" = 2-door work bakkie; "4x4" = off-road; "canopy" = load-bay cover; "tow bar" = rear hitch.
Common SA bakkies: Toyota Hilux, Ford Ranger, Isuzu D-Max, VW Amarok, Nissan Navara.`;

function buildSystemPrompt(){
  const stockList = CATALOG.map(v =>
    `- ${v.id}: ${v.year} ${v.brand} ${v.model} — R ${v.price.toLocaleString()} | ${v.km} | ${v.fuel} | ${v.trans} | Badge: ${v.badge}`
  ).join("\n");

  return `${KNOWLEDGE_BASE}

${LOCAL_CONTEXT}

## Dealership Facts
- Name: ${CFG.dealerName}
- Address: ${CFG.address}
- Website: ${CFG.website}
- Working Hours: ${CFG.hoursText.replace(/\n/g, "; ")}
- WhatsApp: ${CFG.salesWhatsApp}
- Finance rate: Prime + 2% (approx ${CFG.financeRate}% annual)

## Current Stock (${CATALOG.length} vehicles)
${stockList}

## How You Work
- Short, clear answers (2-3 sentences).
- Use **bold** for key info.
- Prices in South African Rand (R).`;
}

/* ===== THREE.JS BACKGROUND ===== */
(function(){
  const container = document.getElementById('bg3d');
  if(!container || typeof THREE === 'undefined') return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const grid = new THREE.GridHelper(60, 40, 0x00f2fe, 0x1e293b);
  grid.position.y = -3.5;
  scene.add(grid);

  const count = 300;
  const pos = new Float32Array(count * 3);
  for(let i=0;i<count*3;i++) pos[i] = (Math.random()-.5)*50;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size:.14, color:0x00f2fe, transparent:true, opacity:.7 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  camera.position.set(0, 2, 8);
  let mx=0, my=0;
  window.addEventListener('mousemove', e=>{
    mx = (e.clientX/window.innerWidth-.5)*.4;
    my = (e.clientY/window.innerHeight-.5)*.4;
  }, {passive:true});

  const clock = new THREE.Clock();
  (function animate(){
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    pts.rotation.y = t*.04;
    camera.position.x += (mx*3 - camera.position.x)*.05;
    camera.position.y += (-my*3 + 2 - camera.position.y)*.05;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

/* ===== CLOUDFLARE WORKER PROXY CLIENT ===== */
async function callProxyApi(userMessage){
  if(!CFG.proxyUrl){
    throw new Error("No Cloudflare Proxy Endpoint configured");
  }
  
  const messages = [];
  const recent = apiMessages.slice(-20);
  recent.forEach(m => messages.push(m));
  messages.push({ role: "user", content: userMessage });

  const res = await fetch(CFG.proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: messages,
      prompt: userMessage,
      context: {
        dealerName: CFG.dealerName,
        assistantName: CFG.assistantName,
        whatsapp: CFG.salesWhatsApp
      }
    })
  });

  if(!res.ok){
    const err = await res.text();
    throw new Error(`Proxy HTTP ${res.status}: ${err}`);
  }

  const data = await res.json();
  const replyText = data.reply || data.completion || data.content?.[0]?.text || "Sorry, I didn't catch that.";

  apiMessages.push({ role: "user", content: userMessage });
  apiMessages.push({ role: "assistant", content: replyText });
  if(apiMessages.length > 40) apiMessages = apiMessages.slice(-40);

  return replyText;
}

function setApiStatus(status){
  const el = document.getElementById('apiStatus');
  if(!el) return;
  el.className = 'api-status ' + status;
  if(status === 'connected' || status === 'proxy') el.textContent = 'Proxy Live';
  else if(status === 'local') el.textContent = 'Local Mode';
  else el.textContent = 'Disconnected';
}

function normalizeText(text){ return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function containsAny(text, keywords){ const n = normalizeText(text); return keywords.some(k => n.includes(normalizeText(k))); }

function filterStock(query){
  const n = normalizeText(query);
  let results = CATALOG.filter(v => normalizeText(v.brand + " " + v.model + " " + v.year + " " + v.fuel + " " + v.trans + " " + v.badge).includes(n));
  if(results.length === 0){
    const syns = {
      "bakkie": ["ranger","hilux","navara","d-max"],
      "suv": ["tucson"],
      "hatchback": ["polo","swift","a3"],
      "sedan": ["320i","c200"],
      "diesel": ["gd-6","dci","td","si-t"],
      "petrol": ["tsi","tfsi"]
    };
    for(const [key, vals] of Object.entries(syns)){
      if(vals.some(s => n.includes(s)) || n.includes(key)){
        results = CATALOG.filter(v => normalizeText(v.brand + " " + v.model + " " + v.fuel).includes(key) || vals.some(t => normalizeText(v.brand + " " + v.model).includes(t)));
        if(results.length) break;
      }
    }
  }
  const pm = query.match(/(?:under|below|less than|around|up to)[\s]*R?\s*([\d\s,]+)/i);
  if(pm && results.length){ const mp = parseInt(pm[1].replace(/[^\d]/g,'')); results = results.filter(v => v.price <= mp); }
  if(containsAny(query, ["cheap","budget","affordable"])) results = results.filter(v => v.price <= 350000);
  if(containsAny(query, ["luxury","premium","expensive"])) results = results.filter(v => v.price >= 450000);
  return results.length ? results : CATALOG.slice(0, 4);
}

function calculateRepayment(price, deposit, balloonPct, termMonths, annualRate){
  const principal = price - (deposit || 0);
  const balloon = principal * (balloonPct / 100);
  const financed = principal - balloon;
  const monthlyRate = (annualRate / 100) / 12;
  if(monthlyRate === 0) return { monthly: financed / termMonths, totalInterest: 0, totalCost: price, balloon: 0, principal: financed };
  const monthly = financed * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
  const totalPaid = (monthly * termMonths) + balloon + (deposit || 0);
  return { monthly: Math.round(monthly), totalInterest: Math.round(totalPaid - price), totalCost: Math.round(totalPaid), balloon: Math.round(balloon), principal: Math.round(financed) };
}

function parseFinanceInput(text){
  let price = null, deposit = null, balloon = 0, term = 60;
  const nums = text.match(/R?\s*([\d\s,.]+)/g);
  if(nums){ const parsed = nums.map(m => parseInt(m.replace(/[^\d]/g,''))).filter(x => x > 1000); if(parsed.length >= 1) price = parsed[0]; if(parsed.length >= 2) deposit = parsed[1]; }
  const tm = text.match(/(\d+)[\s]*(?:month|months|mo|y|years?)/i);
  if(tm){ let t = parseInt(tm[1]); if(text.toLowerCase().includes('year')) t *= 12; term = Math.min(Math.max(t, 12), 72); }
  const bm = text.match(/(\d+)[\s]*%?[\s]*(?:balloon|residual)/i);
  if(bm) balloon = parseInt(bm[1]);
  if(text.toLowerCase().includes('no deposit')) deposit = 0;
  return { price, deposit, balloon, term };
}

/* ===== TOPIC CLASSIFIER ===== */
function classifyTopic(text){
  const raw = String(text || "").trim().toLowerCase();

  const bookingPhrases = [
    /\bbook\b.*\b(test drive|appointment|slot|viewing|visit)\b/,
    /\b(test drive|appointment|viewing)\b.*\bbook\b/,
    /\bschedule\b.*\b(test drive|appointment|visit)\b/,
    /\b(can i|could i|may i)\b.*\b(test drive|book|schedule)\b/,
    /\bbook\b.*\b(slot|time|date)\b/
  ];
  for(const re of bookingPhrases){ if(re.test(raw)) return 'booking'; }

  if(/\b(finance|financing|afford|affordability|repayment|monthly|deposit|balloon|interest|calculate|budget|installment|paaiment)\b/.test(raw)) return 'finance';
  if(/\b(trade[- ]?in|sell my|sell vehicle|sell car|valuation|value my car|part exchange|px)\b/.test(raw)) return 'tradein';
  if(/\b(stock|cars|browse|ranger|hilux|polo|audi|bmw|mercedes|isuzu|hyundai|suzuki|nissan|bakkie|suv|hatchback|sedan|available)\b/.test(raw)) return 'stock';
  if(/\b(hours|location|address|open|where|find you|directions|simonstown|cape town)\b/.test(raw)) return 'hours';
  if(/\b(warranty|service plan|maintenance|roadworthy|inspection|history|extended warranty)\b/.test(raw)) return 'warranty';
  if(/\b(human|person|call|phone|speak|salesman|manager|whatsapp|contact|talk to someone|yard)\b/.test(raw)) return 'human';

  return 'unknown';
}

const JOKE_FALLBACKS = [
  "Hmm, you've stumped me there. Ever heard of Google? 😄 In the meantime, I can help with stock, finance, trade-ins, or bookings — what are you after?",
  "That's above my pay grade. Best I can do is point you to **true-cars.co.za** for the full story, or help you with cars, finance, or a test drive.",
  "I don't have the answer to that one, bru. The yard might though — WhatsApp us on **{wa}** or check **true-cars.co.za**."
];

function getJokeFallback(){
  return JOKE_FALLBACKS[Math.floor(Math.random() * JOKE_FALLBACKS.length)].replace(/{wa}/g, '+' + CFG.salesWhatsApp);
}

/* ===== LOCAL PROCESSING ===== */
function localProcess(text, tab){
  const raw = String(text || "").trim();
  const topic = classifyTopic(raw);

  switch(topic){
    case 'stock':{
      const results = filterStock(raw);
      session.vehicleInterest = results[0] || null;
      let msg = results.length > 1 ? `Here are ${results.length} units on our floor:` : `Here's what we have:`;
      return { text: msg, vehicles: results.slice(0, 4), suggestions: ["Finance help","Trade-in valuation","Book test drive"] };
    }
    case 'finance':{
      const p = parseFinanceInput(raw);
      if(!p.price) return { text: "I can run a finance estimate. Our panel works with major SA banks at **Prime + 2%** (approx **11.5%**). What price and deposit did you have in mind?", suggestions: ["R 300k budget","R 450k budget","No deposit"] };
      if(p.deposit === null) p.deposit = Math.round(p.price * 0.10);
      const calc = calculateRepayment(p.price, p.deposit, p.balloon, p.term, CFG.financeRate);
      const fcard = { rows: [
        { label: "Vehicle Price", value: "R " + p.price.toLocaleString() },
        { label: "Deposit", value: "R " + p.deposit.toLocaleString() },
        { label: "Term", value: p.term + " months" },
        { label: "Monthly Repayment", value: "R " + calc.monthly.toLocaleString(), highlight: true },
        { label: "Total Interest", value: "R " + calc.totalInterest.toLocaleString() }
      ]};
      return { text: `Estimated repayment for **R ${p.price.toLocaleString()}**:`, financeCard: fcard, suggestions: ["Lower deposit?","Book test drive"] };
    }
    case 'tradein':{
      return { text: "For a trade-in estimate I need:\n1. **Year** (e.g. 2020)\n2. **Make & Model** (e.g. Toyota Hilux)\n3. **Mileage** (e.g. 55 000 km)", suggestions: ["2021 Ford Ranger 45k km","Browse stock"] };
    }
    case 'booking':{
      activeCalendarId++;
      return { text: `Happy to book a test drive at **${CFG.dealerName}**. Pick a date and time below:`, calendarId: activeCalendarId, suggestions: [] };
    }
    case 'hours':{
      return { text: `**${CFG.dealerName}**\n📍 ${CFG.address}\n🕐 ${CFG.hoursText.replace(/\n/g, '\n')}`, suggestions: ["Browse stock","Book test drive"] };
    }
    case 'warranty':{
      return { text: `Every vehicle comes with:\n\n✅ Multi-point inspection\n✅ Roadworthy certificate\n✅ Verified service history`, suggestions: ["Browse stock","Book test drive"] };
    }
    case 'human':{
      return { text: `Connecting you to a representative. You can also chat directly on WhatsApp at **+${CFG.salesWhatsApp}**.`, suggestions: ["Browse stock"] };
    }
    default:{
      return { text: getJokeFallback(), suggestions: CFG.suggestionsAI };
    }
  }
}

function deriveSuggestions(reply){
  const r = reply.toLowerCase();
  const sugs = [];
  if(r.includes('stock') || r.includes('vehicle')) sugs.push("Browse stock");
  if(r.includes('finance') || r.includes('repayment')) sugs.push("Finance help");
  if(r.includes('test drive') || r.includes('book')) sugs.push("Book test drive");
  if(r.includes('trade')) sugs.push("Trade-in valuation");
  if(sugs.length === 0) sugs.push(...CFG.suggestionsAI.slice(0, 3));
  return sugs.slice(0, 4);
}

async function processMessage(text, tab){
  if(tab === 'human') return localProcess(text, tab);
  if(CFG.apiMode === 'local'){ setApiStatus('local'); return localProcess(text, tab); }

  if(CFG.apiMode === 'proxy' || CFG.apiMode === 'auto' || CFG.apiMode === 'api'){
    try{
      const reply = await callProxyApi(text);
      setApiStatus('connected');
      return { text: reply, suggestions: deriveSuggestions(reply) };
    }catch(err){
      console.warn("Proxy call failed, checking fallback mode...", err);
      setApiStatus('disconnected');
      if(CFG.apiMode === 'proxy') {
        return { text: `Unable to reach proxy endpoint (${err.message}). Defaulting to local assistant mode.`, suggestions: ["Browse stock","Finance help"] };
      }
      return localProcess(text, tab);
    }
  }

  setApiStatus('local');
  return localProcess(text, tab);
}

function formatGreeting(type){
  const tmpl = type==='human' ? CFG.greetingHuman : CFG.greetingAI;
  return tmpl.replace(/{dealer}/g, CFG.dealerName).replace(/{assistant}/g, CFG.assistantName);
}

function saveHistory(){ try{ sessionStorage.setItem('truchat-history', JSON.stringify(chatHistory)); }catch(e){} }
function loadHistory(){ try{ const raw = sessionStorage.getItem('truchat-history'); if(raw) chatHistory = JSON.parse(raw); }catch(e){} }

function renderMessage(msg, type, animate=true){
  const body = document.getElementById('tcBody');
  if(!body) return;
  const div = document.createElement('div');
  div.className = 'msg ' + (type==='user' ? 'user' : 'bot');
  if(!animate) div.style.animation = 'none';

  if(type==='bot' && msg.vehicles){
    let html = (msg.text ? msg.text.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>') : '');
    html += '<div class="vcard">';
    msg.vehicles.forEach(v=>{
      html += `<div class="vcard-item">
        <div class="vhead"><span class="vtitle">${v.year} ${v.brand} ${v.model}</span><span class="vbadge">${v.badge}</span></div>
        <div class="vmeta"><span>${v.km}</span><span>${v.fuel}</span><span>${v.trans}</span></div>
        <div class="vprice"><span class="cur">R</span>${v.price.toLocaleString()}</div>
        <div class="vcta">
          <button class="btn-primary" onclick="tcSendPrompt('Book test drive for the ${v.brand} ${v.model}')">Book test drive</button>
          <button class="btn-ghost" onclick="tcSendPrompt('Finance on the ${v.brand} ${v.model}')">Finance</button>
        </div>
      </div>`;
    });
    html += '</div>';
    if(msg.suggestions && msg.suggestions.length) html += '<div class="sugs">' + msg.suggestions.map(s=>`<button onclick="tcSendPrompt('${s.replace(/'/g,"\'")}')">${s}</button>`).join('') + '</div>';
    div.innerHTML = html;
  } else if(type==='bot' && msg.financeCard){
    let html = (msg.text ? msg.text.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>') : '');
    html += '<div class="fcard">';
    msg.financeCard.rows.forEach(r=>{ html += `<div class="frow"><span class="flabel">${r.label}</span><span class="fval ${r.highlight ? 'highlight' : ''}">${r.value}</span></div>`; });
    html += '</div>';
    if(msg.suggestions && msg.suggestions.length) html += '<div class="sugs">' + msg.suggestions.map(s=>`<button onclick="tcSendPrompt('${s.replace(/'/g,"\'")}')">${s}</button>`).join('') + '</div>';
    div.innerHTML = html;
  } else if(type==='bot' && msg.calendarId){
    let html = (msg.text ? msg.text.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>') : '');
    html += buildCalendarHTML(msg.calendarId);
    div.innerHTML = html;
  } else if(type==='bot'){
    div.innerHTML = msg.text.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
    if(msg.suggestions && msg.suggestions.length){
      const sugs = document.createElement('div');
      sugs.className = 'sugs';
      sugs.innerHTML = msg.suggestions.map(s=>`<button onclick="tcSendPrompt('${s.replace(/'/g,"\'")}')">${s}</button>`).join('');
      div.appendChild(sugs);
    }
  } else {
    div.textContent = msg.text;
  }

  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showTyping(){
  const body = document.getElementById('tcBody');
  if(!body) return null;
  const t = document.createElement('div');
  t.className = 'typing';
  t.id = 'typingIndicator';
  t.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(t);
  body.scrollTop = body.scrollHeight;
  return t;
}
function hideTyping(){ const t = document.getElementById('typingIndicator'); if(t) t.remove(); }

function tcSendPrompt(text){
  tcOpen();
  setTimeout(()=>{ 
    const input = document.getElementById('tcInput');
    if(input){ input.value = text; tcSend(); }
  }, 250);
}

async function tcSend(){
  const input = document.getElementById('tcInput');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  input.value = '';

  chatHistory[currentTab].push({type:'user', text});
  renderMessage({text}, 'user');
  saveHistory();

  showTyping();
  const delay = 300 + Math.random() * 400;
  await new Promise(r => setTimeout(r, delay));

  const reply = await processMessage(text, currentTab);
  hideTyping();
  chatHistory[currentTab].push({type:'bot', ...reply});
  renderMessage(reply, 'bot');
  saveHistory();
}

function tcOpen(){
  document.getElementById('tcWrap')?.classList.add('open');
  document.getElementById('tcProactive')?.classList.remove('visible');
  renderTab(currentTab);
  setTimeout(()=>document.getElementById('tcInput')?.focus(), 300);
}
function tcClose(){ document.getElementById('tcWrap')?.classList.remove('open'); }

function switchTab(tab){
  currentTab = tab;
  document.querySelectorAll('.tc-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  renderTab(tab);
}

function renderTab(tab){
  const body = document.getElementById('tcBody');
  if(!body) return;
  body.innerHTML = '';
  const history = chatHistory[tab];
  if(!history.length){
    const greeting = formatGreeting(tab);
    const suggestions = tab==='human' ? CFG.suggestionsHuman : CFG.suggestionsAI;
    renderMessage({text: greeting, suggestions}, 'bot', false);
  } else {
    history.forEach((msg)=>{ renderMessage(msg, msg.type, false); });
  }
  body.scrollTop = body.scrollHeight;
}

function toggleDev(){
  const btn = document.getElementById('devToggle');
  const grid = document.getElementById('devGrid');
  if(grid && btn){
    const open = grid.classList.toggle('open');
    btn.classList.toggle('open', open);
  }
}

function updateConfig(){
  CFG.dealerName = document.getElementById('cfgName')?.value || "True-Cars";
  CFG.assistantName = document.getElementById('cfgAssistant')?.value || "Ray";
  CFG.salesWhatsApp = document.getElementById('cfgWA')?.value || "27620502091";
  CFG.proxyUrl = document.getElementById('cfgProxyUrl')?.value || "https://ruchat-api-proxy.leads-5de.workers.dev";
  CFG.apiMode = document.getElementById('cfgApiMode')?.value || "proxy";
  
  const headName = document.getElementById('tcHeadName');
  if(headName) headName.textContent = CFG.assistantName + " · " + CFG.dealerName;

  if(CFG.apiMode === 'local') setApiStatus('local');
  else if(CFG.proxyUrl) setApiStatus('connected');
  else setApiStatus('disconnected');
}

(function init(){
  loadHistory();
  document.getElementById('tcInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter') tcSend(); });
  setTimeout(()=>{
    const wrap = document.getElementById('tcWrap');
    if(wrap && !wrap.classList.contains('open')) document.getElementById('tcProactive')?.classList.add('visible');
  }, 12000);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ tcClose(); document.getElementById('leadsPanel')?.classList.remove('open'); }});
  updateConfig();
})();