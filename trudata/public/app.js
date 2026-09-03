// TruData — app.js

// Utilities
function esc(str) { 
  if (str === null || str === undefined) return '';
  const div = document.createElement('div'); 
  div.textContent = str; 
  return div.innerHTML; 
}

function numberFormat(n) {
  return Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}

// Credit economy — pulled from /api/orders/credits/packs on load
const PAYG_RATE = 13.27; // R per credit (PAYG tier)
const BURN_RATES = {
  'valuation': 1,
  'property': 1,
  'business_audit': 2,
  'business_contacts': 2,
  'bureau_valuation': 3,
  'bureau_regcheck': 3,
  'bureau_accident': 3,
  'safepay': 3,
};
// Map form/report type → burn rate key
const BURN_KEY = {
  'valuation': 'bureau_valuation',
  'regcheck': 'bureau_regcheck',
  'accident': 'bureau_accident',
};
function creditCost(product) {
  const key = BURN_KEY[product] || product;
  const credits = BURN_RATES[key] || 0;
  return credits * PAYG_RATE;
}
function creditCostRounded(product) {
  return creditCost(product).toFixed(2);
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function setResultsLoading(isLoading) {
  const content = document.getElementById('results-content');
  if (!content) return;
  if (isLoading) {
    content.innerHTML = '<div class="loading"><div class="spinner"></div><span>Searching live sources...</span></div>';
  }
}

function renderEmpty(msg) {
  const content = document.getElementById('results-content');
  if (content) {
    content.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>${esc(msg || "No results found. You won't be charged.")}</p></div>`;
  }
}

function showResults(engine) {
  const resultsDiv = document.getElementById('results');
  if (resultsDiv) resultsDiv.classList.remove('hidden');
  const pricingDiv = document.getElementById('results-pricing');
  if (pricingDiv) pricingDiv.classList.add('hidden');
}

function renderError(msg) {
  const content = document.getElementById('results-content');
  if (content) {
    content.innerHTML = `<div class="error-message">${esc(msg)}</div>`;
  }
}

// 1. Tab Switching
document.querySelectorAll('.engine-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Update active tab styling
    document.querySelectorAll('.engine-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Hide all search forms, show the matching one
    const engine = tab.dataset.engine;
    ['vehicles', 'property', 'business', 'bureau', 'safepay'].forEach(e => {
      const form = document.getElementById(`search-${e}`);
      if (form) {
        if (e === engine) {
          form.classList.remove('hidden');
        } else {
          form.classList.add('hidden');
        }
      }
    });

    const resultsDiv = document.getElementById('results');
    if (resultsDiv) resultsDiv.classList.add('hidden');
  });
});

// Vertical card buttons → scroll to console + switch tab
document.querySelectorAll('.select-vertical').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const tab = document.querySelector(`.engine-tabs .tab[data-engine="${target}"]`);
    if (tab) tab.click();
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
  });
});

// Nav links → switch tab
document.querySelectorAll('.nav-link[data-target]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.dataset.target;
    const tab = document.querySelector(`.engine-tabs .tab[data-engine="${target}"]`);
    if (tab) tab.click();
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
  });
});
// 2 & 3. Vehicle Catalogue Typeahead & Valuation
const vehicleSearchInput = document.getElementById('vehicle-search');
const catalogueResults = document.getElementById('catalogue-results');
let debounceTimer = null;

if (vehicleSearchInput) {
  vehicleSearchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = vehicleSearchInput.value.trim();
    if (q.length < 2) { hideCatalogueDropdown(); return; }
    debounceTimer = setTimeout(() => searchCatalogue(q), 300);
  });
}

function hideCatalogueDropdown() {
  if (catalogueResults) catalogueResults.classList.add('hidden');
}

async function searchCatalogue(q) {
  try {
    const res = await fetch(`/api/catalogue/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('Failed to search');
    const data = await res.json();
    renderCatalogueDropdown(data.results || []);
  } catch (err) {
    // silently fail for typeahead
  }
}

function renderCatalogueDropdown(results) {
  if (!catalogueResults) return;
  if (!results.length) { catalogueResults.classList.add('hidden'); return; }
  
  catalogueResults.innerHTML = results.map(r => {
    const yearRange = r.years && r.years.length ? `${r.years[r.years.length-1]}–${r.years[0]}` : '';
    return `
    <div class="catalogue-item" data-make="${esc(r.make)}" data-model="${esc(r.model)}" data-years="${(r.years || []).join(',')}" data-mmcode="${esc(r.mmCode)}">
      <strong>${esc(r.make)}</strong> · ${esc(r.model)}
      ${yearRange ? `<span class="years">${yearRange}</span>` : ''}
    </div>
  `}).join('');
  catalogueResults.classList.remove('hidden');
  
  catalogueResults.querySelectorAll('.catalogue-item').forEach(item => {
    item.addEventListener('click', () => {
      const make = item.dataset.make;
      const model = item.dataset.model;
      const yearStr = item.dataset.years;
      const year = yearStr ? yearStr.split(',')[0] : '';
      vehicleSearchInput.value = `${make} ${model} ${year}`;
      catalogueResults.classList.add('hidden');
      runVehicleValuation(make, model, year);
    });
  });
}

async function runVehicleValuation(make, model, year) {
  showResults('vehicle');
  setResultsLoading(true);
  try {
    const res = await fetch('/api/valuation/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ make, model, year })
    });
    if (!res.ok) throw new Error('Valuation failed');
    const data = await res.json();
    renderVehicleResults(data);
  } catch (err) {
    renderError('Could not get valuation. Please try again.');
    showToast('Failed to retrieve vehicle valuation.', 'error');
  }
  setResultsLoading(false);
}

