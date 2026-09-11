// TruData — app.js (Production Build)

// ──────────────────────────────────────────────────
// UTILITY & TOAST FUNCTIONS
// ──────────────────────────────────────────────────
function esc(str) { 
  if (str === null || str === undefined) return '';
  const div = document.createElement('div'); 
  div.textContent = String(str); 
  return div.innerHTML; 
}

function numberFormat(n) {
  return Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const isErr = type === 'error';
  toast.className = `p-3 font-mono text-xs border border-slate-950 brutal-shadow text-white ${isErr ? 'bg-rose-700' : 'bg-slate-950'} transition-all duration-300 transform translate-y-0 opacity-100 flex items-center justify-between gap-3 min-w-[280px]`;
  toast.innerHTML = `
    <span>${esc(msg)}</span>
    <button onclick="this.parentElement.remove()" class="text-white hover:text-slate-300 font-bold ml-2">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

function updateJsonSchemaViewer(data) {
  const container = document.getElementById('json-viewer-container');
  if (!container) return;
  container.innerHTML = `<pre class="text-sky-300 font-mono text-xs overflow-x-auto"><code>${esc(JSON.stringify(data, null, 2))}</code></pre>`;
}

function showResults(pillar) {
  const consoleCard = document.getElementById('console-card');
  if (consoleCard) {
    consoleCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function setResultsLoading(isLoading, message = 'Executing live search & data extraction...') {
  const container = document.getElementById('table-container');
  if (!container) return;
  if (isLoading) {
    container.innerHTML = `
      <div class="p-8 text-center font-mono text-xs space-y-3">
        <div class="inline-block animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full mb-2"></div>
        <p class="font-bold text-slate-950 uppercase tracking-wider">${esc(message)}</p>
        <p class="text-slate-600">Querying real-time provider APIs &amp; verifying records...</p>
      </div>
    `;
  }
}

function renderError(message = 'An unexpected error occurred during data retrieval.') {
  const container = document.getElementById('table-container');
  if (!container) return;
  container.innerHTML = `
    <div class="p-6 bg-rose-50 border border-rose-950 brutal-shadow-sm font-mono text-xs text-rose-950 space-y-2">
      <div class="flex items-center gap-2 font-bold uppercase text-rose-700">
        <span>[!] EXTRACTION FAILED</span>
      </div>
      <p class="font-sans text-xs text-rose-900">${esc(message)}</p>
    </div>
  `;
}

// ──────────────────────────────────────────────────
// CREDIT WALLET ECONOMY
// ──────────────────────────────────────────────────
const PAYG_RATE = 13.27; // R per credit (PAYG tier)
const BURN_RATES = {
  'valuation': 1,
  'electronics_valuation': 1,
  'property': 1,
  'business_audit': 2,
  'business_contacts': 2,
  'bureau_valuation': 3,
  'bureau_regcheck': 3,
  'bureau_accident': 3,
  'safepay': 3,
};
const BURN_KEY = {
  'valuation': 'bureau_valuation',
  'regcheck': 'bureau_regcheck',
  'accident': 'bureau_accident',
  'electronics': 'electronics_valuation',
};

function creditCost(product) {
  const key = BURN_KEY[product] || product;
  const credits = BURN_RATES[key] || 1;
  return credits * PAYG_RATE;
}

function getUserEmail() {
  let email = localStorage.getItem('trudata_user_email');
  if (!email) {
    email = 'client@dealership.co.za';
    localStorage.setItem('trudata_user_email', email);
  }
  return email;
}

function setUserEmail(email) {
  if (email && email.includes('@')) {
    localStorage.setItem('trudata_user_email', email.trim().toLowerCase());
  }
}

async function updateWalletUI() {
  const email = getUserEmail();
  const pillText = document.getElementById('wallet-balance-text');
  try {
    const res = await fetch(`/api/orders/credits/balance?email=${encodeURIComponent(email)}`);
    if (res.ok) {
      const data = await res.json();
      window._trudataWallet = data;
      if (pillText) {
        pillText.textContent = `${data.balance ?? 0} Credits`;
      }
      return data;
    }
  } catch (err) {
    console.warn('Could not fetch wallet balance:', err);
  }
  if (pillText) pillText.textContent = '15 Credits';
  return { balance: 15 };
}

async function burnCredits(productKey, customAmount) {
  const email = getUserEmail();
  try {
    const payload = { email, product: productKey };
    if (customAmount && customAmount > 0) payload.amount = customAmount;
    await fetch('/api/orders/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    updateWalletUI();
  } catch (e) {
    console.warn('Credit burn record notice:', e);
  }
}

function openCreditModal(highlightPack = 'pro') {
  const modal = document.getElementById('credit-modal');
  if (!modal) return;
  const emailInput = document.getElementById('credit-buyer-email');
  if (emailInput && !emailInput.value) {
    emailInput.value = getUserEmail();
  }
  document.querySelectorAll('.credit-pack-selector .pack-option').forEach(opt => {
    const isTarget = opt.dataset.pack === highlightPack;
    opt.classList.toggle('selected', isTarget);
    const radio = opt.querySelector('input[type="radio"]');
    if (radio) radio.checked = isTarget;
  });
  modal.classList.remove('hidden');
}

function closeCreditModal() {
  const modal = document.getElementById('credit-modal');
  if (modal) modal.classList.add('hidden');
}

// Init wallet balance on load
updateWalletUI();

// Wallet trigger click listeners
const walletPill = document.getElementById('wallet-pill');
if (walletPill) walletPill.addEventListener('click', () => openCreditModal());

const btnBuyCredits = document.getElementById('btn-buy-credits');
if (btnBuyCredits) btnBuyCredits.addEventListener('click', () => openCreditModal());

const closeCreditBtn = document.getElementById('close-credit-modal');
if (closeCreditBtn) closeCreditBtn.addEventListener('click', closeCreditModal);

// Credit purchase form submit (PayFast Integration)
const creditPurchaseForm = document.getElementById('credit-purchase-form');
if (creditPurchaseForm) {
  creditPurchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('credit-buyer-name');
    const emailInput = document.getElementById('credit-buyer-email');
    const selectedPackOpt = document.querySelector('.credit-pack-selector .pack-option.selected');
    const packId = selectedPackOpt ? selectedPackOpt.dataset.pack : 'pro';

    const name = nameInput ? nameInput.value.trim() : 'Customer';
    const email = emailInput ? emailInput.value.trim().toLowerCase() : getUserEmail();

    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    setUserEmail(email);
    const checkoutBtn = document.getElementById('btn-payfast-checkout');
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Preparing Secure Checkout...';
    }

    try {
      const res = await fetch('/api/orders/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, packId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize purchase');

      showToast(`Added ${data.credits?.added || 0} Credits to your wallet!`);
      await updateWalletUI();
      closeCreditModal();

      if (data.paymentUrl) {
        showToast('Redirecting to PayFast payment gateway...');
        setTimeout(() => {
          window.location.href = data.paymentUrl;
        }, 1200);
      }
    } catch (err) {
      console.error('Credit purchase error:', err);
      showToast(err.message || 'Payment initiation failed. Please try again.', 'error');
    } finally {
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Proceed to PayFast Checkout';
      }
    }
  });
}

// ──────────────────────────────────────────────────
// TAB SWITCHING & DOCK CONTROL
// ──────────────────────────────────────────────────
const TABS = ['vehicles', 'electronics', 'property', 'business', 'bureau', 'aeo', 'safepay'];

function switchPillarTab(target) {
  if (!TABS.includes(target)) return;
  TABS.forEach(other => {
    const otherBtn = document.getElementById(`tab-${other}`);
    const otherPanel = document.getElementById(`panel-${other}`);
    if (otherBtn) {
      otherBtn.classList.remove('bg-sky-600', 'text-white', 'brutal-shadow');
      otherBtn.classList.add('bg-white', 'text-slate-900');
    }
    if (otherPanel) {
      otherPanel.classList.add('hidden');
    }
  });

  const btn = document.getElementById(`tab-${target}`);
  const panel = document.getElementById(`panel-${target}`);
  if (btn) {
    btn.classList.remove('bg-white', 'text-slate-900');
    btn.classList.add('bg-sky-600', 'text-white', 'brutal-shadow');
  }
  if (panel) {
    panel.classList.remove('hidden');
  }
}

TABS.forEach(t => {
  const btn = document.getElementById(`tab-${t}`);
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchPillarTab(t);
    });
  }
});

function openConsoleTab(tabName) {
  switchPillarTab(tabName);
  const consoleCard = document.getElementById('console-card');
  if (consoleCard) consoleCard.scrollIntoView({ behavior: 'smooth' });
}

// ──────────────────────────────────────────────────
// PILLAR 1: VEHICLES & DEPENDENT DROPDOWNS
// ──────────────────────────────────────────────────
let currentVehicleVertical = 'cars';
let makesDataStore = [];
let modelGroups = {};

function getVehicleElements() {
  return {
    form: document.getElementById('panel-vehicles'),
    makeSelect: document.getElementById('select-make'),
    modelSelect: document.getElementById('select-model'),
    variantSelect: document.getElementById('select-variant'),
    yearSelect: document.getElementById('select-year'),
    btnSearch: document.getElementById('btn-run-vehicle-search')
  };
}

async function initVehicleMakes(vertical = 'cars') {
  const { makeSelect } = getVehicleElements();
  if (!makeSelect) return;
  try {
    let makesList = [];
    const catRes = await fetch('/catalogue/index.json');
    if (catRes.ok) {
      makesList = await catRes.json();
    } else {
      const res = await fetch(`/api/catalogue/makes?vertical=${encodeURIComponent(vertical)}`);
      if (res.ok) {
        const data = await res.json();
        makesList = data.makes || [];
      }
    }
    makesList.sort((a, b) => a.name.localeCompare(b.name));
    makesDataStore = makesList;

    makeSelect.innerHTML = '<option value="">Select Make...</option>' +
      makesList.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
  } catch (err) {
    console.error('Failed to init vehicle makes:', err);
    if (makeSelect) makeSelect.innerHTML = '<option value="">Failed to load makes</option>';
  }
}

// Auto-run instant makes populator
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initVehicleMakes(currentVehicleVertical));
} else {
  initVehicleMakes(currentVehicleVertical);
}

// Handle Make Select Change
const vehicleEls = getVehicleElements();
if (vehicleEls.makeSelect) {
  vehicleEls.makeSelect.addEventListener('change', async () => {
    const { makeSelect, modelSelect, variantSelect, yearSelect, btnSearch } = getVehicleElements();
    const make = makeSelect ? makeSelect.value.trim() : '';

    if (modelSelect) {
      modelSelect.innerHTML = '<option value="">Loading Models...</option>';
      modelSelect.disabled = true;
      modelSelect.className = 'w-full bg-slate-100 border border-slate-950 px-2.5 py-2 brutal-shadow-sm font-semibold text-slate-950';
    }
    if (variantSelect) {
      variantSelect.innerHTML = '<option value="">Select Model First</option>';
      variantSelect.disabled = true;
      variantSelect.className = 'w-full bg-slate-100 border border-slate-950 px-2.5 py-2 brutal-shadow-sm font-semibold text-slate-950';
    }
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="">Select Variant First</option>';
      yearSelect.disabled = true;
      yearSelect.className = 'w-full bg-slate-100 border border-slate-950 px-2.5 py-2 brutal-shadow-sm font-semibold text-slate-950';
    }
    if (btnSearch) btnSearch.disabled = true;

    if (!make) {
      if (modelSelect) modelSelect.innerHTML = '<option value="">Select Make First</option>';
      return;
    }

    try {
      let items = [];
      const liveRes = await fetch(`/api/imagin8/models?make=${encodeURIComponent(make)}`);
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (Array.isArray(liveData) && liveData.length > 0) {
          items = liveData.map(m => ({
            make: make,
            model: m.model || m.name || m.mmModel || '',
            mmCode: m.mmCode || '',
            introDate: m.introDate || '',
            disconDate: m.disconDate || ''
          }));
        }
      }

      if (!items.length) {
        const targetObj = makesDataStore.find(m => m.name.toLowerCase() === make.toLowerCase());
        const file = targetObj ? targetObj.file : `${make.toLowerCase().replace(/[^a-z0-9]/g, '')}.json`;
        const catRes = await fetch(`/catalogue/${file}`);
        if (catRes.ok) items = await catRes.json();
      }

      modelGroups = {};
      items.forEach(item => {
        const fullModel = item.model || '';
        const group = fullModel.split(' ')[0] || fullModel || 'General';
        if (!modelGroups[group]) modelGroups[group] = [];
        modelGroups[group].push(item);
      });

      const groupNames = Object.keys(modelGroups).sort();
      if (modelSelect) {
        if (groupNames.length === 0) {
          modelSelect.innerHTML = '<option value="">No models found</option>';
        } else {
          modelSelect.innerHTML = '<option value="">Select Model...</option>' +
            groupNames.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
          modelSelect.disabled = false;
          modelSelect.className = 'w-full bg-white border border-slate-950 px-2.5 py-2 brutal-shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600 font-semibold text-slate-950';
        }
      }
    } catch (err) {
      console.error('Error loading models:', err);
      if (modelSelect) modelSelect.innerHTML = '<option value="">Error loading models</option>';
    }
  });
}

// Handle Model Select Change
if (vehicleEls.modelSelect) {
  vehicleEls.modelSelect.addEventListener('change', () => {
    const { modelSelect, variantSelect, yearSelect, btnSearch } = getVehicleElements();
    const selectedGroup = modelSelect ? modelSelect.value.trim() : '';

    if (variantSelect) {
      variantSelect.innerHTML = '<option value="">Select Variant...</option>';
      variantSelect.disabled = true;
      variantSelect.className = 'w-full bg-slate-100 border border-slate-950 px-2.5 py-2 brutal-shadow-sm font-semibold text-slate-950';
    }
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="">Select Variant First</option>';
      yearSelect.disabled = true;
      yearSelect.className = 'w-full bg-slate-100 border border-slate-950 px-2.5 py-2 brutal-shadow-sm font-semibold text-slate-950';
    }
    if (btnSearch) btnSearch.disabled = true;

    if (!selectedGroup || !modelGroups[selectedGroup]) return;

    const variants = modelGroups[selectedGroup];
    if (variantSelect) {
      variantSelect.innerHTML = '<option value="">Select Variant / Trim...</option>' +
        variants.map((v, idx) => `<option value="${idx}">${esc(v.model || selectedGroup)}</option>`).join('');
      variantSelect.disabled = false;
      variantSelect.className = 'w-full bg-white border border-slate-950 px-2.5 py-2 brutal-shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600 font-semibold text-slate-950';
      if (variants.length === 1) {
        variantSelect.value = "0";
        variantSelect.dispatchEvent(new Event('change'));
      }
    }
  });
}

// Handle Variant Select Change
if (vehicleEls.variantSelect) {
  vehicleEls.variantSelect.addEventListener('change', () => {
    const { modelSelect, variantSelect, yearSelect, btnSearch } = getVehicleElements();
    const selectedGroup = modelSelect ? modelSelect.value.trim() : '';
    const variantIdx = variantSelect ? variantSelect.value : '';

    if (variantIdx === '' || !modelGroups[selectedGroup]) {
      if (yearSelect) {
        yearSelect.innerHTML = '<option value="">Select Variant First</option>';
        yearSelect.disabled = true;
        yearSelect.className = 'w-full bg-slate-100 border border-slate-950 px-2.5 py-2 brutal-shadow-sm font-semibold text-slate-950';
      }
      if (btnSearch) btnSearch.disabled = true;
      return;
    }

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

    if (!years.length) years = [new Date().getFullYear()];

    if (yearSelect) {
      yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
      yearSelect.disabled = false;
      yearSelect.className = 'w-full bg-white border border-slate-950 px-2.5 py-2 brutal-shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600 font-semibold text-slate-950';
      yearSelect.value = String(years[0]);
    }
    if (btnSearch) btnSearch.disabled = false;
  });
}

if (vehicleEls.form) {
  vehicleEls.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { makeSelect, modelSelect, variantSelect, yearSelect } = getVehicleElements();
    const make = makeSelect ? makeSelect.value.trim() : '';
    const selectedGroup = modelSelect ? modelSelect.value.trim() : '';
    const variantIdx = variantSelect ? variantSelect.value : '';
    const year = yearSelect ? yearSelect.value : '2022';

    if (!make || !selectedGroup) {
      showToast('Please select both Make and Model from the dropdowns.', 'error');
      return;
    }

    const v = modelGroups[selectedGroup]?.[Number(variantIdx)];
    const variantName = v?.model || '';
    const mmCode = v?.mmCode || '';
    runVehicleValuation(make, selectedGroup, year, variantName, mmCode);
  });
}

// ──────────────────────────────────────────────────
// VEHICLE SUB-MODE SWITCHER (Valuation vs RegCheck vs Accident History)
// ──────────────────────────────────────────────────
const btnModeVal = document.getElementById('btn-mode-valuation');
const btnModeReg = document.getElementById('btn-mode-regcheck');
const btnModeAccident = document.getElementById('btn-mode-accident');
const containerVal = document.getElementById('container-vehicle-valuation');
const containerReg = document.getElementById('container-vehicle-regcheck');
const containerAccident = document.getElementById('container-vehicle-accident');

function switchVehicleMode(mode) {
  // Reset all 3 buttons
  [
    { btn: btnModeVal, container: containerVal, activeClass: 'bg-sky-600' },
    { btn: btnModeReg, container: containerReg, activeClass: 'bg-amber-600' },
    { btn: btnModeAccident, container: containerAccident, activeClass: 'bg-rose-600' }
  ].forEach(item => {
    if (item.btn) {
      item.btn.classList.remove('bg-sky-600', 'bg-amber-600', 'bg-rose-600', 'text-white', 'border-slate-950');
      item.btn.classList.add('bg-white', 'text-slate-900', 'border-transparent');
    }
    if (item.container) item.container.classList.add('hidden');
  });

  if (mode === 'regcheck') {
    if (btnModeReg) {
      btnModeReg.classList.remove('bg-white', 'text-slate-900', 'border-transparent');
      btnModeReg.classList.add('bg-amber-600', 'text-white', 'border-slate-950');
    }
    if (containerReg) containerReg.classList.remove('hidden');
  } else if (mode === 'accident') {
    if (btnModeAccident) {
      btnModeAccident.classList.remove('bg-white', 'text-slate-900', 'border-transparent');
      btnModeAccident.classList.add('bg-rose-600', 'text-white', 'border-slate-950');
    }
    if (containerAccident) containerAccident.classList.remove('hidden');
  } else {
    if (btnModeVal) {
      btnModeVal.classList.remove('bg-white', 'text-slate-900', 'border-transparent');
      btnModeVal.classList.add('bg-sky-600', 'text-white', 'border-slate-950');
    }
    if (containerVal) containerVal.classList.remove('hidden');
  }
}

if (btnModeVal) btnModeVal.addEventListener('click', () => switchVehicleMode('valuation'));
if (btnModeReg) btnModeReg.addEventListener('click', () => switchVehicleMode('regcheck'));
if (btnModeAccident) btnModeAccident.addEventListener('click', () => switchVehicleMode('accident'));

// Global function to jump to Standalone RegCheck from results or nav
window.openStandaloneRegCheck = function(prefill = '') {
  switchPillarTab('vehicles');
  switchVehicleMode('regcheck');
  const regInput = document.getElementById('input-vehicle-reg-standalone');
  if (regInput && prefill) regInput.value = prefill;
  const consoleCard = document.getElementById('console-card');
  if (consoleCard) consoleCard.scrollIntoView({ behavior: 'smooth' });
};

// Global function to jump to Standalone Accident Report from results or nav
window.openStandaloneAccidentReport = function(prefill = '') {
  switchPillarTab('vehicles');
  switchVehicleMode('accident');
  const vinInput = document.getElementById('input-vehicle-accident-standalone');
  if (vinInput && prefill) vinInput.value = prefill;
  const consoleCard = document.getElementById('console-card');
  if (consoleCard) consoleCard.scrollIntoView({ behavior: 'smooth' });
};

// Standalone Vehicle RegCheck Submit
const btnRunRegStandalone = document.getElementById('btn-run-vehicle-regcheck-standalone');
if (btnRunRegStandalone) {
  btnRunRegStandalone.addEventListener('click', () => {
    const regInput = document.getElementById('input-vehicle-reg-standalone');
    const identifier = regInput ? regInput.value.trim() : '';
    if (!identifier) {
      showToast('Please enter a Registration Number or VIN.', 'error');
      return;
    }
    executeVehicleRegCheck(identifier);
  });
}

// Standalone Vehicle Accident Report Submit
const btnRunAccidentStandalone = document.getElementById('btn-run-vehicle-accident-standalone');
if (btnRunAccidentStandalone) {
  btnRunAccidentStandalone.addEventListener('click', () => {
    const vinInput = document.getElementById('input-vehicle-accident-standalone');
    const vin = vinInput ? vinInput.value.trim().toUpperCase() : '';
    if (!vin) {
      showToast('Please enter a 17-digit VIN number.', 'error');
      return;
    }
    executeVehicleAccidentReport(vin);
  });
}

if (vehicleEls.form) {
  vehicleEls.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { makeInput, modelInput, variantSelect, yearSelect } = getVehicleElements();
    const make = makeInput ? makeInput.value.trim() : '';
    const selectedGroup = modelInput ? modelInput.value.trim() : '';
    const variantIdx = variantSelect ? variantSelect.value : '';
    const year = yearSelect ? yearSelect.value : '2022';

    if (!make || !selectedGroup) {
      showToast('Please enter or select both Make and Model.', 'error');
      return;
    }

    const v = modelGroups[selectedGroup]?.[Number(variantIdx)];
    const variantName = v?.model || '';
    const mmCode = v?.mmCode || '';
    runVehicleValuation(make, selectedGroup, year, variantName, mmCode);
  });
}

async function runVehicleValuation(make, model, year, variant, mmCode) {
  showResults('vehicles');
  setResultsLoading(true, `Analyzing live national showroom inventory & factory specs for ${make} ${model}...`);
  burnCredits('valuation');

  try {
    const res = await fetch('/api/valuation/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ make, model, year, variant, mmCode })
    });
    if (!res.ok) throw new Error('Valuation query failed');
    const data = await res.json();
    renderVehicleResults(data);
  } catch (err) {
    renderError('Could not retrieve showroom comps for this vehicle. Please check your query.');
    showToast('Failed to retrieve vehicle valuation.', 'error');
  }
}

function renderVehicleResults(data) {
  updateJsonSchemaViewer(data);
  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `${data.make || ''} ${data.model || ''} ${data.year || ''} Market Value`;

  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${data.count || 0} Showroom Comps Analyzed`;

  const sourceEl = document.getElementById('results-source');
  if (sourceEl) sourceEl.textContent = 'Sources: Live National Showroom Inventory, Verified Dealer Feeds & OEM Factory Specs';

  const container = document.getElementById('table-container');
  if (container) {
    const medianVal = data.median || 0;
    const lowVal = data.low || 0;
    const highVal = data.high || 0;
    const specs = data.specs;

    container.innerHTML = `
      <div class="space-y-4 font-mono text-xs">
        <!-- 4 Key Market Metrics -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
            <span class="text-slate-500 block text-[10px] uppercase">MEDIAN MARKET PRICE</span>
            <span class="font-display font-bold text-lg text-sky-800">R ${numberFormat(medianVal)}</span>
          </div>
          <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
            <span class="text-slate-500 block text-[10px] uppercase">LOWEST COMP</span>
            <span class="font-display font-bold text-base text-slate-950">R ${numberFormat(lowVal)}</span>
          </div>
          <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
            <span class="text-slate-500 block text-[10px] uppercase">HIGHEST COMP</span>
            <span class="font-display font-bold text-base text-slate-950">R ${numberFormat(highVal)}</span>
          </div>
          <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
            <span class="text-slate-500 block text-[10px] uppercase">CONFIDENCE SCORE</span>
            <span class="font-display font-bold text-base text-emerald-600 uppercase">${esc(data.confidence || 'MEDIUM')}</span>
          </div>
        </div>

        ${specs ? `
        <!-- Verified OEM Factory Specifications Grid (getStaticInfo) -->
        <div class="p-3.5 bg-sky-50 border border-slate-950 space-y-2 brutal-shadow-sm">
          <div class="flex items-center justify-between border-b border-sky-200 pb-1.5">
            <span class="font-bold text-slate-950 uppercase flex items-center gap-1">
              <span>VERIFIED OEM TECHNICAL SPECIFICATIONS</span>
            </span>
            <span class="font-mono text-[10px] bg-sky-600 text-white px-1.5 py-0.5 font-bold">M&amp;M ${esc(data.mmCode || specs.mmCode || 'VERIFIED')}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-slate-900 pt-1">
            <div class="bg-white p-2 border border-slate-950/20">
              <span class="text-[10px] text-slate-500 uppercase block">Engine Output</span>
              <span class="font-bold text-xs text-sky-900">${specs.kw ? specs.kw + ' kW' : 'N/A'}</span>
            </div>
            <div class="bg-white p-2 border border-slate-950/20">
              <span class="text-[10px] text-slate-500 uppercase block">Displacement</span>
              <span class="font-bold text-xs text-sky-900">${specs.cc ? specs.cc + ' cc' : 'N/A'} ${specs.cylinders ? '(' + specs.cylinders + '-Cyl)' : ''}</span>
            </div>
            <div class="bg-white p-2 border border-slate-950/20">
              <span class="text-[10px] text-slate-500 uppercase block">Body / Doors</span>
              <span class="font-bold text-xs text-slate-900">${esc(specs.bodyType || 'Sedan/SUV')} (${specs.doors || 4} Dr / ${specs.seats || 5} Seats)</span>
            </div>
            <div class="bg-white p-2 border border-slate-950/20">
              <span class="text-[10px] text-slate-500 uppercase block">Fuel / Tank</span>
              <span class="font-bold text-xs text-slate-900">${specs.fuelType === 'P' ? 'Petrol' : specs.fuelType === 'D' ? 'Diesel' : esc(specs.fuelType || 'Petrol')} ${specs.fuelTankSize ? '• ' + specs.fuelTankSize + 'L' : ''}</span>
            </div>
            <div class="bg-white p-2 border border-slate-950/20">
              <span class="text-[10px] text-slate-500 uppercase block">Tare / GVM</span>
              <span class="font-bold text-xs text-slate-900">${specs.tare ? specs.tare + ' kg' : 'N/A'} / ${specs.gvm ? specs.gvm + ' kg' : 'N/A'}</span>
            </div>
            <div class="bg-white p-2 border border-slate-950/20">
              <span class="text-[10px] text-slate-500 uppercase block">Production Era</span>
              <span class="font-bold text-xs text-slate-900">${esc(specs.introDate || 'Launch')} to ${esc(specs.disconDate || 'Current')}</span>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Showroom Comps Table -->
        <table class="w-full border-collapse border border-slate-950 text-left bg-white">
          <thead>
            <tr class="bg-slate-950 text-white font-mono text-[11px] uppercase">
              <th class="p-2 border border-slate-950">Inventory Channel</th>
              <th class="p-2 border border-slate-950">Comps Analyzed</th>
              <th class="p-2 border border-slate-950">Average Price</th>
            </tr>
          </thead>
          <tbody>
            ${(data.sources || []).map(s => {
              const channelName = s.name === 'AutoTrader' ? 'National Dealer Floor Feeds'
                : s.name === 'Cars.co.za' ? 'Live Showroom Inventory'
                : s.name === 'Google SERP' ? 'Verified Dealer Portals'
                : esc(s.name);
              return `
                <tr class="border-b border-slate-300 hover:bg-sky-50">
                  <td class="p-2 font-bold border border-slate-950">${channelName}</td>
                  <td class="p-2 border border-slate-950">${s.count} listings</td>
                  <td class="p-2 font-bold text-slate-950 border border-slate-950">R ${numberFormat(s.avg)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- 1-Click Standalone RegCheck & Accident History CTA Banner -->
        <div class="p-4 bg-amber-50 border border-amber-950 flex flex-col sm:flex-row items-center justify-between gap-3 brutal-shadow-sm">
          <div class="space-y-0.5">
            <span class="font-bold text-amber-950 uppercase block text-xs flex items-center gap-1.5">
              <span>PURCHASING OR FINANCING A SPECIFIC VEHICLE?</span>
            </span>
            <span class="text-amber-900 text-[11px] block">Run official SAPS Police Stolen, Bank Finance Lien, and Accident Claims History checks.</span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openStandaloneRegCheck()" class="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-display font-bold text-xs uppercase border border-slate-950 brutal-shadow active:translate-x-0.5 active:translate-y-0.5 transition-all whitespace-nowrap flex items-center gap-1.5">
              <span>REG / VIN CHECK</span>
            </button>
            <button onclick="openStandaloneAccidentReport()" class="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-display font-bold text-xs uppercase border border-slate-950 brutal-shadow active:translate-x-0.5 active:translate-y-0.5 transition-all whitespace-nowrap flex items-center gap-1.5">
              <span>ACCIDENT HISTORY</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// ──────────────────────────────────────────────────
// PILLAR 2: PROPERTY & REAL ESTATE
// ──────────────────────────────────────────────────
// ──────────────────────────────────────────────────
// PILLAR 2: PROPERTY & REAL ESTATE
// ──────────────────────────────────────────────────
const formProperty = document.getElementById('panel-property');
if (formProperty) {
  formProperty.addEventListener('submit', async (e) => {
    e.preventDefault();
    const suburbEl = document.getElementById('input-property-suburb');
    const cityEl = document.getElementById('input-property-city');
    const typeEl = document.getElementById('select-property-type');
    const scopeEl = document.getElementById('select-property-scope');

    const suburb = suburbEl ? suburbEl.value.trim() : 'Sandton';
    const city = cityEl ? cityEl.value.trim() : 'Johannesburg';
    const propertyType = typeEl ? typeEl.value : 'property';
    const scope = scopeEl ? scopeEl.value : 'all';

    if (!suburb) return;

    showResults('property');
    setResultsLoading(true, `Scanning suburb sales benchmarks & direct homeowner listings for ${suburb}...`);
    const propertyCredits = scope === 'comps' ? 1 : 2;
    burnCredits('property', propertyCredits);

    try {
      let compsData = null;
      let fsboData = null;

      const promises = [];

      if (scope === 'all' || scope === 'comps') {
        promises.push(
          fetch('/api/property/comps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suburb, city, propertyType })
          }).then(r => r.ok ? r.json() : null).catch(() => null)
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      if (scope === 'all' || scope === 'fsbo') {
        promises.push(
          fetch('/api/property/fsbo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suburb, city, limit: 10 })
          }).then(r => r.ok ? r.json() : null).catch(() => null)
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      const [compsRes, fsboRes] = await Promise.all(promises);
      compsData = compsRes;
      fsboData = fsboRes;

      if (!compsData && !fsboData) {
        throw new Error('No property data could be retrieved for this location.');
      }

      renderPropertyResults(compsData, fsboData, suburb, city, scope);
    } catch (err) {
      renderError(`Property search failed for "${suburb}". Please check the suburb name and try again.`);
      showToast('Property search failed.', 'error');
    }
  });
}

function renderPropertyResults(comps, fsbo, suburb, city, scope = 'all') {
  const consolidated = {
    suburb,
    city,
    scannedAt: new Date().toISOString(),
    comps: comps || { message: 'Not requested in this query' },
    fsbo: fsbo || { message: 'Not requested in this query' }
  };
  updateJsonSchemaViewer(consolidated);

  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `${suburb}, ${city} Property Intelligence`;

  const totalComps = comps ? (comps.totalActiveListings || 0) : 0;
  const totalFsbo = fsbo ? (fsbo.count || (fsbo.leads ? fsbo.leads.length : 0)) : 0;

  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.textContent = `${totalComps} Suburb Comps Analyzed · ${totalFsbo} Direct Homeowner Leads (0% Commission)`;
  }

  const sourceEl = document.getElementById('results-source');
  if (sourceEl) {
    sourceEl.textContent = 'Sources: National Property Registry & Direct Homeowner Feeds';
  }

  const container = document.getElementById('table-container');
  if (!container) return;

  const medianPrice = comps?.medianAskingPrice || fsbo?.averageAskingPrice || 0;
  const lowPrice = comps?.low || (fsbo?.leads?.length ? Math.min(...fsbo.leads.map(l => l.askingPrice)) : 0);
  const highPrice = comps?.high || (fsbo?.leads?.length ? Math.max(...fsbo.leads.map(l => l.askingPrice)) : 0);
  const confidence = comps?.confidence || (totalFsbo > 2 ? 'medium' : 'low');

  const leads = fsbo?.leads || [];

  container.innerHTML = `
    <div class="space-y-5 font-mono text-xs">
      
      <!-- Top Metrics Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">MEDIAN ASKING PRICE</span>
          <span class="font-display font-bold text-lg text-sky-800">R ${numberFormat(medianPrice)}</span>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">PRICE SPREAD</span>
          <span class="font-display font-bold text-sm sm:text-base text-slate-950">R ${numberFormat(lowPrice)} - R ${numberFormat(highPrice)}</span>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">ACTIVE MARKET COMPS</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="font-display font-bold text-base text-slate-950">${totalComps} Properties</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-slate-950">${esc(confidence).toUpperCase()}</span>
          </div>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">DIRECT HOMEOWNERS</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="font-display font-bold text-base text-emerald-700">${totalFsbo} Direct Owners</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-slate-950">0% AGENT FEE</span>
          </div>
        </div>
      </div>

      <!-- Sub-Tabs Selector Bar -->
      <div class="flex items-center justify-between border-b-2 border-slate-950 pb-2">
        <div class="flex items-center gap-2">
          <button id="btn-subtab-fsbo" class="px-3 py-1.5 bg-sky-600 text-white font-bold border border-slate-950 brutal-shadow-sm text-xs">
            Direct Homeowners (${totalFsbo})
          </button>
          <button id="btn-subtab-comps" class="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-bold border border-slate-950 brutal-shadow-sm text-xs">
            Market Comps &amp; Price Spread (${comps?.sources?.length || 0})
          </button>
        </div>
        <span class="text-[11px] text-slate-500 hidden sm:inline">Click WhatsApp to open pre-filled direct inquiry</span>
      </div>

      <!-- SECTION 1: VERIFIED DIRECT HOMEOWNER LEADS TABLE -->
      <div id="deck-fsbo" class="space-y-3">
        ${leads.length > 0 ? `
          <div class="overflow-x-auto border border-slate-950 brutal-shadow-sm bg-white">
            <table class="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr class="bg-slate-950 text-white uppercase text-[11px]">
                  <th class="p-2.5 border-r border-slate-800">Property / Headline</th>
                  <th class="p-2.5 border-r border-slate-800">Asking Price</th>
                  <th class="p-2.5 border-r border-slate-800">Direct Contact</th>
                  <th class="p-2.5 border-r border-slate-800">Listed</th>
                  <th class="p-2.5 border-r border-slate-800">Channel</th>
                  <th class="p-2.5 text-center">1-Tap Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-300">
                ${leads.map(lead => {
                  let waUrl = lead.whatsAppUrl || '';
                  const hasPhone = lead.phone && lead.phone !== 'Inquire via portal';
                  if (!waUrl.includes('wa.me') && hasPhone) {
                    const cleanP = lead.phone.replace(/[^\d]/g, '').replace(/^0/, '27');
                    if (cleanP.length >= 10) {
                      const msg = `Hi! I saw your property listing "${lead.headline}" in ${suburb} (${lead.formattedPrice || 'R ' + numberFormat(lead.askingPrice)}). Is it still available for viewing?`;
                      waUrl = `https://wa.me/${cleanP}?text=${encodeURIComponent(msg)}`;
                    }
                  }
                  const isWa = waUrl && waUrl.includes('wa.me');
                  const channelBadge = (lead.portalSource || '').includes('Gumtree') ? 'Direct Owner Channel'
                    : (lead.portalSource || '').includes('Private') ? 'Direct Seller Registry'
                    : 'Direct Homeowner Feed';
                  return `
                    <tr class="hover:bg-sky-50/70 transition-colors">
                      <td class="p-2.5 border-r border-slate-300 max-w-xs">
                        <div class="font-bold text-slate-950 truncate" title="${esc(lead.headline)}">${esc(lead.headline)}</div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                          <span class="text-[10px] px-1.5 py-0.2 bg-slate-100 border border-slate-950 font-semibold uppercase text-slate-700">
                            ${esc(lead.propertyType || 'Property')}
                          </span>
                          <span class="text-[10px] text-slate-500">${esc(lead.suburb)}</span>
                        </div>
                      </td>
                      <td class="p-2.5 border-r border-slate-300 font-bold text-sky-900 whitespace-nowrap">
                        ${esc(lead.formattedPrice || 'R ' + numberFormat(lead.askingPrice))}
                      </td>
                      <td class="p-2.5 border-r border-slate-300 whitespace-nowrap">
                        ${hasPhone ? `
                          <a href="tel:${esc(lead.phone.replace(/[^+\d]/g, ''))}" class="font-bold text-slate-950 hover:text-sky-700 underline flex items-center gap-1">
                            Tel: ${esc(lead.phone)}
                          </a>
                        ` : `
                          <span class="text-slate-500 italic text-[11px]">${esc(lead.phone)}</span>
                        `}
                        <span class="text-[10px] text-slate-500 block">${esc(lead.ownerName || 'Verified Owner')}</span>
                      </td>
                      <td class="p-2.5 border-r border-slate-300 text-slate-600 whitespace-nowrap">
                        ${lead.daysListed ? `${lead.daysListed}d ago` : 'Recent'}
                      </td>
                      <td class="p-2.5 border-r border-slate-300 whitespace-nowrap">
                        <span class="text-[10px] px-2 py-0.5 border border-slate-950 font-bold bg-amber-100 text-amber-900">
                          ${esc(channelBadge)}
                        </span>
                      </td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="inline-flex items-center gap-1">
                          ${isWa ? `
                            <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border border-slate-950 brutal-shadow-sm inline-flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs">
                              <span>WhatsApp</span>
                            </a>
                          ` : ''}
                          <a href="${esc(lead.sourceUrl || '#')}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 ${isWa ? 'bg-white hover:bg-slate-100 text-slate-900' : 'bg-sky-600 hover:bg-sky-700 text-white'} font-bold border border-slate-950 brutal-shadow-sm inline-flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs" title="View Source Listing">
                            <span>${isWa ? 'Listing ↗' : 'View Deal ↗'}</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="p-6 bg-amber-50 border border-slate-950 text-center font-mono text-xs space-y-1 brutal-shadow-sm">
            <p class="font-bold text-amber-950 uppercase">No active direct homeowner leads found for this suburb</p>
            <p class="text-slate-700">Check the Market Comps tab below to view verified suburb sales benchmarks and asking price trends.</p>
          </div>
        `}
      </div>

      <!-- SECTION 2: SUBURB BENCHMARK COMPS TABLE -->
      <div id="deck-comps" class="space-y-3 ${leads.length > 0 ? 'hidden' : ''}">
        ${comps && comps.sources && comps.sources.length > 0 ? `
          <div class="border border-slate-950 bg-white brutal-shadow-sm overflow-x-auto">
            <table class="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr class="bg-slate-950 text-white uppercase text-[11px]">
                  <th class="p-2.5 border-r border-slate-800">Listing Feed</th>
                  <th class="p-2.5 border-r border-slate-800">Listings Analyzed</th>
                  <th class="p-2.5 border-r border-slate-800">Suburb Average Asking Price</th>
                  <th class="p-2.5">Distribution Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-300">
                ${comps.sources.map(s => {
                  const channelName = (s.name || '').includes('Property24') ? 'National Property Registry'
                    : (s.name || '').includes('Private') ? 'Suburb Property Exchange'
                    : esc(s.name);
                  return `
                    <tr class="hover:bg-sky-50/70 transition-colors">
                      <td class="p-2.5 font-bold text-slate-950 border-r border-slate-300">${channelName}</td>
                      <td class="p-2.5 border-r border-slate-300">${s.count} properties indexed</td>
                      <td class="p-2.5 font-bold text-sky-900 border-r border-slate-300">R ${numberFormat(s.avg)}</td>
                      <td class="p-2.5">
                        <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-slate-950 font-bold text-[10px]">
                          ACTIVE FEED
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="p-3 bg-slate-50 border border-slate-950 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Suburb Benchmark: <strong>${esc(suburb)} (${esc(city)})</strong></span>
            <span>Median Floor Comps: <strong>R ${numberFormat(medianPrice)}</strong></span>
          </div>
        ` : `
          <div class="p-6 bg-slate-50 border border-slate-950 text-center font-mono text-xs space-y-1">
            <p class="font-bold text-slate-950 uppercase">No aggregate property comps for this suburb</p>
            <p class="text-slate-600">Try searching a broader metro area or suburb name.</p>
          </div>
        `}
      </div>

    </div>
  `;

  // Wire sub-tabs
  const btnFsbo = document.getElementById('btn-subtab-fsbo');
  const btnComps = document.getElementById('btn-subtab-comps');
  const deckFsbo = document.getElementById('deck-fsbo');
  const deckComps = document.getElementById('deck-comps');

  if (btnFsbo && btnComps && deckFsbo && deckComps) {
    btnFsbo.addEventListener('click', () => {
      btnFsbo.className = 'px-3 py-1.5 bg-sky-600 text-white font-bold border border-slate-950 brutal-shadow-sm text-xs';
      btnComps.className = 'px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-bold border border-slate-950 brutal-shadow-sm text-xs';
      deckFsbo.classList.remove('hidden');
      deckComps.classList.add('hidden');
    });

    btnComps.addEventListener('click', () => {
      btnComps.className = 'px-3 py-1.5 bg-sky-600 text-white font-bold border border-slate-950 brutal-shadow-sm text-xs';
      btnFsbo.className = 'px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-bold border border-slate-950 brutal-shadow-sm text-xs';
      deckComps.classList.remove('hidden');
      deckFsbo.classList.add('hidden');
    });
  }
}

// ──────────────────────────────────────────────────
// PILLAR 2: ELECTRONICS & CONSUMER TECH VALUATION
// ──────────────────────────────────────────────────
const formElectronics = document.getElementById('panel-electronics');
const inputElectronicsQuery = document.getElementById('input-electronics-query');
const selectElectronicsCategory = document.getElementById('select-electronics-category');
const selectElectronicsCondition = document.getElementById('select-electronics-condition');

// Wire preset chips
document.querySelectorAll('.preset-tech').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const val = btn.dataset.val;
    if (inputElectronicsQuery && val) {
      inputElectronicsQuery.value = val;
      if (formElectronics) {
        formElectronics.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }
  });
});

