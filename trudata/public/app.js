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
// Map bureau form/report types → CREDIT_COSTS keys
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
// // 2 & 3. Vehicle Cascading Dropdowns & Valuation
const vehicleForm = document.getElementById('search-vehicles');
const makeSelect = document.getElementById('vehicle-make');
const modelSelect = document.getElementById('vehicle-model');
const variantSelect = document.getElementById('vehicle-variant');
const yearSelect = document.getElementById('vehicle-year');
const btnSearch = document.getElementById('btn-search');

let currentMakeData = [];
let modelGroups = {};

async function initVehicleMakes() {
  if (!makeSelect) return;
  try {
    const res = await fetch('/catalogue/index.json');
    if (!res.ok) throw new Error('Failed to load makes');
    const makesList = await res.json();
    makesList.sort((a, b) => a.name.localeCompare(b.name));
    makeSelect.innerHTML = '<option value="">Select Make...</option>' + 
      makesList.map(m => `<option value="${esc(m.name)}" data-file="${esc(m.file)}">${esc(m.name)}</option>`).join('');
    makeSelect.disabled = false;
  } catch (err) {
    console.error('Failed to init vehicle makes', err);
  }
}
initVehicleMakes();

if (makeSelect) {
  makeSelect.addEventListener('change', async () => {
    const make = makeSelect.value;
    modelSelect.innerHTML = '<option value="">Select Model...</option>';
    modelSelect.disabled = true;
    variantSelect.innerHTML = '<option value="">Select Variant...</option>';
    variantSelect.disabled = true;
    yearSelect.innerHTML = '<option value="">Select Year...</option>';
    yearSelect.disabled = true;
    if (btnSearch) btnSearch.disabled = true;
    
    if (!make) return;
    modelSelect.innerHTML = '<option value="">Loading models...</option>';
    
    try {
      let items = [];
      try {
        const res = await fetch(`/api/imagin8/models?make=${encodeURIComponent(make)}`);
        if (res.ok) {
          items = await res.json();
        }
      } catch (e) {}
      
      if (!items || !items.length) {
        const opt = makeSelect.selectedOptions[0];
        const file = opt?.dataset?.file;
        if (file) {
          const catRes = await fetch(`/catalogue/${file}`);
          if (catRes.ok) {
            const catData = await catRes.json();
            items = [];
            for (const [group, variants] of Object.entries(catData)) {
              for (const [vName, vData] of Object.entries(variants)) {
                items.push({
                  make,
                  modelGroup: group,
                  model: vName,
                  mmCode: vData.c,
                  years: vData.y
                });
              }
            }
          }
        }
      }
      
      currentMakeData = items;
      modelGroups = {};
      
      items.forEach(item => {
        let groupName = item.modelGroup;
        if (!groupName) {
          const raw = (item.model || '').trim();
          const words = raw.split(/\s+/);
          if (words.length <= 2) {
            groupName = raw;
          } else {
            if (/^(QUEST|CROSS|SPORT|PLUS|SEDAN|HATCH|R1|R6|R7|R3|PRO|MAX)$/i.test(words[1])) {
              groupName = `${words[0]} ${words[1]}`;
            } else {
              groupName = words[0];
            }
          }
        }
        
        if (!modelGroups[groupName]) {
          modelGroups[groupName] = [];
        }
        modelGroups[groupName].push(item);
      });
      
      const groupNames = Object.keys(modelGroups).sort();
      if (!groupNames.length) {
        modelSelect.innerHTML = '<option value="">No models found</option>';
        return;
      }
      
      modelSelect.innerHTML = '<option value="">Select Model...</option>' +
        groupNames.map(g => `<option value="${esc(g)}">${esc(g)} (${modelGroups[g].length})</option>`).join('');
      modelSelect.disabled = false;
    } catch (err) {
      console.error('Error loading models', err);
      modelSelect.innerHTML = '<option value="">Error loading models</option>';
    }
  });
}

if (modelSelect) {
  modelSelect.addEventListener('change', () => {
    const selectedGroup = modelSelect.value;
    variantSelect.innerHTML = '<option value="">Select Variant...</option>';
    variantSelect.disabled = true;
    yearSelect.innerHTML = '<option value="">Select Year...</option>';
    yearSelect.disabled = true;
    if (btnSearch) btnSearch.disabled = true;
    
    if (!selectedGroup || !modelGroups[selectedGroup]) return;
    
    const variants = modelGroups[selectedGroup];
    variantSelect.innerHTML = '<option value="">Select Variant...</option>' +
      variants.map((v, idx) => `<option value="${idx}">${esc(v.model || selectedGroup)}</option>`).join('');
    variantSelect.disabled = false;
    
    if (variants.length === 1) {
      variantSelect.value = "0";
      variantSelect.dispatchEvent(new Event('change'));
    }
  });
}