function renderVehicleResults(data) {
  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `${data.make || ''} ${data.model || ''} ${data.year || ''} Market Value`;
  
  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${data.count || 0} listings found`;
  
  const sourceEl = document.getElementById('results-source');
  if (sourceEl) sourceEl.textContent = 'Sources: AutoTrader, Cars.co.za';
  
  const content = document.getElementById('results-content');
  if (content) {
    content.innerHTML = `
      <div class="results-grid">
        <div class="metric-card">
          <span class="metric-label">Median Price</span>
          <span class="metric-value">R ${numberFormat(data.median)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Price Range</span>
          <span class="metric-value">R ${numberFormat(data.low)} – R ${numberFormat(data.high)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Listings Found</span>
          <span class="metric-value">${data.count || 0}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Confidence</span>
          <span class="metric-value confidence-${data.confidence || 'none'}">${(data.confidence || 'none').toUpperCase()}</span>
        </div>
      </div>
      ${data.sources && data.sources.length ? `
      <h3>Source Breakdown</h3>
      <table class="data-table">
        <thead><tr><th>Source</th><th>Average Price</th><th>Listings</th></tr></thead>
        <tbody>
          ${data.sources.map(s => `<tr><td>${esc(s.source)}</td><td>R ${numberFormat(s.avg)}</td><td>${s.count}</td></tr>`).join('')}
        </tbody>
      </table>` : ''}
    `;
  }
  
  const pricingDiv = document.getElementById('results-pricing');
  if (pricingDiv) pricingDiv.classList.remove('hidden');
  
  const leadCountEl = document.getElementById('lead-count');
  if (leadCountEl) leadCountEl.textContent = '1';
  
const leadCostEl = document.getElementById('lead-cost');
  if (leadCostEl) leadCostEl.textContent = 'R' + creditCostRounded('valuation');

  const btnOrder = document.getElementById('btn-order');
  if (btnOrder) {
    btnOrder.onclick = () => openOrderModal('valuation', creditCost('valuation'));
  }
}

// 4. Property Search
const formProperty = document.getElementById('search-property');
if (formProperty) {
  formProperty.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('suburb-search');
    if (!inputEl) return;
    const suburb = inputEl.value.trim();
    if (!suburb) return;
    
    showResults('property');
    setResultsLoading(true);
    try {
      const res = await fetch('/api/property/comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb })
      });
      if (!res.ok) throw new Error('Property search failed');
      const data = await res.json();
      
      const titleEl = document.getElementById('results-title');
      if (titleEl) titleEl.textContent = `${suburb} Property Value`;
      
      const countEl = document.getElementById('results-count');
      if (countEl) countEl.textContent = `${data.count || 0} listings found`;
      
      const sourceEl = document.getElementById('results-source');
      if (sourceEl) sourceEl.textContent = 'Sources: Property24, Private Property';
      
      const content = document.getElementById('results-content');
      if (content) {
        content.innerHTML = `
          <div class="results-grid">
            <div class="metric-card">
              <span class="metric-label">Median Price</span>
              <span class="metric-value">R ${numberFormat(data.median)}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Price Range</span>
              <span class="metric-value">R ${numberFormat(data.low)} – R ${numberFormat(data.high)}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">Listings Found</span>
              <span class="metric-value">${data.count || 0}</span>
            </div>
          </div>
        `;
      }
      
      const pricingDiv = document.getElementById('results-pricing');
      if (pricingDiv) pricingDiv.classList.remove('hidden');
      
      const leadCountEl = document.getElementById('lead-count');
      if (leadCountEl) leadCountEl.textContent = '1';
      
const leadCostEl = document.getElementById('lead-cost');
      if (leadCostEl) leadCostEl.textContent = 'R' + creditCostRounded('property');

      const btnOrder = document.getElementById('btn-order');
      if (btnOrder) {
        btnOrder.onclick = () => openOrderModal(`Property: ${suburb}`, creditCost('property'));
      }
    } catch (err) {
      renderError('Could not get property data. Please try again.');
      showToast('Property search failed.', 'error');
    }
    setResultsLoading(false);
  });
}

// 5. Business Finder
const formBusiness = document.getElementById('search-business');
if (formBusiness) {
  formBusiness.addEventListener('submit', async (e) => {
    e.preventDefault();
    const indEl = document.getElementById('business-type');
    const cityEl = document.getElementById('business-city');
    if (!indEl || !cityEl) return;
    
    const industry = indEl.value.trim();
    const city = cityEl.value.trim();
    if (!industry || !city) return;
    
    showResults('business');
    setResultsLoading(true);
    try {
      const res = await fetch('/api/agency/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, city })
      });
      if (!res.ok) throw new Error('Business search failed');
      const data = await res.json();
      const businesses = data.results || [];
      
      const titleEl = document.getElementById('results-title');
      if (titleEl) titleEl.textContent = `${industry} in ${city}`;
      
      const countEl = document.getElementById('results-count');
      if (countEl) countEl.textContent = `${businesses.length} businesses found`;
      
      const sourceEl = document.getElementById('results-source');
      if (sourceEl) sourceEl.textContent = 'Sources: Google Maps, Yellow Pages, Local Directories';
      
      const content = document.getElementById('results-content');
      if (content) {
        if (businesses.length === 0) {
          content.innerHTML = '<p>No businesses found.</p>';
        } else {
          content.innerHTML = `
            <table class="data-table">
              <thead><tr><th>Name</th><th>Contact</th><th>Defect Score</th></tr></thead>
              <tbody>
                ${businesses.map(b => `<tr>
                  <td><strong>${esc(b.name)}</strong></td>
                  <td>${esc(b.phone || 'N/A')}<br><small>${esc(b.email || '')}</small></td>
                  <td>${esc(b.defectScore || '0')}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          `;
        }
      }
      
      const pricingDiv = document.getElementById('results-pricing');
      if (pricingDiv) pricingDiv.classList.remove('hidden');
      
      const leadCountEl = document.getElementById('lead-count');
      if (leadCountEl) leadCountEl.textContent = businesses.length.toString();
      
const leadCostEl = document.getElementById('lead-cost');
      if (leadCostEl) leadCostEl.textContent = 'R' + (businesses.length * creditCost('business_audit')).toFixed(2);

      const btnOrder = document.getElementById('btn-order');
      if (btnOrder) {
        btnOrder.onclick = () => openOrderModal(`Business Leads: ${industry} in ${city}`, businesses.length * creditCost('business_audit'));
      }
    } catch (err) {
      renderError('Could not find businesses. Please try again.');
      showToast('Business search failed.', 'error');
    }
    setResultsLoading(false);
  });
}