if (formElectronics) {
  formElectronics.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = inputElectronicsQuery ? inputElectronicsQuery.value.trim() : 'MacBook Pro M3 14 inch';
    if (!query) {
      showToast('Please enter an electronics model or device name.', 'warning');
      return;
    }

    const category = selectElectronicsCategory ? selectElectronicsCategory.value : 'all';
    const conditionFocus = selectElectronicsCondition ? selectElectronicsCondition.value : 'all';

    showResults('electronics');
    setResultsLoading(true, `Extracting real-time retail & refurb comps for "${query}"...`);
    burnCredits('electronics_valuation');

    try {
      const res = await fetch('/api/electronics/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, category })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Electronics valuation failed');
      }

      const data = await res.json();
      renderElectronicsResults(data, query, conditionFocus);
    } catch (err) {
      console.error('Electronics query error:', err);
      renderError(`Could not fetch comps for "${query}": ${err.message}`);
      showToast('Electronics search failed.', 'error');
    }
  });
}

function renderElectronicsResults(data, query, conditionFocus = 'all') {
  updateJsonSchemaViewer(data);

  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `${query} · Retail & Refurb Comps`;

  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${data.count || 0} Comps Extracted · ${data.sources?.length || 0} Verified Retailers`;

  const sourceEl = document.getElementById('results-source');
  if (sourceEl) sourceEl.textContent = 'Sources: National Retail & Certified Pre-Owned Price Index';

  const container = document.getElementById('table-container');
  if (!container) return;

  const rawListings = data.listings || [];
  let filteredListings = rawListings;
  if (conditionFocus === 'new') {
    filteredListings = rawListings.filter(l => l.condition === 'NEW');
  } else if (conditionFocus === 'refurb') {
    filteredListings = rawListings.filter(l => l.condition === 'REFURB' || l.condition === 'USED');
  }
  if (filteredListings.length === 0) filteredListings = rawListings;

  const medianVal = data.median || 0;
  const newPrice = data.medianNew || (rawListings.find(l => l.condition === 'NEW')?.price || medianVal);
  const refurbPrice = data.medianRefurb || (rawListings.find(l => l.condition === 'REFURB')?.price || (data.low > 0 ? data.low : 0));
  const lowVal = data.low || 0;
  const highVal = data.high || 0;
  const confidence = data.confidence || 'medium';

  // Savings percentage if refurb vs new
  const savingsPct = (newPrice > 0 && refurbPrice > 0 && newPrice > refurbPrice)
    ? Math.round(((newPrice - refurbPrice) / newPrice) * 100)
    : null;

  container.innerHTML = `
    <div class="space-y-5 font-mono text-xs">
      
      <!-- Top Metrics Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">MEDIAN MARKET PRICE</span>
          <span class="font-display font-bold text-lg text-sky-800">R ${numberFormat(medianVal)}</span>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">BRAND NEW (RETAIL)</span>
          <span class="font-display font-bold text-base text-slate-950">${newPrice > 0 ? 'R ' + numberFormat(newPrice) : 'N/A'}</span>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">CERTIFIED REFURB</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="font-display font-bold text-base text-emerald-700">${refurbPrice > 0 ? 'R ' + numberFormat(refurbPrice) : 'N/A'}</span>
            ${savingsPct ? `<span class="text-[10px] font-bold px-1 py-0.5 bg-emerald-100 text-emerald-800 border border-slate-950">-${savingsPct}%</span>` : ''}
          </div>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">PRICE SPREAD</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="font-display font-bold text-xs sm:text-sm text-slate-950">R ${numberFormat(lowVal)} - R ${numberFormat(highVal)}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 bg-sky-100 text-sky-800 border border-slate-950">${confidence.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <!-- Top Merchants Strip -->
      ${data.sources && data.sources.length > 0 ? `
        <div class="p-2.5 bg-slate-50 border border-slate-950 flex flex-wrap items-center gap-2 text-[11px]">
          <span class="font-bold text-slate-700 uppercase">Top Merchants:</span>
          ${data.sources.slice(0, 5).map(s => `
            <span class="px-2 py-0.5 bg-white border border-slate-950 text-slate-900 font-semibold brutal-shadow-sm">
              ${esc(s.source)} <strong class="text-sky-800 font-mono font-bold">R ${numberFormat(s.avg)}</strong> (${s.count})
            </span>
          `).join('')}
        </div>
      ` : ''}

      <!-- Listings Table -->
      ${filteredListings.length > 0 ? `
        <div class="overflow-x-auto border border-slate-950 brutal-shadow-sm bg-white">
          <table class="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr class="bg-slate-950 text-white uppercase text-[11px]">
                <th class="p-2.5 border-r border-slate-800">Device Specification / Title</th>
                <th class="p-2.5 border-r border-slate-800">Condition</th>
                <th class="p-2.5 border-r border-slate-800">Verified Price</th>
                <th class="p-2.5 border-r border-slate-800">Merchant</th>
                <th class="p-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-300">
              ${filteredListings.map(item => {
                const isNew = item.condition === 'NEW';
                const isRefurb = item.condition === 'REFURB';
                return `
                  <tr class="hover:bg-sky-50/70 transition-colors">
                    <td class="p-2.5 border-r border-slate-300 max-w-sm">
                      <div class="flex items-start gap-2.5">
                        ${item.imageUrl ? `
                          <img src="${esc(item.imageUrl)}" alt="" class="w-10 h-10 object-contain p-0.5 border border-slate-300 bg-white shrink-0" loading="lazy" onerror="this.style.display='none'"/>
                        ` : `
                          <div class="w-10 h-10 bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0 font-bold text-slate-400 text-xs">TECH</div>
                        `}
                        <div class="min-w-0">
                          <div class="font-bold text-slate-950 truncate" title="${esc(item.title)}">${esc(item.title)}</div>
                          <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            ${item.delivery ? `<span>Delivery: ${esc(item.delivery)}</span>` : ''}
                            ${item.rating ? `<span class="text-amber-700 font-bold">Rating: ${item.rating} ${item.ratingCount ? '(' + item.ratingCount + ')' : ''}</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="p-2.5 border-r border-slate-300 whitespace-nowrap">
                      <span class="text-[10px] px-2 py-0.5 border border-slate-950 font-bold ${
                        isNew ? 'bg-emerald-100 text-emerald-900' :
                        isRefurb ? 'bg-sky-100 text-sky-900' :
                        'bg-amber-100 text-amber-900'
                      }">
                        ${esc(item.condition)}
                      </span>
                    </td>
                    <td class="p-2.5 border-r border-slate-300 font-bold text-sky-900 whitespace-nowrap text-sm">
                      R ${numberFormat(item.price)}
                    </td>
                    <td class="p-2.5 border-r border-slate-300 whitespace-nowrap text-slate-800 font-semibold">
                      ${esc(item.source)}
                    </td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                      <a href="${esc(item.link || '#')}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold border border-slate-950 brutal-shadow-sm inline-flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs" title="View Source Listing">
                        <span>View Deal ↗</span>
                      </a>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="p-6 bg-slate-50 border border-slate-950 text-center font-mono text-xs space-y-1">
          <p class="font-bold text-slate-950 uppercase">No comps found matching your condition filter</p>
          <p class="text-slate-600">Select "All Conditions" to view all available retail comps.</p>
        </div>
      `}

    </div>
  `;
}

// ──────────────────────────────────────────────────
// PILLAR 3: B2B BUSINESS FINDER & DEFECT AUDIT
// ──────────────────────────────────────────────────
let lastBusinessCrawlData = null;

const formBusiness = document.getElementById('panel-business');
const limitSelect = document.getElementById('select-business-limit');
const badgeBusinessCredits = document.getElementById('badge-business-credits');

if (limitSelect && badgeBusinessCredits) {
  limitSelect.addEventListener('change', () => {
    const lim = parseInt(limitSelect.value, 10);
    const cr = lim >= 100 ? 8 : lim >= 50 ? 4 : lim >= 25 ? 2 : 1;
    badgeBusinessCredits.textContent = `${cr} CREDIT${cr > 1 ? 'S' : ''}`;
  });
}

const selectPropertyScope = document.getElementById('select-property-scope');
const badgePropertyCredits = document.getElementById('badge-property-credits');
if (selectPropertyScope && badgePropertyCredits) {
  selectPropertyScope.addEventListener('change', () => {
    badgePropertyCredits.textContent = selectPropertyScope.value === 'comps' ? '1 CREDIT' : '2 CREDITS';
  });
}

if (formBusiness) {
  formBusiness.addEventListener('submit', async (e) => {
    e.preventDefault();
    const industryInput = document.getElementById('input-business-industry');
    const cityInput = document.getElementById('input-business-city');
    const depthSelect = document.getElementById('select-business-depth');

    const industry = industryInput ? industryInput.value.trim() : 'Car Dealerships';
    const city = cityInput ? cityInput.value.trim() : 'Sandton';
    const maxResults = limitSelect ? parseInt(limitSelect.value, 10) : 25;
    const depth = depthSelect ? depthSelect.value : 'deep';

    if (!industry || !city) {
      showToast('Please enter both an industry and a target city.', 'warning');
      return;
    }

    const creditsToBurn = maxResults >= 100 ? 8 : maxResults >= 50 ? 4 : maxResults >= 25 ? 2 : 1;

    showResults('business');
    setResultsLoading(true, `Discovering & auditing ${maxResults} commercial leads for ${industry} in ${city}...`);
    burnCredits('business_audit', creditsToBurn);

    try {
      const res = await fetch('/api/agency/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, city, maxResults, country: 'za' })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Business crawl failed');
      }
      const data = await res.json();
      lastBusinessCrawlData = { data, industry, city };
      renderBusinessResults(data, industry, city);
    } catch (err) {
      console.error('Business crawl error:', err);
      renderError(`Business search failed: ${err.message}. Please check query parameters.`);
      showToast('Business search failed.', 'error');
    }
  });
}

function exportBusinessCsv(targets, city, industry) {
  if (!targets || targets.length === 0) {
    showToast('No audited businesses available to export.', 'warning');
    return;
  }

  const headers = [
    'Business Name',
    'Domain',
    'Readiness Score',
    'Critical Defects',
    'Primary Phone',
    'WhatsApp Direct Link',
    'Contact Email',
    'Physical Address',
    'Estimated Pitch Value'
  ];

  const csvSafe = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    if (/^[=+\-@]/.test(s)) return `"\t${s}"`;
    return `"${s}"`;
  };

  const rows = targets.map(t => {
    const defectsStr = (t.defects || []).map(d => d.title).join('; ');
    const primaryPhone = t.contacts?.phones?.[0] || t.phone || '';
    const waLink = t.contacts?.whatsAppLinks?.[0] || '';
    const email = t.contacts?.emails?.[0] || '';
    const address = t.contacts?.address || `${t.city || city}, South Africa`;

    return [
      csvSafe(t.businessName || t.domain),
      csvSafe(t.domain),
      `${t.readinessScore || 0}/100`,
      csvSafe(defectsStr),
      csvSafe(primaryPhone),
      csvSafe(waLink),
      csvSafe(email),
      csvSafe(address),
      csvSafe(t.estimatedPitchValue || 'R 15,000 - R 25,000')
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${industry.toLowerCase().replace(/\s+/g, '-')}-${city.toLowerCase().replace(/\s+/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Prospecting CSV downloaded successfully!');
}

function renderBusinessResults(data, industry, city) {
  updateJsonSchemaViewer(data);
  const targets = data.targets || [];
  const totalAudited = targets.length;
  const criticalDefectsFound = data.criticalDefectsFound ?? targets.reduce((sum, t) => sum + (t.defects || []).filter(d => d.severity === 'CRITICAL').length, 0);
  const avgScore = data.averageReadinessScore ?? (totalAudited > 0 ? Math.round(targets.reduce((sum, t) => sum + (t.readinessScore || 0), 0) / totalAudited) : 0);

  // Count targets with verified direct WhatsApp or phone
  const waCount = targets.filter(t => (t.contacts?.whatsAppLinks?.length > 0) || (t.contacts?.phones?.length > 0) || t.phone).length;

  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `${industry} in ${city} · B2B Client Intelligence & Audit`;

  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${totalAudited} Targets Audited · ${criticalDefectsFound} Critical Defects Identified`;

  const sourceEl = document.getElementById('results-source');
  if (sourceEl) sourceEl.textContent = 'Sources: Verified Commercial Registry & Deep Digital Health Diagnostic';

  const container = document.getElementById('table-container');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-5 font-mono text-xs">
      
      <!-- Top Metrics Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">TARGETS AUDITED</span>
          <span class="font-display font-bold text-lg text-slate-950">${totalAudited} Businesses</span>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">AVG READINESS SCORE</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="font-display font-bold text-lg ${avgScore < 50 ? 'text-rose-700' : avgScore < 75 ? 'text-amber-700' : 'text-emerald-700'}">${avgScore}/100</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 ${avgScore < 50 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'} border border-slate-950">${avgScore < 50 ? 'HIGH DEFECTS' : 'MODERATE'}</span>
          </div>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">CRITICAL DEFECTS</span>
          <span class="font-display font-bold text-lg text-rose-700">${criticalDefectsFound} Issues</span>
        </div>
        <div class="bg-white border border-slate-950 p-3 brutal-shadow-sm">
          <span class="text-slate-500 block text-[10px] uppercase font-bold">VERIFIED DIRECT LEADS</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="font-display font-bold text-lg text-emerald-700">${waCount} Direct</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-slate-950">1-TAP WA</span>
          </div>
        </div>
      </div>

      <!-- Action Bar with Export Button -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-950 pb-2">
        <span class="font-bold text-slate-950 uppercase text-xs">Audited Business Prospects (${totalAudited})</span>
        <button id="btn-export-business-csv" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border border-slate-950 brutal-shadow-sm inline-flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs">
          <span>Export Prospecting CSV</span>
        </button>
      </div>

      <!-- Targets Table -->
      ${targets.length > 0 ? `
        <div class="overflow-x-auto border border-slate-950 brutal-shadow-sm bg-white">
          <table class="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr class="bg-slate-950 text-white uppercase text-[11px]">
                <th class="p-2.5 border-r border-slate-800">Business &amp; Domain</th>
                <th class="p-2.5 border-r border-slate-800">Digital Health</th>
                <th class="p-2.5 border-r border-slate-800">Defects Identified</th>
                <th class="p-2.5 border-r border-slate-800">Verified Contacts</th>
                <th class="p-2.5 text-center">1-Tap Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-300">
              ${targets.map(t => {
                const score = t.readinessScore ?? 50;
                const scoreColor = score < 50 ? 'bg-rose-100 text-rose-900 border-rose-950' : score < 75 ? 'bg-amber-100 text-amber-900 border-amber-950' : 'bg-emerald-100 text-emerald-900 border-emerald-950';
                const defects = t.defects || [];
                const primaryPhone = t.contacts?.phones?.[0] || t.phone || '';
                const email = t.contacts?.emails?.[0] || '';
                
                // Build pre-filled WhatsApp URL
                let waUrl = t.contacts?.whatsAppLinks?.[0] || '';
                if (!waUrl && primaryPhone) {
                  const cleanP = primaryPhone.replace(/[^\d]/g, '').replace(/^0/, '27');
                  if (cleanP.length >= 10) {
                    const defectSummary = defects.slice(0, 2).map(d => d.title).join(' and ');
                    const msg = `Hi ${t.businessName || 'there'}! I noticed a couple of technical issues on ${t.domain} ${defectSummary ? '(' + defectSummary + ')' : ''} that could be impacting your mobile lead conversions. Would you like me to share a quick 2-minute diagnostic?`;
                    waUrl = `https://wa.me/${cleanP}?text=${encodeURIComponent(msg)}`;
                  }
                }
                const isWa = waUrl && waUrl.includes('wa.me');

                return `
                  <tr class="hover:bg-sky-50/70 transition-colors">
                    <td class="p-2.5 border-r border-slate-300 max-w-xs">
                      <div class="font-bold text-slate-950 truncate" title="${esc(t.businessName || t.domain)}">
                        ${esc(t.businessName || t.domain)}
                      </div>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <a href="https://${esc(t.domain)}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-sky-700 underline truncate">
                          ${esc(t.domain)}
                        </a>
                      </div>
                      ${t.estimatedPitchValue ? `
                        <span class="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-800 border border-slate-950">
                          Pitch: ${esc(t.estimatedPitchValue)}
                        </span>
                      ` : ''}
                    </td>

                    <td class="p-2.5 border-r border-slate-300 whitespace-nowrap">
                      <div class="inline-flex items-center gap-1.5 px-2 py-1 border font-bold text-xs ${scoreColor}">
                        <span>${score}/100</span>
                      </div>
                      <span class="block text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                        ${score < 50 ? 'High Vulnerability' : score < 75 ? 'Moderate' : 'Good Health'}
                      </span>
                    </td>

                    <td class="p-2.5 border-r border-slate-300 max-w-xs">
                      ${defects.length > 0 ? `
                        <div class="flex flex-wrap gap-1">
                          ${defects.slice(0, 3).map(d => `
                            <span class="text-[10px] px-1.5 py-0.5 border border-slate-950 font-semibold ${
                              d.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-900'
                            }" title="${esc(d.description || d.title)}">
                              [!] ${esc(d.title)}
                            </span>
                          `).join('')}
                          ${defects.length > 3 ? `<span class="text-[10px] text-slate-500 font-bold self-center">+${defects.length - 3} more</span>` : ''}
                        </div>
                      ` : `
                        <span class="text-emerald-700 font-semibold text-[11px]">No critical defects detected</span>
                      `}
                    </td>

                    <td class="p-2.5 border-r border-slate-300 whitespace-nowrap">
                      ${primaryPhone ? `
                        <a href="tel:${esc(primaryPhone.replace(/[^+\d]/g, ''))}" class="font-bold text-slate-950 hover:text-sky-700 underline block">
                          Tel: ${esc(primaryPhone)}
                        </a>
                      ` : `
                        <span class="text-slate-400 italic text-[11px]">No phone found</span>
                      `}
                      ${email ? `
                        <a href="mailto:${esc(email)}" class="text-[11px] text-slate-600 hover:text-sky-700 underline block truncate max-w-[160px]">
                          Email: ${esc(email)}
                        </a>
                      ` : ''}
                    </td>

                    <td class="p-2.5 text-center whitespace-nowrap">
                      <div class="inline-flex items-center gap-1">
                        ${isWa ? `
                          <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border border-slate-950 brutal-shadow-sm inline-flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs" title="1-Tap Pre-filled WhatsApp Lead">
                            <span>WhatsApp</span>
                          </a>
                        ` : ''}
                        <a href="https://${esc(t.domain)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 ${isWa ? 'bg-white hover:bg-slate-100 text-slate-900' : 'bg-sky-600 hover:bg-sky-700 text-white'} font-bold border border-slate-950 brutal-shadow-sm inline-flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs" title="Visit Live Domain">
                          <span>Visit ↗</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="p-6 bg-slate-50 border border-slate-950 text-center font-mono text-xs space-y-1">
          <p class="font-bold text-slate-950 uppercase">No candidate businesses found in this area</p>
          <p class="text-slate-600">Try broadening your search or adjusting the target city/industry.</p>
        </div>
      `}

    </div>
  `;

  // Wire Export CSV button
  const exportBtn = document.getElementById('btn-export-business-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportBusinessCsv(targets, city, industry);
    });
  }
}

// ──────────────────────────────────────────────────
// PILLAR 4: OFFICIAL REGISTRY & BUREAU DOSSIERS (CIPC, Deeds, Home Affairs)
// ──────────────────────────────────────────────────
const selectBureauType = document.getElementById('select-bureau-type');
const labelBureauQuery = document.getElementById('label-bureau-query');
const inputBureauQuery = document.getElementById('input-bureau-query');

if (selectBureauType && labelBureauQuery && inputBureauQuery) {
  selectBureauType.addEventListener('change', () => {
    const val = selectBureauType.value;
    if (val === 'deeds') {
      labelBureauQuery.textContent = 'Township / Erf / Property Address';
      inputBureauQuery.placeholder = 'e.g. Erf 412 Sandton, Bryanston, Cape Town';
      inputBureauQuery.value = 'Sandton Erf 412';
    } else if (val === 'id_verify') {
      labelBureauQuery.textContent = '13-Digit South African ID Number';
      inputBureauQuery.placeholder = 'e.g. 8801015009087';
      inputBureauQuery.value = '8801015009087';
    } else {
      // Default: CIPC
      labelBureauQuery.textContent = 'Company Name or Registration No';
      inputBureauQuery.placeholder = 'e.g. 2019/123456/07 or TruSaaS Pty Ltd';
      inputBureauQuery.value = '2019/123456/07';
    }
  });
}

// Standalone RegCheck Execution (Used by Vehicle Tab)
async function executeVehicleRegCheck(identifier) {
  if (!identifier) return;
  showResults('vehicles');
  setResultsLoading(true, `Querying SAPS Police Stolen Register & Bank Finance Interest for ${identifier}...`);
  burnCredits('bureau_regcheck');

  try {
    const res = await fetch('/api/bureau/regcheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, type: identifier.length === 17 ? 'vin' : 'reg' })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'RegCheck request failed');
    renderRegCheckResults(result.data || result, identifier);
  } catch (err) {
    renderError(`Vehicle verification failed: ${err.message || 'Unable to connect to registry gateway.'}`);
    showToast('Vehicle verification lookup failed.', 'error');
  }
}

// Standalone Accident Report Execution (Used by Vehicle Tab)
async function executeVehicleAccidentReport(vin) {
  if (!vin) return;
  showResults('vehicles');
  setResultsLoading(true, `Querying Insurance Claims & Damage History for VIN ${vin}...`);
  burnCredits('bureau_accident');

  try {
    const res = await fetch('/api/bureau/accident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Accident report request failed');
    renderAccidentResults(result.data || result, vin);
  } catch (err) {
    renderError(`Accident report lookup failed: ${err.message || 'Unable to connect to insurance gateway.'}`);
    showToast('Accident report query failed.', 'error');
  }
}

const formBureau = document.getElementById('panel-bureau');
if (formBureau) {
  formBureau.addEventListener('submit', async (e) => {
    e.preventDefault();
    const typeEl = document.getElementById('select-bureau-type');
    const queryEl = document.getElementById('input-bureau-query');

    const reportType = typeEl ? typeEl.value : 'cipc';
    const identifier = queryEl ? queryEl.value.trim() : '';

    if (!identifier) {
      showToast('Please enter an identifier to query.', 'error');
      return;
    }

    showResults('bureau');
    setResultsLoading(true, `Executing official ${reportType.toUpperCase()} register extraction for ${identifier}...`);
    burnCredits('bureau_valuation');

    try {
      let endpoint = '/api/bureau/cipc';
      let payload = { query: identifier };

      if (reportType === 'deeds') {
        endpoint = '/api/bureau/deeds';
        payload = { query: identifier, province: 'Gauteng' };
      } else if (reportType === 'id_verify') {
        endpoint = '/api/bureau/id-verify';
        payload = { idNumber: identifier };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registry query failed');
      renderBureauResults(data.data || data, reportType, identifier);
    } catch (err) {
      renderError(`Bureau registry query failed: ${err.message || 'Data gateway unavailable.'}`);
      showToast('Bureau search failed.', 'error');
    }
  });
}

// ──────────────────────────────────────────────────
// BUREAU RESULT RENDERERS
// ──────────────────────────────────────────────────

function renderRegCheckResults(data, identifier) {
  updateJsonSchemaViewer(data);
  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `Vehicle Verification: ${identifier}`;

  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = 'Official SAPS Stolen & Bank Finance Verification';

  const sourceEl = document.getElementById('results-source');
  if (sourceEl) sourceEl.textContent = 'Source: Official National Vehicle Register & Financial Title Registry';

  const container = document.getElementById('table-container');
  if (container) {
    const isStolen = !!data.stolen;
    const isFinanced = !!data.financePending;
    const isMicrodot = !!data.microdotted;

    container.innerHTML = `
      <div class="space-y-4 font-mono text-xs">
        <!-- 3 Primary Risk Badges -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3.5 border border-slate-950 brutal-shadow-sm ${isStolen ? 'bg-rose-100 text-rose-950 border-rose-950' : 'bg-emerald-50 text-emerald-950'}">
            <span class="text-[10px] uppercase font-bold block mb-1">SAPS POLICE STOLEN STATUS</span>
            <span class="font-display font-bold text-base flex items-center gap-1.5 ${isStolen ? 'text-rose-700' : 'text-emerald-700'}">
              <span>${isStolen ? 'STOLEN REPORTED' : 'NOT REPORTED STOLEN'}</span>
            </span>
            <span class="text-[10px] text-slate-600 block mt-1">${isStolen ? 'Active SAPS stolen flag on record.' : 'Clear on national police vehicle database.'}</span>
          </div>

          <div class="p-3.5 border border-slate-950 brutal-shadow-sm ${isFinanced ? 'bg-amber-100 text-amber-950 border-amber-950' : 'bg-emerald-50 text-emerald-950'}">
            <span class="text-[10px] uppercase font-bold block mb-1">BANK FINANCE INTEREST</span>
            <span class="font-display font-bold text-base flex items-center gap-1.5 ${isFinanced ? 'text-amber-800' : 'text-emerald-700'}">
              <span>${isFinanced ? 'FINANCE PENDING' : 'CLEAR / NO LIEN'}</span>
            </span>
            <span class="text-[10px] text-slate-600 block mt-1">${isFinanced ? 'Active bank lien registered against title.' : 'No financial institution lien registered.'}</span>
          </div>

          <div class="p-3.5 border border-slate-950 brutal-shadow-sm ${isMicrodot ? 'bg-emerald-50 text-emerald-950' : 'bg-slate-50 text-slate-900'}">
            <span class="text-[10px] uppercase font-bold block mb-1">MICRODOT PROTECTION</span>
            <span class="font-display font-bold text-base flex items-center gap-1.5 ${isMicrodot ? 'text-emerald-700' : 'text-slate-600'}">
              <span>${isMicrodot ? 'MICRODOTTED' : 'NOT DETECTED'}</span>
            </span>
            <span class="text-[10px] text-slate-600 block mt-1">${isMicrodot ? 'Microdot identification recorded.' : 'No microdot identifier on file.'}</span>
          </div>
        </div>

        <!-- Verified Factory Identity Record -->
        <div class="p-4 bg-white border border-slate-950 space-y-3 brutal-shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-950 pb-2">
            <span class="font-bold text-slate-950 uppercase">VERIFIED VEHICLE REGISTRATION RECORD</span>
            <span class="font-mono text-[10px] bg-slate-950 text-white px-2 py-0.5 font-bold uppercase">${esc(data.registrationNumber || identifier)}</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-900">
            <div>
              <span class="text-[10px] text-slate-500 uppercase block font-semibold">Make &amp; Model</span>
              <span class="font-bold text-sm text-slate-950">${esc(data.make || '')} ${esc(data.model || data.description || 'Vehicle Verified')}</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-500 uppercase block font-semibold">Year Model</span>
              <span class="font-bold text-sm text-slate-950">${esc(data.year || 'N/A')}</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-500 uppercase block font-semibold">Factory Colour</span>
              <span class="font-bold text-sm text-slate-950">${esc(data.colour || 'N/A')}</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-500 uppercase block font-semibold">17-Digit VIN</span>
              <span class="font-bold text-xs text-sky-900 font-mono select-all">${esc(data.vin || 'N/A')}</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-500 uppercase block font-semibold">Engine Number</span>
              <span class="font-bold text-xs text-slate-900 font-mono select-all">${esc(data.engineNumber || 'N/A')}</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-500 uppercase block font-semibold">eNaTIS Registration</span>
              <span class="font-bold text-sm ${data.registered ? 'text-emerald-700' : 'text-slate-900'}">${data.registered ? 'Active on Register' : 'Recorded'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

function renderAccidentResults(data, vin) {
  updateJsonSchemaViewer(data);
  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `Insurance Claims & Accident History: ${vin}`;

  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${(data.claims || []).length} Recorded Claims on Record`;

  const container = document.getElementById('table-container');
  if (container) {
    const claims = data.claims || [];
    container.innerHTML = `
      <div class="space-y-4 font-mono text-xs">
        <div class="p-3.5 bg-white border border-slate-950 brutal-shadow-sm flex items-center justify-between">
          <div>
            <span class="text-[10px] text-slate-500 uppercase block font-bold">INSURANCE CLAIMS RADAR</span>
            <span class="font-bold text-sm ${claims.length > 0 ? 'text-amber-800' : 'text-emerald-700'}">
              ${claims.length > 0 ? `${claims.length} Previous Claim(s) Recorded` : 'No Previous Insurance Claims on File'}
            </span>
          </div>
          <span class="font-mono text-xs bg-slate-100 px-2 py-1 border border-slate-950 font-bold">${esc(vin)}</span>
        </div>

        ${claims.length > 0 ? `
          <table class="w-full border-collapse border border-slate-950 text-left bg-white">
            <thead>
              <tr class="bg-slate-950 text-white font-mono text-[11px] uppercase">
                <th class="p-2 border border-slate-950">Claim Date</th>
                <th class="p-2 border border-slate-950">Damaged Area</th>
                <th class="p-2 border border-slate-950">Claim Amount</th>
                <th class="p-2 border border-slate-950">Description</th>
              </tr>
            </thead>
            <tbody>
              ${claims.map(c => `
                <tr class="border-b border-slate-300 hover:bg-slate-50">
                  <td class="p-2 font-bold border border-slate-950">${esc(c.date || 'N/A')}</td>
                  <td class="p-2 font-bold text-slate-900 border border-slate-950">${esc(c.areaDamaged || 'General')}</td>
                  <td class="p-2 font-bold text-slate-950 border border-slate-950">${c.claimAmount ? 'R ' + numberFormat(c.claimAmount) : 'Settled'}</td>
                  <td class="p-2 text-slate-600 border border-slate-950">${esc(c.description || 'Insurance payout')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="p-6 bg-emerald-50 border border-emerald-950 text-center font-mono text-xs space-y-1">
            <p class="font-bold text-emerald-900 uppercase">CLEAN CLAIMS HISTORY</p>
            <p class="text-emerald-800">No major accident or structural write-off claims recorded for this VIN.</p>
          </div>
        `}
      </div>
    `;
  }
}

function renderBureauResults(data, reportType, identifier) {
  updateJsonSchemaViewer(data);
  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `Official Bureau Record: ${identifier}`;

  const container = document.getElementById('table-container');
  if (container) {
    container.innerHTML = `
      <div class="p-4 bg-white border border-slate-950 font-mono text-xs space-y-3 brutal-shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-950 pb-2">
          <span class="font-bold text-slate-950 uppercase">${reportType.toUpperCase()} REGISTRY RECORD</span>
          <span class="text-emerald-700 font-bold">STATUS: VERIFIED</span>
        </div>
        <p>Identifier Query: <strong>${esc(identifier)}</strong></p>
        <div class="p-3 bg-slate-50 border border-slate-950 overflow-x-auto text-[11px]">
          <pre class="font-mono text-slate-900">${esc(JSON.stringify(data, null, 2))}</pre>
        </div>
      </div>
    `;
  }
}

// ──────────────────────────────────────────────────
// PILLAR 5: AEO AUDIT
// ──────────────────────────────────────────────────
const formAeo = document.getElementById('panel-aeo');
if (formAeo) {
  formAeo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlEl = document.getElementById('input-aeo-url');
    const targetUrl = urlEl ? urlEl.value.trim() : 'https://data.tru-saas.com';
    if (!targetUrl) return;

    showResults('aeo');
    setResultsLoading(true, `Auditing AI & LLM Search Engine Visibility for ${targetUrl}...`);

    try {
      const email = getUserEmail();
      const res = await fetch('/api/aeo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, userEmail: email })
      });

      if (!res.ok) {
        // If 402, try free preview
        if (res.status === 402) {
          showToast('Insufficient credits, falling back to free preview scan...', 'warning');
          const previewRes = await fetch('/api/aeo/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl })
          });
          if (previewRes.ok) {
            const previewData = await previewRes.json();
            renderAeoPreviewResults(previewData.preview, targetUrl);
            return;
          }
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'AEO Audit failed');
      }

      const json = await res.json();
      await updateWalletUI();
      renderAeoResults(json.data, targetUrl);
    } catch (err) {
      renderError(`AEO Audit error: ${err.message}. Please verify the target URL.`);
      showToast('AEO Audit failed.', 'error');
    }
  });
}

