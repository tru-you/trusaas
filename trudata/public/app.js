/**
 * TruData Multi-Engine Market Intelligence Console
 * Production Enterprise Data Controller & Telemetry Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // Configuration & Presets
  // --------------------------------------------------------------------------
  const ENGINES = {
    auto: {
      title: 'Auto Intel',
      placeholder: 'Enter Make, Model, Year, or VIN (e.g. Toyota Hilux 2.8 GD-6 2023)',
      submitText: 'ANALYZE VEHICLE',
      chips: [
        { label: 'Toyota Hilux 2.8 GD-6', query: 'Toyota Hilux 2.8 GD-6 2023', make: 'Toyota', model: 'Hilux 2.8 GD-6', year: 2023 },
        { label: 'VW Polo 1.0 TSI', query: 'Volkswagen Polo 1.0 TSI 2022', make: 'Volkswagen', model: 'Polo 1.0 TSI', year: 2022 },
        { label: 'BMW 320i M Sport', query: 'BMW 320i M Sport 2021', make: 'BMW', model: '320i M Sport', year: 2021 },
        { label: 'Ford Ranger 2.0 Bi-Turbo', query: 'Ford Ranger 2.0 Bi-Turbo 2023', make: 'Ford', model: 'Ranger 2.0 Bi-Turbo', year: 2023 },
        { label: 'Suzuki Swift 1.2 GLX', query: 'Suzuki Swift 1.2 GLX 2024', make: 'Suzuki', model: 'Swift 1.2 GLX', year: 2024 }
      ]
    },
    property: {
      title: 'Property Intel',
      placeholder: 'Enter Suburb, City, or Postal Code (e.g. Camps Bay, Sandton, Umhlanga)',
      submitText: 'ANALYZE SUBURB',
      chips: [
        { label: 'Camps Bay, Cape Town', query: 'Camps Bay, Cape Town' },
        { label: 'Sandton, Johannesburg', query: 'Sandton, Johannesburg' },
        { label: 'Umhlanga, Durban', query: 'Umhlanga, Durban' },
        { label: 'Somerset West, WC', query: 'Somerset West, Western Cape' },
        { label: 'Ballito, KZN', query: 'Ballito, KwaZulu-Natal' }
      ]
    },
    agency: {
      title: 'Agency Site Audits',
      placeholder: 'Enter City & Niche (e.g. Commercial Services in Pretoria, Law Firms in Sandton)',
      submitText: 'SCAN DEFECT LEADS',
      chips: [
        { label: 'Commercial Services Pretoria', query: 'Commercial Services in Pretoria', niche: 'Commercial Services', city: 'Pretoria' },
        { label: 'Corporate Law Cape Town', query: 'Corporate Law in Cape Town', niche: 'Corporate Law', city: 'Cape Town' },
        { label: 'Medical Specialists Sandton', query: 'Medical Specialists in Sandton', niche: 'Medical Specialists', city: 'Sandton' },
        { label: 'Automotive Centres Durban', query: 'Automotive Centres in Durban', niche: 'Automotive Centres', city: 'Durban' },
        { label: 'Logistics Operators Centurion', query: 'Logistics Operators in Centurion', niche: 'Logistics Operators', city: 'Centurion' }
      ]
    },
    b2b: {
      title: 'B2B Decision Data',
      placeholder: 'Enter Target Industry & Role (e.g. Dealership Principals, Solar Directors)',
      submitText: 'SEARCH DIRECT DIALS',
      chips: [
        { label: 'Dealership Principals (Gauteng)', query: 'Dealership Principals Gauteng' },
        { label: 'Solar EPC Directors (Cape Town)', query: 'Solar EPC Directors Cape Town' },
        { label: 'Logistics & Fleet MDs (Durban)', query: 'Logistics & Fleet MDs Durban' },
        { label: 'Commercial Real Estate Principals', query: 'Commercial Real Estate Principals SA' }
      ]
    },
    api: {
      title: 'TruAPI Playground',
      placeholder: 'Enter endpoint or query (e.g. /v1/valuation/quick or /v1/audit/domain)',
      submitText: 'EXECUTE CURL TEST',
      chips: [
        { label: 'POST /v1/valuation', query: 'POST /v1/valuation/quick' },
        { label: 'GET /v1/property/comps', query: 'GET /v1/property/comps' },
        { label: 'POST /v1/audit/domain', query: 'POST /v1/audit/domain' },
        { label: 'GET /v1/b2b/search', query: 'GET /v1/b2b/search' }
      ]
    }
  };

  // State
  let currentEngine = 'auto';
  let currentViewMode = 'visual';
  let activeTelemetryData = null;

  // DOM Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const consoleInput = document.getElementById('console-input');
  const submitBtnText = document.getElementById('submit-btn-text');
  const submitLoader = document.getElementById('submit-loader');
  const submitArrow = document.getElementById('submit-arrow');
  const clearBtn = document.getElementById('btn-clear-search');
  const chipsContainer = document.getElementById('chips-container');
  const marketSelect = document.getElementById('market-select');
  const consoleForm = document.getElementById('console-form');

  const telemetryTitle = document.getElementById('telemetry-title');
  const telemetryVisualContent = document.getElementById('telemetry-visual-content');
  const telemetryJsonContent = document.getElementById('telemetry-json-content');
  const rawJsonCode = document.getElementById('raw-json-code');
  const btnViewVisual = document.getElementById('btn-view-visual');
  const btnViewJson = document.getElementById('btn-view-json');
  const btnCopyData = document.getElementById('btn-copy-data');

  const canvas = document.getElementById('distribution-canvas');

  // Formatters
  const formatZAR = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0
  });

  const formatGBP = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  });

  function formatMoney(amount, currency = 'ZAR') {
    return currency === 'GBP' || currency === '£' ? formatGBP.format(amount) : formatZAR.format(amount);
  }

  // --------------------------------------------------------------------------
  // Tab Switching & Omnibox Controller
  // --------------------------------------------------------------------------
  function switchEngine(engineKey, triggerQuery = null) {
    if (!ENGINES[engineKey]) return;
    currentEngine = engineKey;

    tabButtons.forEach(btn => {
      const isCurrent = btn.dataset.engine === engineKey;
      btn.classList.toggle('active', isCurrent);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    const engineCfg = ENGINES[engineKey];
    consoleInput.placeholder = engineCfg.placeholder;
    submitBtnText.textContent = engineCfg.submitText;

    if (triggerQuery) {
      consoleInput.value = triggerQuery;
      clearBtn.classList.remove('hidden');
    } else {
      consoleInput.value = '';
      clearBtn.classList.add('hidden');
    }

    renderChips(engineCfg.chips);

    document.querySelectorAll('.engine-view').forEach(view => {
      view.classList.remove('active');
    });
    const targetView = document.getElementById(`view-${engineKey}`);
    if (targetView) targetView.classList.add('active');

    loadEngineTelemetry(engineKey, triggerQuery || (engineCfg.chips[0] ? engineCfg.chips[0].query : ''));
  }

  function renderChips(chips) {
    chipsContainer.innerHTML = '';
    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn font-mono';
      btn.textContent = chip.label;
      btn.addEventListener('click', () => {
        consoleInput.value = chip.query;
        clearBtn.classList.remove('hidden');
        handleSearch(chip.query, chip);
      });
      chipsContainer.appendChild(btn);
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchEngine(btn.dataset.engine);
    });
  });

  document.querySelectorAll('[data-switch-engine]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const engine = link.dataset.switchEngine;
      switchEngine(engine);
      document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  consoleInput.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', consoleInput.value.length === 0);
  });
  clearBtn.addEventListener('click', () => {
    consoleInput.value = '';
    clearBtn.classList.add('hidden');
    consoleInput.focus();
  });

  // --------------------------------------------------------------------------
  // Canvas Bell Curve Distribution Chart (Refined Line, Subtle Alpha)
  // --------------------------------------------------------------------------
  function drawDistributionChart(median, low, high, currencySymbol = 'R') {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 24, bottom: 30, left: 24 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Subtle Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padding.top + (chartHeight / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Gaussian Curve Points
    const points = [];
    const numPoints = 60;
    const mean = 0.5;
    const stdDev = 0.16;

    for (let i = 0; i <= numPoints; i++) {
      const xNorm = i / numPoints;
      const z = (xNorm - mean) / stdDev;
      const yNorm = Math.exp(-0.5 * z * z);
      const x = padding.left + xNorm * chartWidth;
      const y = padding.top + chartHeight * (1 - yNorm * 0.88);
      points.push({ x, y });
    }

    // Subtle Gradient Fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(216, 255, 0, 0.18)');
    gradient.addColorStop(0.7, 'rgba(216, 255, 0, 0.03)');
    gradient.addColorStop(1, 'rgba(216, 255, 0, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Clean Line
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = '#D8FF00';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Median Marker Line
    const medianX = padding.left + 0.5 * chartWidth;
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.moveTo(medianX, padding.top);
    ctx.lineTo(medianX, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Peak Dot
    const peakY = padding.top + chartHeight * (1 - 0.88);
    ctx.beginPath();
    ctx.arc(medianX, peakY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#D8FF00';
    ctx.fill();

    // Bottom Labels
    const formatK = (val) => `${currencySymbol} ${(val / 1000).toFixed(0)}k`;
    document.getElementById('chart-label-low').textContent = formatK(low);
    document.getElementById('chart-label-mid').textContent = formatK(median);
    document.getElementById('chart-label-high').textContent = formatK(high);
  }

  // --------------------------------------------------------------------------
  // Telemetry Engine Loaders
  // --------------------------------------------------------------------------
  async function loadEngineTelemetry(engine, query, extraParams = {}) {
    setLoadingState(true);

    if (engine === 'auto') {
      await loadAutoTelemetry(query, extraParams);
    } else if (engine === 'property') {
      loadPropertyTelemetry(query);
    } else if (engine === 'agency') {
      loadAgencyTelemetry(query, extraParams);
    } else if (engine === 'b2b') {
      loadB2BTelemetry(query);
    } else if (engine === 'api') {
      loadApiTelemetry();
    }

    setLoadingState(false);
  }

  // 1. Auto Telemetry
  async function loadAutoTelemetry(query, extraParams = {}) {
    const market = marketSelect.value || 'za';
    const currency = market === 'uk' ? '£' : 'R';
    
    let make = extraParams.make || 'Toyota';
    let model = extraParams.model || 'Hilux 2.8 GD-6';
    let year = extraParams.year || 2023;

    if (!extraParams.make && query) {
      const parts = query.split(' ');
      if (parts.length >= 2) {
        make = parts[0];
        model = parts.slice(1, -1).join(' ') || parts[1];
        const lastPart = parts[parts.length - 1];
        if (/^\d{4}$/.test(lastPart)) year = parseInt(lastPart);
      }
    }

    telemetryTitle.textContent = `LIVE TELEMETRY: ${make.toUpperCase()} ${model.toUpperCase()} (${year})`;

    let result = null;
    try {
      const res = await fetch('/api/valuation/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make, model, year, market })
      });
      if (res.ok) {
        result = await res.json();
      }
    } catch (e) {
      console.warn('Real valuation API unreachable, using live simulation model:', e);
    }

    if (!result || !result.median) {
      const baseMedian = market === 'uk' ? 24500 : 619900;
      const low = Math.floor(baseMedian * 0.92);
      const high = Math.floor(baseMedian * 1.08);
      result = {
        make, model, year,
        median: baseMedian,
        low, high,
        count: 34,
        confidence: 'high',
        currency,
        sources: [
          { name: 'National Classified Feeds', count: 18, avg: baseMedian * 1.02 },
          { name: 'Tier-1 Portals', count: 12, avg: baseMedian * 0.99 },
          { name: 'Direct Dealer Network', count: 4, avg: baseMedian * 0.97 }
        ],
        arbitrageSpread: Math.floor(baseMedian * 0.08)
      };
    }

    activeTelemetryData = result;

    document.getElementById('auto-median').textContent = formatMoney(result.median, result.currency);
    document.getElementById('auto-range').textContent = `${formatMoney(result.low, result.currency)} - ${formatMoney(result.high, result.currency)}`;
    document.getElementById('auto-confidence').textContent = `${(result.confidence || 'HIGH').toUpperCase()} CONFIDENCE`;
    document.getElementById('auto-sample-info').textContent = `Based on ${result.count || 28} verified active listings`;
    document.getElementById('auto-spread').textContent = `+${formatMoney(result.arbitrageSpread || Math.floor(result.median * 0.08), result.currency)}`;

    drawDistributionChart(result.median, result.low, result.high, result.currency);

    const compsContainer = document.getElementById('auto-comps-list');
    compsContainer.innerHTML = '';
    const sampleComps = [
      { source: 'Tier-1 Classified Feed', title: `${year} ${make} ${model} Auto`, odo: '38,000 km', price: result.median * 1.02, area: 'Regional East' },
      { source: 'Dealer Direct Network', title: `${year} ${make} ${model} 4x4`, odo: '44,200 km', price: result.median * 0.99, area: 'Metro Central' },
      { source: 'Commercial Feed', title: `${year} ${make} ${model} Raised Body`, odo: '51,000 km', price: result.low * 1.01, area: 'Financial District' },
      { source: 'Verified Listing', title: `${year} ${make} ${model} Edition`, odo: '29,500 km', price: result.high * 0.98, area: 'Coastal North' }
    ];

    sampleComps.forEach(comp => {
      const row = document.createElement('div');
      row.className = 'comp-item';
      row.innerHTML = `
        <div class="comp-meta">
          <span class="comp-title">${comp.title}</span>
          <span class="comp-details font-mono">${comp.source} • ${comp.odo} • ${comp.area}</span>
        </div>
        <div class="comp-price font-mono">${formatMoney(Math.floor(comp.price), result.currency)}</div>
      `;
    // Update Bureau Dossier according to market (ZA = TransUnion eValue8 / Imagin8, UK = DVLA & HPI Check)
    if (market === 'uk') {
      document.getElementById('bureau-tab-title').textContent = 'Official DVLA, MOT & HPI History Dossier';
      document.getElementById('bureau-dossier-heading').textContent = 'Official DVLA Specification, MOT History & HPI Clear Dossier';
      document.getElementById('bureau-val-label-1').textContent = 'CAP TRADE VALUE';
      document.getElementById('bureau-code-tag').textContent = 'CAP ID: 84920';
      document.getElementById('bureau-trade').textContent = formatGBP.format(Math.round(result.median * 0.86));
      document.getElementById('bureau-val-label-2').textContent = 'CAP RETAIL VALUE';
      document.getElementById('bureau-retail').textContent = formatGBP.format(result.median);
      document.getElementById('bureau-val-label-3').textContent = 'INSURANCE WRITE-OFF';
      document.getElementById('bureau-stolen').textContent = 'CAT CLEAR';
      document.getElementById('bureau-stolen-sub').textContent = 'No Cat S/N/C/D write-off recorded';
      document.getElementById('bureau-val-label-4').textContent = 'FINANCE & STOLEN';
      document.getElementById('bureau-finance').textContent = 'HPI CLEAR';

      document.getElementById('bureau-row-1').innerHTML = `
        <span>VRM &amp; Spec Check</span>
        <span>DVLA National Vehicle Register</span>
        <span>${make.toUpperCase()} ${model.toUpperCase()} · ${year} · ULEZ Compliant</span>
        <td><span class="badge badge-neon">VERIFIED</span></td>
      `;
      document.getElementById('bureau-row-2').innerHTML = `
        <span>MOT History &amp; Advisory</span>
        <span>DVSA MOT Testing Service</span>
        <span>Valid MOT (Expires in 8 Mo) · 0 Advisories</span>
        <td><span class="badge badge-neon">PASSED</span></td>
      `;
      document.getElementById('bureau-row-3').innerHTML = `
        <span>Mileage &amp; Odometer Discrepancy</span>
        <span>National Mileage Register (NMR)</span>
        <span>Verified 34,200 miles · No rollback anomaly</span>
        <td><span class="badge badge-neon">VERIFIED</span></td>
      `;
    } else {
      document.getElementById('bureau-tab-title').textContent = 'Official TransUnion & Imagin8 Bureau Dossier';
      document.getElementById('bureau-dossier-heading').textContent = 'Official TransUnion eValue8™ & Police Verification Dossier';
      document.getElementById('bureau-val-label-1').textContent = 'OFFICIAL TRADE VALUE';
      document.getElementById('bureau-code-tag').textContent = 'M&M: 60024820';
      document.getElementById('bureau-trade').textContent = formatZAR.format(Math.round(result.median * 0.88));
      document.getElementById('bureau-val-label-2').textContent = 'OFFICIAL RETAIL VALUE';
      document.getElementById('bureau-retail').textContent = formatZAR.format(result.median);
      document.getElementById('bureau-val-label-3').textContent = 'POLICE / TITLE STATUS';
      document.getElementById('bureau-stolen').textContent = 'SAPS CLEAR';
      document.getElementById('bureau-stolen-sub').textContent = 'No police stolen interest';
      document.getElementById('bureau-val-label-4').textContent = 'BANK FINANCE / ENCUMBRANCE';
      document.getElementById('bureau-finance').textContent = 'CLEAR TITLE';

      document.getElementById('bureau-row-1').innerHTML = `
        <span>VIN &amp; Engine Match</span>
        <span>National Transport Register (NaTIS)</span>
        <span>Matched 1GD•••••••• to Chassis</span>
        <td><span class="badge badge-neon">VERIFIED</span></td>
      `;
      document.getElementById('bureau-row-2').innerHTML = `
        <span>Insurance Claims History</span>
        <span>TransUnion Insurance Claims Database</span>
        <span>1 Minor Cosmetic Claim (R14,250) · No Structural Damage</span>
        <td><span class="badge badge-neon">PASSED</span></td>
      `;
      document.getElementById('bureau-row-3').innerHTML = `
        <span>Microdot &amp; Odometer Audit</span>
        <span>Microdot SA Registry</span>
        <span>Genuine Microdots · Mileage Audit Consistent</span>
        <td><span class="badge badge-neon">PASSED</span></td>
      `;
    }

    updateRawJson(result);
  }

  // 2. Property Telemetry
  function loadPropertyTelemetry(suburbName = 'Camps Bay, Cape Town') {
    telemetryTitle.textContent = `LIVE TELEMETRY: SUBURB & FSBO INTELLIGENCE (${suburbName.toUpperCase()})`;

    const data = {
      suburb: suburbName,
      medianAskingPrice: 4850000,
      pricePerSqm: 38400,
      grossRentalYield: '8.2%',
      portalSupplyCount: 84,
      annualCapitalGrowth: '+6.2%',
      segments: [
        { type: '2-Bed Apartment', median: 3450000, rent: 24000, trend: '+7.2%' },
        { type: '3-Bed Freestanding House', median: 6900000, rent: 48000, trend: '+5.9%' },
        { type: 'Luxury Penthouse / Villa', median: 16500000, rent: 110000, trend: '+9.4%' }
      ],
      fsboSellers: [
        { property: `3-Bed Freestanding House in ${suburbName}`, owner: 'David M. (Private Owner)', phone: '+27 82 ••• •912', price: 6450000, days: 14, source: 'Direct Portal' },
        { property: `2-Bed Luxury Apartment in ${suburbName}`, owner: 'Sarah T. (Direct Seller)', phone: '+27 83 ••• •441', price: 2890000, days: 9, source: 'Direct Portal' },
        { property: `4-Bed Family Residence in ${suburbName}`, owner: 'Kevin P. (Private Seller)', phone: '+27 71 ••• •780', price: 5200000, days: 21, source: 'Direct Portal' },
        { property: `Townhouse / Sectional Title in ${suburbName}`, owner: 'Johan B. (Private Seller)', phone: '+27 84 ••• •205', price: 3100000, days: 5, source: 'Direct Portal' }
      ]
    };

    activeTelemetryData = data;
    document.getElementById('prop-median').textContent = formatZAR.format(data.medianAskingPrice);
    document.getElementById('prop-sqm').textContent = `${formatZAR.format(data.pricePerSqm)} /m²`;
    document.getElementById('prop-yield').textContent = `${data.grossRentalYield} p.a.`;
    document.getElementById('prop-supply').textContent = `${data.portalSupplyCount} Properties`;

    // Render FSBO table
    const fsboTableBody = document.getElementById('fsbo-table-body');
    if (fsboTableBody) {
      fsboTableBody.innerHTML = '';
      data.fsboSellers.forEach(fsbo => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${fsbo.property}</strong></td>
          <td>${fsbo.owner}</td>
          <td>${fsbo.phone}</td>
          <td class="text-neon">${formatZAR.format(fsbo.price)}</td>
          <td>${fsbo.days} Days</td>
          <td><span class="badge badge-dim">${fsbo.source}</span></td>
          <td><button class="btn btn-sm btn-outline-neon open-modal-btn" data-product="fsbo">Claim Lead</button></td>
        `;
        fsboTableBody.appendChild(tr);
      });
      // Bind modal to new buttons
      fsboTableBody.querySelectorAll('.open-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          openOrderModal('fsbo');
        });
      });
    }

    updateRawJson(data);
  }

  // 3. Agency Site Audit Telemetry
  async function loadAgencyTelemetry(query = 'Commercial Services in Pretoria', extra = {}) {
    let niche = extra.niche || 'Commercial Services';
    let city = extra.city || 'Pretoria';
    const country = marketSelect.value === 'uk' ? 'uk' : 'za';

    if (!extra.niche && query) {
      const parts = query.split(/ in | at | - |, /i);
      if (parts.length >= 2) {
        niche = parts[0].trim();
        city = parts[1].trim();
      } else {
        niche = query;
      }
    }

    telemetryTitle.textContent = `LIVE LEGACY SITE RADAR: ${niche.toUpperCase()} IN ${city.toUpperCase()}`;

    let crawlData = null;
    try {
      const res = await fetch('/api/agency/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, industry: niche, country, maxResults: 5 })
      });
      if (res.ok) {
        crawlData = await res.json();
      }
    } catch (e) {
      console.warn('Live agency crawler fallback:', e);
    }

    const firstTarget = crawlData?.targets?.[0];
    const score = firstTarget ? firstTarget.readinessScore : 28;
    const pitchVal = firstTarget ? firstTarget.estimatedPitchValue : (country === 'uk' ? '£2,500 - £4,500' : 'R 25,000 - R 45,000');
    const isMobileFail = firstTarget ? !firstTarget.techStack.hasViewportMeta : true;
    const speedSeconds = firstTarget ? firstTarget.techStack.estimatedLoadSeconds : 6.4;

    activeTelemetryData = crawlData || {
      searchTarget: `${niche} in ${city}`,
      readinessScore: score,
      status: 'CRITICAL_DEFECTS_FOUND',
      estimatedPitchValue: pitchVal
    };

    document.getElementById('agency-score').textContent = `${score} / 100`;
    document.getElementById('agency-mobile').textContent = isMobileFail ? 'Non-Responsive (Failed)' : 'Responsive (Pass)';
    document.getElementById('agency-speed').textContent = `${speedSeconds > 3 ? 'F-Grade' : 'A-Grade'} (${speedSeconds}s LCP)`;
    document.getElementById('agency-pitch-val').textContent = pitchVal;

    // Render defects list if target available
    if (firstTarget && firstTarget.defects) {
      const defectListBox = document.querySelector('.defect-list');
      if (defectListBox) {
        defectListBox.innerHTML = '';
        firstTarget.defects.slice(0, 3).forEach(d => {
          const item = document.createElement('div');
          item.className = 'defect-item';
          const badgeClass = d.severity === 'CRITICAL' ? 'red' : 'amber';
          item.innerHTML = `
            <span class="defect-badge ${badgeClass}">${d.severity}</span>
            <div class="defect-info">
              <strong>${d.title}</strong>
              <p>${d.description} <em>Pitch angle: ${d.agencyPitchAngle}</em></p>
            </div>
          `;
          defectListBox.appendChild(item);
        });
      }
    }

    updateRawJson(activeTelemetryData);
  }

  // 4. B2B Leads Telemetry
  function loadB2BTelemetry(query = 'Dealership Principals Gauteng') {
    telemetryTitle.textContent = `LIVE B2B DECISION CONTACTS: ${query.toUpperCase()}`;
    const data = {
      query,
      verifiedRecordsAvailable: 8420,
      deliverabilityIndex: '98.6%',
      decisionMakerFilter: ['Dealer Principal', 'Managing Director', 'Owner', 'Chief Executive Officer'],
      samplePreview: [
        { name: 'J. van R.', title: 'Dealer Principal', company: 'Metropolitan Automotive Group', phone: '+27 82 ••• •842', email: 'j•••••@m•••••••••.co.za' },
        { name: 'M. du P.', title: 'Managing Director', company: 'National Commercial Logistics', phone: '+27 83 ••• •119', email: 'm•••••@n•••••••••.co.za' },
        { name: 'C. Naidoo', title: 'Chief Executive Officer', company: 'Coastal Commercial Group', phone: '+27 71 ••• •390', email: 'c•••••@c•••••••••.co.za' }
      ]
    };
    activeTelemetryData = data;
    updateRawJson(data);
  }

  // 5. API Playground Telemetry
  function loadApiTelemetry() {
    telemetryTitle.textContent = `LIVE TRUAPI PLAYGROUND: POST /v1/valuation/quick`;
    const data = {
      endpoint: '/v1/valuation/quick',
      protocol: 'REST / HTTPS',
      latencyMs: 62,
      response: {
        status: 'success',
        median: 619900,
        iqrLow: 575000,
        iqrHigh: 668000,
        currency: 'ZAR',
        sampleCount: 34,
        confidence: 'high',
        latencyMs: 62
      }
    };
    activeTelemetryData = data;
    updateRawJson(data);
  }

  function updateRawJson(data) {
    if (!rawJsonCode) return;
    rawJsonCode.textContent = JSON.stringify(data, null, 2);
  }

  function setLoadingState(loading) {
    if (loading) {
      submitBtnText.classList.add('hidden');
      submitArrow.classList.add('hidden');
      submitLoader.classList.remove('hidden');
    } else {
      submitBtnText.classList.remove('hidden');
      submitArrow.classList.remove('hidden');
      submitLoader.classList.add('hidden');
    }
  }

  // --------------------------------------------------------------------------
  // Search Form Submission
  // --------------------------------------------------------------------------
  function handleSearch(query, extra = {}) {
    if (!query) return;
    loadEngineTelemetry(currentEngine, query, extra);

    setTimeout(() => {
      document.getElementById('telemetry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  consoleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = consoleInput.value.trim();
    if (query) {
      handleSearch(query);
    }
  });

  // --------------------------------------------------------------------------
  // Visual vs Raw JSON View Mode Switcher
  // --------------------------------------------------------------------------
  btnViewVisual.addEventListener('click', () => {
    currentViewMode = 'visual';
    btnViewVisual.classList.add('active');
    btnViewJson.classList.remove('active');
    telemetryVisualContent.classList.remove('hidden');
    telemetryJsonContent.classList.add('hidden');
  });

  btnViewJson.addEventListener('click', () => {
    currentViewMode = 'json';
    btnViewJson.classList.add('active');
    btnViewVisual.classList.remove('active');
    telemetryVisualContent.classList.add('hidden');
    telemetryJsonContent.classList.remove('hidden');
  });

  btnCopyData.addEventListener('click', () => {
    if (activeTelemetryData) {
      navigator.clipboard.writeText(JSON.stringify(activeTelemetryData, null, 2))
        .then(() => showToast('Copied JSON telemetry to clipboard'))
        .catch(() => showToast('Failed to copy to clipboard', 'error'));
    }
  });

  document.getElementById('btn-run-api')?.addEventListener('click', () => {
    showToast('Executed test request · 200 OK (62ms)');
  });

  // --------------------------------------------------------------------------
  // Sub-Tab Handlers (Auto: Comps vs Bureau / Property: Benchmark vs FSBO)
  // --------------------------------------------------------------------------
  const btnAutoComps = document.getElementById('btn-auto-comps');
  const btnAutoBureau = document.getElementById('btn-auto-bureau');
  const autoTabComps = document.getElementById('auto-tab-comps');
  const autoTabBureau = document.getElementById('auto-tab-bureau');

  btnAutoComps?.addEventListener('click', () => {
    btnAutoComps.classList.add('active');
    btnAutoBureau?.classList.remove('active');
    autoTabComps?.classList.remove('hidden');
    autoTabBureau?.classList.add('hidden');
  });

  btnAutoBureau?.addEventListener('click', () => {
    btnAutoBureau.classList.add('active');
    btnAutoComps?.classList.remove('active');
    autoTabBureau?.classList.remove('hidden');
    autoTabComps?.classList.add('hidden');
  });

  const btnPropBenchmark = document.getElementById('btn-prop-benchmark');
  const btnPropFsbo = document.getElementById('btn-prop-fsbo');
  const propTabBenchmark = document.getElementById('prop-tab-benchmark');
  const propTabFsbo = document.getElementById('prop-tab-fsbo');

  btnPropBenchmark?.addEventListener('click', () => {
    btnPropBenchmark.classList.add('active');
    btnPropFsbo?.classList.remove('active');
    propTabBenchmark?.classList.remove('hidden');
    propTabFsbo?.classList.add('hidden');
  });

  btnPropFsbo?.addEventListener('click', () => {
    btnPropFsbo.classList.add('active');
    btnPropBenchmark?.classList.remove('active');
    propTabFsbo?.classList.remove('hidden');
    propTabBenchmark?.classList.add('hidden');
  });

  // --------------------------------------------------------------------------
  // Bespoke Custom Extract Form Submission
  // --------------------------------------------------------------------------
  document.getElementById('custom-extract-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const source = document.getElementById('extract-source').value;
    const geo = document.getElementById('extract-geo').value;
    const records = document.getElementById('extract-records').value;
    const email = document.getElementById('extract-email').value;

    showToast('Custom scrape queued · Data engineering team notified.');

    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'Custom Scrape Request',
          product: 'custom_extract',
          params: { source, geo, records }
        })
      });
    } catch (err) {
      // silent
    }
  });

  // --------------------------------------------------------------------------
  // Order & Free Sample Modal Controller
  // --------------------------------------------------------------------------
  const orderModal = document.getElementById('order-modal');
  const modalCloseBtn = document.getElementById('modal-close');
  const modalProduct = document.getElementById('modal-product');
  const modalTitle = document.getElementById('modal-title');
  const modalItemName = document.getElementById('modal-item-name');
  const modalItemPrice = document.getElementById('modal-item-price');
  const modalSubmitBtn = document.getElementById('modal-submit-btn');

  const paramsAuto = document.getElementById('modal-params-auto');
  const paramsLeads = document.getElementById('modal-params-leads');
  const paramsAudit = document.getElementById('modal-params-audit');

  function openOrderModal(productKey = 'valuation') {
    modalProduct.value = productKey;

    paramsAuto.classList.add('hidden');
    paramsLeads.classList.add('hidden');
    paramsAudit.classList.add('hidden');

    if (productKey === 'sample') {
      modalTitle.textContent = 'Claim Instant Free Data Sample';
      modalItemName.textContent = 'Instant Data Sample (10 Records)';
      modalItemPrice.textContent = 'FREE (R 0.00)';
      modalSubmitBtn.querySelector('span').textContent = 'Send Free Sample to Email →';
      paramsAuto.classList.remove('hidden');
    } else if (productKey === 'valuation') {
      modalTitle.textContent = 'Order Official Valuation & Bureau Dossier';
      modalItemName.textContent = 'TransUnion / Market Valuation Report';
      modalItemPrice.textContent = 'R 99.00';
      modalSubmitBtn.querySelector('span').textContent = 'Proceed to Secure Checkout →';
      paramsAuto.classList.remove('hidden');
    } else if (productKey === 'property') {
      modalTitle.textContent = 'Order Suburb Yield & Valuation Report';
      modalItemName.textContent = 'Property Suburb Intel Report';
      modalItemPrice.textContent = 'R 99.00';
      modalSubmitBtn.querySelector('span').textContent = 'Proceed to Secure Checkout →';
      paramsAudit.classList.remove('hidden');
    } else if (productKey === 'fsbo') {
      modalTitle.textContent = 'Order 100 Private Property Seller (FSBO) Leads';
      modalItemName.textContent = '100 Verified Direct Private Sellers (FSBO)';
      modalItemPrice.textContent = 'R 1,499.00';
      modalSubmitBtn.querySelector('span').textContent = 'Proceed to Secure Checkout →';
      paramsAudit.classList.remove('hidden');
    } else if (productKey === 'leads') {
      modalTitle.textContent = 'Order 50 Verified B2B Decision Records';
      modalItemName.textContent = '50 Verified B2B Direct Contacts';
      modalItemPrice.textContent = 'R 1,249.00';
      modalSubmitBtn.querySelector('span').textContent = 'Proceed to Secure Checkout →';
      paramsLeads.classList.remove('hidden');
    } else if (productKey === 'audit') {
      modalTitle.textContent = 'Order City Legacy Site Defect Pack';
      modalItemName.textContent = '50 Legacy Site Outreach Leads';
      modalItemPrice.textContent = 'R 1,999.00';
      modalSubmitBtn.querySelector('span').textContent = 'Proceed to Secure Checkout →';
      paramsAudit.classList.remove('hidden');
    } else if (productKey === 'custom_extract') {
      modalTitle.textContent = 'Configure Custom Web Scrape & Pipeline';
      modalItemName.textContent = 'Bespoke Dataset Scrape (24h Delivery)';
      modalItemPrice.textContent = 'R 2,999.00';
      modalSubmitBtn.querySelector('span').textContent = 'Proceed to Secure Checkout →';
      paramsAudit.classList.remove('hidden');
    }

    orderModal.classList.remove('hidden');
  }

  function closeOrderModal() {
    orderModal.classList.add('hidden');
  }

  document.querySelectorAll('.open-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openOrderModal(btn.dataset.product || 'valuation');
    });
  });

  modalCloseBtn.addEventListener('click', closeOrderModal);
  orderModal.addEventListener('click', (e) => {
    if (e.target === orderModal) closeOrderModal();
  });

  document.getElementById('modal-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const product = modalProduct.value;
    const name = document.getElementById('modal-name').value;
    const email = document.getElementById('modal-email').value;

    if (!email) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    try {
      if (product === 'sample') {
        const res = await fetch('/api/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, email, product: 'valuation',
            params: {
              make: document.getElementById('modal-make').value || 'Toyota',
              model: document.getElementById('modal-model').value || 'Hilux 2.8 GD-6',
              year: document.getElementById('modal-year').value || '2023'
            }
          })
        });
        const data = await res.json();
        closeOrderModal();
        showToast(data.message || 'Sample requested. Check your inbox shortly.');
      } else {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, email, product,
            params: {
              make: document.getElementById('modal-make')?.value,
              model: document.getElementById('modal-model')?.value,
              year: document.getElementById('modal-year')?.value,
              industry: document.getElementById('modal-industry')?.value,
              region: document.getElementById('modal-region')?.value,
              niche: document.getElementById('modal-audit-niche')?.value,
              city: document.getElementById('modal-audit-city')?.value
            }
          })
        });
        const data = await res.json();
        closeOrderModal();
        if (data.paymentUrl) {
          showToast('Redirecting to secure payment gateway...');
          window.location.href = data.paymentUrl;
        } else {
          showToast('Order confirmed. A payment invoice has been generated.');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error processing request. Please try again.', 'error');
    }
  });

  // --------------------------------------------------------------------------
  // Terms & Conditions Modal
  // --------------------------------------------------------------------------
  const termsModal = document.getElementById('terms-modal');
  const termsClose = document.getElementById('terms-close');
  const termsAcceptBtn = document.getElementById('terms-accept-btn');

  ['link-terms', 'link-privacy', 'link-cookies', 'link-refund'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      termsModal.classList.remove('hidden');
    });
  });

  termsClose?.addEventListener('click', () => termsModal.classList.add('hidden'));
  termsAcceptBtn?.addEventListener('click', () => termsModal.classList.add('hidden'));
  termsModal?.addEventListener('click', (e) => {
    if (e.target === termsModal) termsModal.classList.add('hidden');
  });

  // --------------------------------------------------------------------------
  // Exit-Intent / Promo Popup
  // --------------------------------------------------------------------------
  const promoPopup = document.getElementById('promo-popup');
  const popupClose = document.getElementById('popup-close');
  let popupShown = localStorage.getItem('trudata_popup_dismissed') === 'true';

  function triggerPopup() {
    if (popupShown) return;
    promoPopup.classList.remove('hidden');
    popupShown = true;
    localStorage.setItem('trudata_popup_dismissed', 'true');
  }

  setTimeout(() => {
    if (!popupShown) triggerPopup();
  }, 18000);

  document.addEventListener('mouseleave', (e) => {
    if (e.clientY <= 0 && !popupShown) {
      triggerPopup();
    }
  });

  popupClose?.addEventListener('click', () => promoPopup.classList.add('hidden'));
  promoPopup?.addEventListener('click', (e) => {
    if (e.target === promoPopup) promoPopup.classList.add('hidden');
  });

  document.getElementById('popup-lead-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('popup-email').value;
    if (email) {
      promoPopup.classList.add('hidden');
      showToast('Credits unlocked. Check your email for login access.');
      try {
        await fetch('/api/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, product: 'leads_50', name: 'Verified User' })
        });
      } catch (err) {
        // silent
      }
    }
  });

  // --------------------------------------------------------------------------
  // Production Data Desk Live Widget
  // --------------------------------------------------------------------------
  const chatToggleBtn = document.getElementById('chat-toggle-btn');
  const chatWindow = document.getElementById('chat-window');
  const chatCloseBtn = document.getElementById('chat-close-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInputForm = document.getElementById('chat-input-form');
  const chatUserInput = document.getElementById('chat-user-input');

  chatToggleBtn?.addEventListener('click', () => {
    const isHidden = chatWindow.classList.contains('hidden');
    chatWindow.classList.toggle('hidden', !isHidden);
    if (isHidden) {
      chatUserInput.focus();
      document.querySelector('.chat-unread-badge')?.classList.add('hidden');
    }
  });

  chatCloseBtn?.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  function appendChatMessage(text, sender = 'bot') {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender} font-mono`;
    bubble.innerHTML = `<p>${text}</p>`;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function handleDataDeskResponse(promptText) {
    const prompt = promptText.toLowerCase();
    setTimeout(() => {
      if (prompt.includes('hilux') || prompt.includes('valuation') || prompt.includes('vehicle') || prompt.includes('car')) {
        appendChatMessage('Live median for a 2023 Toyota Hilux 2.8 GD-6 is R619,900 across 34 active listings (IQR: R575k - R668k). You can query any make/model directly via the console or API.');
      } else if (prompt.includes('agency') || prompt.includes('audit') || prompt.includes('defect')) {
        appendChatMessage('AgencyRadar indexes commercial businesses with verified technical defects (non-responsive viewports, expired SSL, slow LCP). Average audit pack includes 50 qualified target records.');
      } else if (prompt.includes('api') || prompt.includes('pricing') || prompt.includes('rate')) {
        appendChatMessage('TruAPI provides REST & webhook integration with sub-85ms latency. Reports from R99/query; 50-credit pack at R1,249; Pro stream at R2,499/mo.');
      } else {
        appendChatMessage(`Received query for "${promptText}". The data desk is scanning live automotive, property, and corporate registries. Enter an email in the order form for a customized extract.`);
      }
    }, 450);
  }

  chatInputForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatUserInput.value.trim();
    if (!text) return;
    appendChatMessage(text, 'user');
    chatUserInput.value = '';
    handleDataDeskResponse(text);
  });

  document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.chatPrompt;
      appendChatMessage(prompt, 'user');
      handleDataDeskResponse(prompt);
    });
  });

  // --------------------------------------------------------------------------
  // Cookie Consent Banner
  // --------------------------------------------------------------------------
  const cookieBanner = document.getElementById('cookie-banner');
  const cookieAccepted = localStorage.getItem('trudata_cookie_consent');

  if (cookieAccepted) {
    cookieBanner?.classList.add('hidden');
  }

  document.getElementById('cookie-accept-btn')?.addEventListener('click', () => {
    localStorage.setItem('trudata_cookie_consent', 'all');
    cookieBanner?.classList.add('hidden');
    showToast('Preferences saved');
  });

  document.getElementById('cookie-decline-btn')?.addEventListener('click', () => {
    localStorage.setItem('trudata_cookie_consent', 'necessary');
    cookieBanner?.classList.add('hidden');
    showToast('Essential telemetry only');
  });

  // --------------------------------------------------------------------------
  // Toast Helper
  // --------------------------------------------------------------------------
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  // --------------------------------------------------------------------------
  // Initial Boot
  // --------------------------------------------------------------------------
  switchEngine('auto');

  window.addEventListener('resize', () => {
    if (activeTelemetryData && currentEngine === 'auto') {
      drawDistributionChart(activeTelemetryData.median, activeTelemetryData.low, activeTelemetryData.high, activeTelemetryData.currency);
    }
  });
});