// 6. Bureau Reports
const formBureau = document.getElementById('search-bureau');
if (formBureau) {
  formBureau.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEl = document.getElementById('bureau-input');
    const typeEl = document.getElementById('bureau-type');
    if (!idEl || !typeEl) return;
    
    const idInput = idEl.value.trim();
    const reportType = typeEl.value;
    if (!idInput) return;
    
    showResults('bureau');
    setResultsLoading(true);
    try {
      const res = await fetch(`/api/imagin8/${encodeURIComponent(reportType)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idInput })
      });
      if (!res.ok) throw new Error('Bureau search failed');
      const data = await res.json();
      
      const titleEl = document.getElementById('results-title');
      if (titleEl) titleEl.textContent = `Bureau Report: ${reportType}`;
      
      const countEl = document.getElementById('results-count');
      if (countEl) countEl.textContent = `Record matched`;
      
      const sourceEl = document.getElementById('results-source');
      if (sourceEl) sourceEl.textContent = 'Sources: Imagin8, CIPC, Home Affairs';
      
      const content = document.getElementById('results-content');
      if (content) {
        content.innerHTML = `
          <div class="report-summary">
            <p><strong>Status:</strong> ${esc(data.status || 'Active')}</p>
            <p><strong>Flags:</strong> ${esc(data.flags || 'None')}</p>
            <p><em>Full report details will be provided upon purchase.</em></p>
          </div>
        `;
      }
      
      const pricingDiv = document.getElementById('results-pricing');
      if (pricingDiv) pricingDiv.classList.remove('hidden');
      
      const leadCountEl = document.getElementById('lead-count');
      if (leadCountEl) leadCountEl.textContent = '1';
      
const leadCostEl = document.getElementById('lead-cost');
      if (leadCostEl) leadCostEl.textContent = 'R' + creditCostRounded(reportType);

      const btnOrder = document.getElementById('btn-order');
      if (btnOrder) {
        btnOrder.onclick = () => openOrderModal(`Bureau Report: ${reportType}`, creditCost(reportType));
      }
    } catch (err) {
      renderError('Could not retrieve bureau report. Please try again.');
      showToast('Bureau search failed.', 'error');
    }
    setResultsLoading(false);
  });
}

// 6.5 SafePay Bank Verification
async function runSafePay() {
  const account = document.getElementById('safepay-account').value.trim();
  const branch = document.getElementById('safepay-branch').value.trim();
  const idNum = document.getElementById('safepay-id').value.trim();
  const initials = document.getElementById('safepay-initials').value.trim();
  const surname = document.getElementById('safepay-surname').value.trim();

  if (!account || !branch || !idNum) {
    showToast('Please enter bank account, branch code, and ID number.', 'error');
    return;
  }

  showResults('safepay');
  setResultsLoading(true);
  try {
    const res = await fetch('/api/safepay/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankAccount: account, branchCode: branch, idNumber: idNum, initials, surname }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Verification failed');
    }
    const data = await res.json();
    renderSafePayResults(data);
  } catch (err) {
    renderError(err.message || 'Could not verify account. Please try again.');
  }
  setResultsLoading(false);
}

function renderSafePayResults(data) {
  document.getElementById('results-title').textContent = 'SafePay Bank Verification';
  document.getElementById('results-count').textContent = `Score: ${data.score}`;
  document.getElementById('results-source').textContent = 'Source: TransUnion AVS';

  const content = document.getElementById('results-content');
  content.innerHTML = `
    <div class="safepay-result ${data.verified ? 'verified' : 'failed'}">
      <div class="safepay-badge">${data.verified ? '✅ VERIFIED' : '❌ NOT VERIFIED'}</div>
      <p class="safepay-score">Passed ${data.score} checks</p>
      ${data.accountType ? `<p>Account type: <strong>${esc(data.accountType)}</strong></p>` : ''}
    </div>
    <div class="results-grid">
      ${data.checks.map(c => `
        <div class="metric-card">
          <span class="metric-label">${esc(c.label)}</span>
          <span class="metric-value ${c.passed ? 'confidence-high' : 'confidence-low'}">${c.passed ? 'PASS' : 'FAIL'}</span>
        </div>
      `).join('')}
    </div>
    <p class="results-timestamp">Verified at: ${new Date(data.verifiedAt).toLocaleString()}</p>
  `;

  // No order button for SafePay — credits are burned on the API call itself
  document.getElementById('results-pricing').classList.add('hidden');
}

const safepayForm = document.getElementById('search-safepay');
if (safepayForm) {
  const safepayBtn = safepayForm.querySelector('.btn-primary');
  if (safepayBtn) safepayBtn.addEventListener('click', runSafePay);
}

// 7. Order Modal
function openOrderModal(product, price) {
  window._orderProduct = product;
  
  const summaryEl = document.getElementById('order-summary');
  if (summaryEl) summaryEl.innerHTML = `<p><strong>${esc(product)}</strong> — R ${Number(price).toFixed(2)}</p>`;
  
  const modal = document.getElementById('order-modal');
  if (modal) modal.classList.remove('hidden');
}

const modalOrderForm = document.getElementById('order-form');
if (modalOrderForm) {
  modalOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('order-name');
    const emailEl = document.getElementById('order-email');
    
    if (!nameEl || !emailEl) return;
    
    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    
    if (!email) { showToast('Please enter your email', 'error'); return; }
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, product: window._orderProduct || 'unknown' })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Order failed', 'error'); return; }
      
      showToast('Order created! Check your email for details.');
      const modal = document.getElementById('order-modal');
      if (modal) modal.classList.add('hidden');
      modalOrderForm.reset();
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    }
  });
}

document.querySelectorAll('#order-modal .close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = document.getElementById('order-modal');
    if (modal) modal.classList.add('hidden');
  });
});

// 8. Real Chat
const chatHistory = [];
const chatWindow = document.getElementById('chat-window');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');
const chatToggleBtn = document.getElementById('chat-toggle');

if (chatToggleBtn) {
  chatToggleBtn.addEventListener('click', () => {
    if (chatWindow) chatWindow.classList.toggle('hidden');
  });
}

const chatCloseBtn = document.getElementById('chat-close');
if (chatCloseBtn) {
  chatCloseBtn.addEventListener('click', () => {
    if (chatWindow) chatWindow.classList.add('hidden');
  });
}

function appendChat(role, text) {
  if (!chatMessages) return;
  const div = document.createElement('div');
  div.className = `chat-msg chat-${role}`;
  div.innerHTML = `<span class="msg-content">${esc(text)}</span>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage(text) {
  appendChat('user', text);
  chatHistory.push({ role: 'user', content: text });
  
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory })
    });
    if (!res.ok) throw new Error('Chat failed');
    const data = await res.json();
    appendChat('bot', data.reply);
    chatHistory.push({ role: 'assistant', content: data.reply });
  } catch {
    appendChat('bot', 'Sorry, chat is temporarily unavailable.');
  }
}