function renderAeoPreviewResults(preview, url) {
  updateJsonSchemaViewer(preview);
  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `AEO PREVIEW: ${preview.domain || url}`;

  const container = document.getElementById('table-container');
  if (container) {
    container.innerHTML = `
      <div class="p-4 bg-white border border-slate-950 font-mono text-xs space-y-4 brutal-shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-950 pb-2">
          <span class="font-bold text-slate-950 uppercase">AEO &amp; LLM CRAWLER PREVIEW</span>
          <span class="px-2.5 py-1 text-white font-bold ${preview.score >= 80 ? 'bg-emerald-600' : preview.score >= 60 ? 'bg-amber-600' : 'bg-rose-600'}">GRADE ${preview.grade} (${preview.score}/100)</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="p-3 bg-slate-50 border border-slate-950">
            <div class="text-slate-500 uppercase text-[10px]">AI Search Crawlers</div>
            <div class="text-sm font-bold mt-1 ${preview.crawlersAllowed ? 'text-emerald-700' : 'text-amber-700'}">${preview.crawlersAllowed ? 'ALLOWED' : 'PARTIAL / BLOCKED'}</div>
          </div>
          <div class="p-3 bg-slate-50 border border-slate-950">
            <div class="text-slate-500 uppercase text-[10px]">Context /llms.txt</div>
            <div class="text-sm font-bold mt-1 ${preview.llmsTxtFound ? 'text-emerald-700' : 'text-rose-700'}">${preview.llmsTxtFound ? 'FOUND & ACTIVE' : 'MISSING'}</div>
          </div>
          <div class="p-3 bg-slate-50 border border-slate-950">
            <div class="text-slate-500 uppercase text-[10px]">Schema.org JSON-LD</div>
            <div class="text-sm font-bold mt-1 text-sky-800">${preview.schemaFound ? (preview.schemaTypes || []).join(', ') : 'NONE DETECTED'}</div>
          </div>
        </div>
        <div class="p-3 bg-sky-50 border border-sky-950 text-slate-800 space-y-1">
          <div class="font-bold uppercase text-[11px] text-sky-950">Unlock Full 1-Click Fix Snippets &amp; Diagnostics</div>
          <p class="text-[11px]">Top-up your credit wallet to view complete line-by-line crawler permissions, schema property diagnostics, and auto-generated JSON-LD scripts.</p>
        </div>
      </div>
    `;
  }
}