if (variantSelect) {
  variantSelect.addEventListener('change', () => {
    const selectedGroup = modelSelect.value;
    const variantIdx = variantSelect.value;
    yearSelect.innerHTML = '<option value="">Select Year...</option>';
    yearSelect.disabled = true;
    if (btnSearch) btnSearch.disabled = true;
    
    if (variantIdx === '' || !modelGroups[selectedGroup]) return;
    const v = modelGroups[selectedGroup][Number(variantIdx)];
    if (!v) return;
    
    let years = [];
    if (v.years && v.years.length) {
      years = v.years;
    } else {
      const currentYear = new Date().getFullYear();
      let startYear = v.introDate ? parseInt(v.introDate.split('-')[0], 10) : 2010;
      let endYear = v.disconDate ? parseInt(v.disconDate.split('-')[0], 10) : currentYear;
      if (isNaN(startYear) || startYear < 1990) startYear = 2010;
      if (isNaN(endYear) || endYear > currentYear) endYear = currentYear;
      if (startYear > endYear) startYear = endYear;
      for (let y = endYear; y >= startYear; y--) {
        years.push(y);
      }
    }
    
    if (!years.length) {
      years = [new Date().getFullYear()];
    }
    
    yearSelect.innerHTML = '<option value="">Select Year...</option>' +
      years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.disabled = false;
    
    yearSelect.value = String(years[0]);
    if (btnSearch) btnSearch.disabled = false;
  });
}

if (yearSelect) {
  yearSelect.addEventListener('change', () => {
    if (btnSearch) btnSearch.disabled = !yearSelect.value;
  });
}

if (vehicleForm) {
  vehicleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const make = makeSelect.value;
    const selectedGroup = modelSelect.value;
    const variantIdx = variantSelect.value;
    const year = yearSelect.value;
    
    if (!make || !selectedGroup || variantIdx === '' || !year) {
      showToast('Please select make, model, variant, and year.', 'error');
      return;
    }
    
    const v = modelGroups[selectedGroup][Number(variantIdx)];
    const variantName = v?.model || '';
    runVehicleValuation(make, selectedGroup, year, variantName);
  });
}