if (chatSendBtn && chatInput) {
  chatSendBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    sendChatMessage(text);
  });
  
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      sendChatMessage(text);
    }
  });
}

// Chat suggestion chips
document.querySelectorAll('.chat-suggestions .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const text = chip.textContent.trim();
    if (chatWindow) chatWindow.classList.remove('hidden');
    sendChatMessage(text);
    const suggestions = chip.parentElement;
    if (suggestions) suggestions.classList.add('hidden');
  });
});

// 10. Cookie Banner + Hamburger Menu
const cookieBanner = document.getElementById('cookie-banner');
if (cookieBanner) {
  if (!localStorage.getItem('cookies-accepted')) {
    cookieBanner.classList.remove('hidden');
  }
  const acceptBtn = document.getElementById('cookie-accept');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('cookies-accepted', 'true');
      cookieBanner.classList.add('hidden');
    });
  }
}

const hamburgerBtn = document.getElementById('hamburger-btn');
const navLinks = document.querySelector('.nav-links');
if (hamburgerBtn && navLinks) {
  hamburgerBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}

// Close click outside dropdowns
document.addEventListener('click', (e) => {
  if (catalogueResults && !catalogueResults.contains(e.target) && e.target !== vehicleSearchInput) {
    catalogueResults.classList.add('hidden');
  }
});