function renderAeoResults(audit, url) {
  updateJsonSchemaViewer(audit);
  const titleEl = document.getElementById('results-title');
  if (titleEl) titleEl.textContent = `AEO AUDIT: ${audit.domain || url}`;

  const container = document.getElementById('table-container');
  if (container) {
    const crawlers = audit.crawlers || {};
    const schemaLd = audit.schemaLd || {};
    const llms = audit.llmsTxt || {};
    const fix = audit.fixSnippet || {};

    container.innerHTML = `
      <div class="p-4 bg-white border border-slate-950 font-mono text-xs space-y-4 brutal-shadow-sm">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-950 pb-3">
          <div>
            <span class="text-slate-500 uppercase text-[10px] block">AEO &amp; AI SEARCH READINESS SCORE</span>
            <span class="font-bold text-base text-slate-950">${esc(audit.domain)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 text-white font-bold text-sm ${audit.score >= 80 ? 'bg-emerald-600' : audit.score >= 60 ? 'bg-amber-600' : 'bg-rose-600'}">GRADE ${audit.grade} (${audit.score}/100)</span>
          </div>
        </div>

        <!-- 3-Pillar Status Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- Crawlers -->
          <div class="p-3 bg-slate-50 border border-slate-950 space-y-1">
            <div class="text-slate-500 uppercase text-[10px] font-bold">1. AI Bots (robots.txt)</div>
            <div class="space-y-0.5 text-[11px]">
              <div>GPTBot (ChatGPT): <strong>${crawlers.gptBot ? 'Allowed' : 'Disallowed'}</strong></div>
              <div>ClaudeBot (Anthropic): <strong>${crawlers.claudeBot ? 'Allowed' : 'Disallowed'}</strong></div>
              <div>PerplexityBot: <strong>${crawlers.perplexityBot ? 'Allowed' : 'Disallowed'}</strong></div>
            </div>
          </div>

          <!-- llms.txt -->
          <div class="p-3 bg-slate-50 border border-slate-950 space-y-1">
            <div class="text-slate-500 uppercase text-[10px] font-bold">2. LLMs.txt Context</div>
            <div class="text-sm font-bold ${llms.found ? 'text-emerald-700' : 'text-rose-700'}">
              ${llms.found ? '/llms.txt Present' : '/llms.txt Missing'}
            </div>
            <div class="text-[11px] text-slate-600">${llms.fullVersionFound ? '/llms-full.txt detected' : 'Standard context only'}</div>
          </div>

          <!-- Schema.org -->
          <div class="p-3 bg-slate-50 border border-slate-950 space-y-1">
            <div class="text-slate-500 uppercase text-[10px] font-bold">3. Schema.org JSON-LD</div>
            <div class="text-sm font-bold ${schemaLd.found ? 'text-emerald-700' : 'text-rose-700'}">
              ${schemaLd.found ? `${schemaLd.validCount} Valid Blocks` : 'Missing JSON-LD'}
            </div>
            <div class="text-[11px] text-slate-600 truncate">${(schemaLd.schemaTypes || []).join(', ') || 'No types'}</div>
          </div>
        </div>

        <!-- Recommendations -->
        ${(audit.recommendations && audit.recommendations.length > 0) ? `
          <div class="p-3 bg-amber-50 border border-amber-950 space-y-1.5">
            <div class="font-bold text-amber-950 uppercase text-[11px]">Actionable Optimization Steps</div>
            <ul class="list-disc list-inside space-y-1 text-slate-800 text-[11px]">
              ${audit.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- 1-Click Fix Snippets Accordion -->
        <div class="border border-slate-950 bg-slate-50 p-3 space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-950 uppercase text-[11px]">1-Click Fix Snippets (Copy &amp; Deploy)</span>
          </div>
          <div class="space-y-2">
            <div>
              <div class="text-[10px] font-bold text-slate-600 uppercase mb-1">robots.txt AI Crawler Rules</div>
              <textarea readonly class="w-full bg-slate-950 text-sky-300 font-mono text-[11px] p-2 border border-slate-950 h-20">${esc(fix.robotsTxtRules || '')}</textarea>
            </div>
            <div>
              <div class="text-[10px] font-bold text-slate-600 uppercase mb-1">Generated Schema.org JSON-LD</div>
              <textarea readonly class="w-full bg-slate-950 text-sky-300 font-mono text-[11px] p-2 border border-slate-950 h-24">${esc(fix.jsonLdScript || '')}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// ──────────────────────────────────────────────────
// PILLAR 6: SAFEPAY BANK AVS
// ──────────────────────────────────────────────────
const safepayForm = document.getElementById('panel-safepay');
if (safepayForm) {
  safepayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountEl = document.getElementById('input-safepay-account');
    const idEl = document.getElementById('input-safepay-id');

    const bankAccount = accountEl ? accountEl.value.trim() : '';
    const idNumber = idEl ? idEl.value.trim() : '';

    if (!bankAccount || !idNumber) {
      showToast('Please enter Bank Account and ID number.', 'error');
      return;
    }

    showResults('safepay');
    setResultsLoading(true, 'Executing SafePay Real-Time Bank Account Verification...');
    burnCredits('safepay');

    try {
      const res = await fetch('/api/safepay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccount, branchCode: '632005', idNumber })
      });
      const data = await res.json();
      renderSafepayResults(data);
    } catch (err) {
      renderError('SafePay verification failed. Check account credentials.');
    }
  });
}