async function runVehicleValuation(make, model, year, variant) {
  showResults('vehicle');
  setResultsLoading(true);
  try {
    const res = await fetch('/api/valuation/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ make, model, year, variant })
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
  const displayModel = data.variant ? `${data.model || ''} (${data.variant})` : (data.model || '');
  if (titleEl) titleEl.textContent = `${data.make || ''} ${displayModel} ${data.year || ''} Market Value`;
  
  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${data.sampleSize || data.totalActiveListings || data.count || 0} listings found`;
  
  const sourceEl = document.getElementById('results-source');
  if (sourceEl) {
    const sources = data.sources || {};
    if (typeof sources === 'object' && !Array.isArray(sources)) {
      sourceEl.textContent = `Sources: Cars.co.za (${sources.carsCoZa || 0}), AutoTrader (${sources.autoTrader || 0})`;
    } else {
      sourceEl.textContent = 'Sources: AutoTrader, Cars.co.za';
    }
  }
  
  const content = document.getElementById('results-content');
  if (content) {
    const metrics = data.metrics || {};
    const valuation = data.valuation || {};
    const medianVal = valuation.retail || metrics.median || data.medianAskingPrice || data.median || 0;
    const tradeVal = valuation.trade || (medianVal ? Math.round(medianVal * 0.85) : 0);
    const minVal = metrics.min || data.priceRange?.min || data.low || 0;
    const maxVal = metrics.max || data.priceRange?.max || data.high || 0;
    const sampleSize = data.sampleSize || data.totalActiveListings || data.count || 0;
    const conf = typeof data.confidence === 'number' 
      ? `${(data.confidence * 100).toFixed(0)}%` 
      : (data.confidence || 'NONE').toUpperCase();

    content.innerHTML = `
      <div class="results-grid">
        <div class="metric-card">
          <span class="metric-label">Est. Retail Value</span>
          <span class="metric-value">R ${numberFormat(medianVal)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Est. Trade Value</span>
          <span class="metric-value">R ${numberFormat(tradeVal)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Market Range</span>
          <span class="metric-value">R ${numberFormat(minVal)} – R ${numberFormat(maxVal)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Listings Scraped</span>
          <span class="metric-value">${sampleSize}</span>
        </div>
      </div>
      <div style="margin-top: 1rem; font-size: 0.875rem; color: #a1a1aa;">
        Confidence Score: ${conf}
      </div>
    `;
  }
  
  const pricingDiv = document.getElementById('results-pricing');
  if (pricingDiv) pricingDiv.classList.remove('hidden');
  
  const leadCountEl = document.getElementById('lead-count');
  if (leadCountEl) leadCountEl.textContent = '1';
  
  const leadCostEl = document.getElementById('lead-cost');
  if (leadCostEl) leadCostEl.textContent = 'R' + (BURN_RATES['valuation'] * PAYG_RATE).toFixed(2);

  const btnOrder = document.getElementById('btn-order');
  if (btnOrder) {
    btnOrder.onclick = () => openOrderModal('valuation', BURN_RATES['valuation'] * PAYG_RATE);
  }
}

// 4. Property Search
const formProperty = document.getElementById('search-property');
if (formProperty) {
  formProperty.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('suburb-search');
    const typeEl = document.getElementById('property-type');
    const modeEl = document.getElementById('property-mode');
    
    if (!inputEl) return;
    const suburb = inputEl.value.trim();
    if (!suburb) return;
    
    const propertyType = typeEl ? typeEl.value : 'Any';
    const mode = modeEl ? modeEl.value : 'comps';
    
    showResults('property');
    setResultsLoading(true);
    try {
      const res = await fetch(`/api/property/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb, propertyType })
      });
      if (!res.ok) throw new Error('Property search failed');
      const data = await res.json();
      
      const titleEl = document.getElementById('results-title');
      if (titleEl) titleEl.textContent = mode === 'comps' ? `${suburb} Property Value` : `${suburb} Private Sellers`;
      
      if (mode === 'comps') {
        const countEl = document.getElementById('results-count');
        if (countEl) countEl.textContent = `${data.totalActiveListings || data.count || 0} listings found`;
        
        const sourceEl = document.getElementById('results-source');
        if (sourceEl) sourceEl.textContent = 'Sources: Property24, Private Property';
        
        const content = document.getElementById('results-content');
        if (content) {
          content.innerHTML = `
            <div class="results-grid">
              <div class="metric-card">
                <span class="metric-label">Median Asking Price</span>
                <span class="metric-value">R ${numberFormat(data.medianAskingPrice || data.median)}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Price Range</span>
                <span class="metric-value">R ${numberFormat(data.priceRange?.min || data.low)} - R ${numberFormat(data.priceRange?.max || data.high)}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Active Listings</span>
                <span class="metric-value">${data.totalActiveListings || data.count || 0}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Confidence</span>
                <span class="metric-value confidence-${data.confidence || 'none'}">${(data.confidence || 'none').toUpperCase()}</span>
              </div>
            </div>
          `;
        }
      } else {
        // FSBO
        const countEl = document.getElementById('results-count');
        if (countEl) countEl.textContent = `${data.count || 0} owner sellers found`;
        
        const sourceEl = document.getElementById('results-source');
        if (sourceEl) sourceEl.textContent = 'Sources: Private Property, Gumtree';
        
        const content = document.getElementById('results-content');
        if (content) {
          if (!data.leads || data.leads.length === 0) {
            content.innerHTML = `<div class="empty-state">No private sellers found in this area right now.</div>`;
          } else {
            content.innerHTML = `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Headline</th>
                    <th>Price</th>
                    <th>Owner</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.leads.map(l => `
                    <tr>
                      <td>${esc(l.headline)}</td>
                      <td>${esc(l.formattedPrice)}</td>
                      <td>${esc(l.ownerName)}</td>
                      <td>${esc(l.phone || 'Unknown')} ${l.whatsAppUrl ? `<a href="${esc(l.whatsAppUrl)}" target="_blank" style="color:#22c55e">[WhatsApp]</a>` : ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }
        }
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
      const businesses = data.targets || data.results || [];
      
      const titleEl = document.getElementById('results-title');
      if (titleEl) titleEl.textContent = `${industry} in ${city}`;
      
      const countEl = document.getElementById('results-count');
      if (countEl) countEl.textContent = `${businesses.length} businesses found`;
      
      const sourceEl = document.getElementById('results-source');
      if (sourceEl) sourceEl.textContent = 'Sources: Google Search, Technical Site Audit, Contact Extraction';
      
      const content = document.getElementById('results-content');
      if (content) {
        if (businesses.length === 0) {
          content.innerHTML = '<p>No businesses found.</p>';
        } else {
          content.innerHTML = `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Business / Website</th>
                  <th>Contact Info</th>
                  <th>Audit & Defects</th>
                </tr>
              </thead>
              <tbody>
                ${businesses.map(b => {
                  const name = b.businessName || b.name || b.domain || 'Local Business';
                  const domain = b.domain || '';
                  const phone = b.contacts?.phones?.[0] || b.phone || '';
                  const email = b.contacts?.emails?.[0] || b.email || '';
                  const wa = b.contacts?.whatsAppLinks?.[0] || '';
                  const score = b.readinessScore != null ? b.readinessScore : (b.defectScore || 0);
                  const defectCount = b.defects?.length || 0;
                  const pitch = b.estimatedPitchValue || '';

                  return `<tr>
                    <td>
                      <strong>${esc(name)}</strong><br>
                      ${domain ? `<a href="https://${esc(domain)}" target="_blank" rel="noopener" style="color:var(--volt,#22c55e);font-size:0.8rem">${esc(domain)}</a>` : ''}
                    </td>
                    <td>
                      ${phone ? `<div>📞 ${esc(phone)}</div>` : ''}
                      ${email ? `<div>✉️ <small>${esc(email)}</small></div>` : ''}
                      ${wa ? `<div><a href="${esc(wa)}" target="_blank" style="color:#22c55e;font-size:0.8rem">[WhatsApp]</a></div>` : ''}
                      ${!phone && !email && !wa ? '<span style="color:#71717a">Portal Contact</span>' : ''}
                    </td>
                    <td>
                      <div><strong>Health Score:</strong> ${score}/100</div>
                      <small style="color:${defectCount > 0 ? '#ef4444' : '#22c55e'}">${defectCount} issue${defectCount === 1 ? '' : 's'} identified</small>
                      ${pitch ? `<br><small style="color:#a1a1aa">Pitch: ${esc(pitch)}</small>` : ''}
                    </td>
                  </tr>`;
                }).join('')}
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
    if (!idInput) {
      showToast('Please enter a VIN, Reg, or M&M code.', 'error');
      return;
    }
    
    showResults('bureau');
    setResultsLoading(true);
    try {
      let endpoint = reportType;
      let bodyPayload = {};
      
      if (reportType === 'accident') {
        endpoint = 'accident-report';
        bodyPayload = { vin: idInput };
      } else if (reportType === 'regcheck') {
        endpoint = 'regcheck';
        const type = idInput.length === 17 ? 'VIN' : 'REG';
        bodyPayload = { identifier: idInput, type };
      } else if (reportType === 'valuation') {
        endpoint = 'valuation';
        const parts = idInput.split(/\s+/);
        const mmCode = parts[0];
        const year = parts.length > 1 ? parts[1] : new Date().getFullYear().toString();
        bodyPayload = { mmCode, year };
      }

      const res = await fetch(`/api/imagin8/${encodeURIComponent(endpoint)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-trudata-client': 'trudata-spa'
        },
        body: JSON.stringify(bodyPayload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || 'Bureau lookup failed');
      }
      const data = await res.json();
      
      const titleEl = document.getElementById('results-title');
      if (titleEl) titleEl.textContent = `Bureau Report: ${reportType.toUpperCase()}`;
      
      const countEl = document.getElementById('results-count');
      if (countEl) countEl.textContent = `Record matched`;
      
      const sourceEl = document.getElementById('results-source');
      if (sourceEl) sourceEl.textContent = 'Source: TransUnion eValue8';
      
      const content = document.getElementById('results-content');
      if (content) {
        let metricsHtml = '';
        if (reportType === 'valuation') {
          metricsHtml = `
            <div class="results-grid">
              <div class="metric-card">
                <span class="metric-label">TU Retail</span>
                <span class="metric-value">R ${numberFormat(data.mmRetail || data.retail || 0)}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">TU Trade</span>
                <span class="metric-value">R ${numberFormat(data.mmTrade || data.trade || 0)}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">TU Cost</span>
                <span class="metric-value">R ${numberFormat(data.mmCost || 0)}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">M&M Code</span>
                <span class="metric-value">${esc(data.mmCode || bodyPayload.mmCode)}</span>
              </div>
            </div>
          `;
        } else {
          metricsHtml = `
            <div class="results-grid">
              <div class="metric-card" style="grid-column: span 2;">
                <span class="metric-label">Bureau Status</span>
                <span class="metric-value" style="color: #22c55e;">VERIFIED</span>
              </div>
            </div>
          `;
        }
        
        content.innerHTML = `
          ${metricsHtml}
          <div style="margin-top: 1rem;">
            <pre style="padding: 1rem; background: var(--bg-surface); border-radius: var(--radius-md); overflow-x: auto; font-size: 0.85rem; color: #a1a1aa;">${esc(JSON.stringify(data, null, 2))}</pre>
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
      renderError(err.message || 'Could not retrieve bureau report.');
      showToast(err.message || 'Bureau search failed.', 'error');
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
  safepayForm.addEventListener('submit', (e) => {
    e.preventDefault();
    runSafePay();
  });
  const safepayBtn = safepayForm.querySelector('.btn-primary');
  if (safepayBtn) {
    safepayBtn.addEventListener('click', (e) => {
      e.preventDefault();
      runSafePay();
    });
  }
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
  const catRes = document.getElementById('catalogue-results');
  const vInput = document.getElementById('vehicle-search');
  if (catRes && !catRes.contains(e.target) && e.target !== vInput) {
    catRes.classList.add('hidden');
  }
});