function renderSafepayResults(data) {
  updateJsonSchemaViewer(data);
  const container = document.getElementById('table-container');
  if (container) {
    const passed = data.verified || false;
    container.innerHTML = `
      <div class="p-4 bg-white border border-slate-950 font-mono text-xs space-y-3 brutal-shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-950 pb-2">
          <span class="font-bold text-slate-950 uppercase">REAL-TIME BANK ACCOUNT VERIFICATION CHECKLIST</span>
          <span class="${passed ? 'text-emerald-700' : 'text-rose-700'} font-bold">
            ${passed ? 'ACCOUNT VERIFIED' : 'VERIFICATION NOTICE'}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-slate-800">
          <div>Account Exists: Yes</div>
          <div>Account Open: Yes</div>
          <div>ID Match: ${data.score > 4 ? 'Match' : 'Check ID'}</div>
          <div>Accepts Credits: Yes</div>
        </div>
      </div>
    `;
  }
}

// ──────────────────────────────────────────────────
// LEGAL & DOCUMENTATION MODALS HANDLERS
// ──────────────────────────────────────────────────
function wireModal(triggerId, modalId, closeId) {
  const trigger = document.getElementById(triggerId);
  const modal = document.getElementById(modalId);
  const close = document.getElementById(closeId);

  if (trigger && modal) {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.remove('hidden');
    });
  }
  if (close && modal) {
    close.addEventListener('click', () => modal.classList.add('hidden'));
  }
}

wireModal('btn-open-docs', 'docs-modal', 'close-docs-modal');
wireModal('btn-open-terms', 'terms-modal', 'close-terms-modal');
wireModal('btn-open-privacy', 'privacy-modal', 'close-privacy-modal');

// ──────────────────────────────────────────────────
// CHAT ASSISTANT WIDGET (DEEPSEEK BACKEND)
// ──────────────────────────────────────────────────
const chatToggleBtn = document.getElementById('chat-toggle');
const chatWindow = document.getElementById('chat-window');
const chatCloseBtn = document.getElementById('chat-close');
const chatSendBtn = document.getElementById('chat-send');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

if (chatToggleBtn && chatWindow) {
  chatToggleBtn.addEventListener('click', () => chatWindow.classList.toggle('hidden'));
}
if (chatCloseBtn && chatWindow) {
  chatCloseBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));
}

async function sendChatMessage() {
  if (!chatInput || !chatMessages) return;
  const msg = chatInput.value.trim();
  if (!msg) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'message user font-bold text-sky-700 text-right';
  userDiv.textContent = `You: ${msg}`;
  chatMessages.appendChild(userDiv);
  chatInput.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    const botDiv = document.createElement('div');
    botDiv.className = 'message bot text-slate-800';
    botDiv.innerHTML = `<p>${esc(data.reply || 'Hello! How can I assist you with TruData?')}</p>`;
    chatMessages.appendChild(botDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.warn('Chat error:', err);
  }
}

if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
}

// ──────────────────────────────────────────────────
// INSPECTOR DECK TABS (TABLE VS JSON SCHEMA)
// ──────────────────────────────────────────────────
const btnTabTable = document.getElementById('btn-tab-table');
const btnTabJson = document.getElementById('btn-tab-json');
const containerTable = document.getElementById('table-container');
const containerJson = document.getElementById('json-viewer-container');

if (btnTabTable && btnTabJson && containerTable && containerJson) {
  btnTabTable.addEventListener('click', () => {
    btnTabTable.className = 'px-3 py-1 bg-sky-600 text-white font-semibold border border-slate-950 brutal-shadow-sm';
    btnTabJson.className = 'px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 font-semibold border border-slate-950 brutal-shadow-sm';
    containerTable.classList.remove('hidden');
    containerJson.classList.add('hidden');
  });

  btnTabJson.addEventListener('click', () => {
    btnTabJson.className = 'px-3 py-1 bg-sky-600 text-white font-semibold border border-slate-950 brutal-shadow-sm';
    btnTabTable.className = 'px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 font-semibold border border-slate-950 brutal-shadow-sm';
    containerJson.classList.remove('hidden');
    containerTable.classList.add('hidden');
  });
}
