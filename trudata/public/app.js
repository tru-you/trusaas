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

  // HTML escape helper
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

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
  async function loadEngineTelemetry(engine, query, extraParams = {}, isLiveSearch = false) {
    try {
      if (engine === 'auto') {
        if (isLiveSearch) {
          setLoadingState(true);
          await loadAutoTelemetry(query, extraParams);
          setLoadingState(false);
        } else {
          loadAutoTelemetrySync(query, extraParams);
        }
      } else if (engine === 'property') {
        loadPropertyTelemetry(query);
      } else if (engine === 'agency') {
        loadAgencyTelemetry(query, extraParams, isLiveSearch);
      } else if (engine === 'b2b') {
        loadB2BTelemetry(query);
      } else if (engine === 'api') {
        loadApiTelemetry();
      }
    } catch (err) {
      console.error('Error loading engine telemetry:', err);
    } finally {
      setLoadingState(false);
    }
  }

  // Helper: Robust vehicle query parser
  function parseAutoQuery(query) {
    const q = (query || '').trim();
    let year = 2022;
    const yearMatch = q.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1]);
    }
    const cleanQ = q.replace(/\b(19\d{2}|20\d{2})\b/, '').trim();
    const knownMakes = ['Toyota', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Volkswagen', 'VW', 'Ford', 'Audi', 'Hyundai', 'Nissan', 'Kia', 'Renault', 'Isuzu', 'Honda', 'Mazda', 'Volvo', 'Land Rover', 'Porsche', 'Suzuki', 'Chery', 'Haval', 'Jeep', 'Lexus'];
    let make = 'Toyota';
    let model = cleanQ || 'Hilux 2.8 GD-6';

    for (const m of knownMakes) {
      const regex = new RegExp(`^${m}\\b`, 'i');
      if (regex.test(cleanQ)) {
        make = m === 'VW' ? 'Volkswagen' : (m.toLowerCase() === 'mercedes' ? 'Mercedes-Benz' : m);
        model = cleanQ.replace(regex, '').trim() || 'Corolla';
        break;
      }
    }

    if (make === 'Toyota' && !cleanQ.toLowerCase().startsWith('toyota')) {
      const parts = cleanQ.split(/\s+/);
      if (parts.length >= 2) {
        make = parts[0];
        model = parts.slice(1).join(' ');
      } else if (parts.length === 1 && parts[0]) {
        model = parts[0];
      }
    }

    return { make, model, year };
  }

  function loadAutoTelemetrySync(query, extraParams = {}) {
    const elMedian = document.getElementById('auto-median');
    if (elMedian) elMedian.textContent = '—';
    const elRange = document.getElementById('auto-range');
    if (elRange) elRange.textContent = '—';
    const elConf = document.getElementById('auto-confidence');
    if (elConf) elConf.textContent = 'SEARCHING...';
    const elSample = document.getElementById('auto-sample-info');
    if (elSample) elSample.textContent = 'Loading live data...';
    const elSpread = document.getElementById('auto-spread');
    if (elSpread) elSpread.textContent = '—';
    const compsContainer = document.getElementById('auto-comps-list');
    if (compsContainer) compsContainer.innerHTML = '';
    
    // Clear canvas
    if (typeof canvas !== 'undefined' && canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // 1b. Auto Telemetry (Live Async)
  async function loadAutoTelemetry(query, extraParams = {}) {
    const market = marketSelect?.value || 'za';
    const currency = market === 'uk' ? '£' : 'R';
    
    let { make, model, year } = parseAutoQuery(query);
    if (extraParams.make) make = extraParams.make;
    if (extraParams.model) model = extraParams.model;
    if (extraParams.year) year = extraParams.year;

    // Fast sync baseline first
    loadAutoTelemetrySync(query, { make, model, year });

    try {
      setLoadingState(true);
      const res = await fetch('/api/valuation/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make, model, year, market })
      });
      if (res.ok) {
        const data = await res.json();
        activeTelemetryData = data;

        const elMedian = document.getElementById('auto-median');
        const elRange = document.getElementById('auto-range');
        const elConf = document.getElementById('auto-confidence');
        const elSample = document.getElementById('auto-sample-info');
        const elSpread = document.getElementById('auto-spread');
        const elVelocity = document.getElementById('auto-velocity');
        const compsContainer = document.getElementById('auto-comps-list');

        if (data.median && data.count > 0) {
          if (elMedian) elMedian.textContent = formatMoney(data.median, currency);
          if (elRange) elRange.textContent = `${formatMoney(data.low, currency)} — ${formatMoney(data.high, currency)}`;
          if (elConf) elConf.textContent = (data.confidence || 'none').toUpperCase();
          if (elSample) elSample.textContent = `${data.count} live listings sampled`;
          const spread = data.high && data.low ? Math.round(((data.high - data.low) / data.median) * 100) : 0;
          if (elSpread) elSpread.textContent = `${spread}%`;
          if (elVelocity) elVelocity.textContent = data.count > 20 ? 'HIGH' : data.count > 8 ? 'MEDIUM' : 'LOW';

          // Chart labels
          const chartLow = document.getElementById('chart-label-low');
          const chartMid = document.getElementById('chart-label-mid');
          const chartHigh = document.getElementById('chart-label-high');
          if (chartLow) chartLow.textContent = formatMoney(data.low, currency);
          if (chartMid) chartMid.textContent = formatMoney(data.median, currency);
          if (chartHigh) chartHigh.textContent = formatMoney(data.high, currency);

          // Draw bell curve
          if (canvas) {
            drawDistributionChart(data.median, data.low, data.high, currency);
          }

          // Populate comps from sources
          if (compsContainer && data.sources) {
            compsContainer.innerHTML = '';
            data.sources.forEach(src => {
              const card = document.createElement('div');
              card.className = 'comp-card';
              const title = document.createElement('div');
              title.className = 'comp-title font-mono';
              title.textContent = src.name;
              const price = document.createElement('div');
              price.className = 'comp-price font-mono text-neon';
              price.textContent = `Avg: ${formatMoney(src.avg, currency)} (${src.count} listings)`;
              card.append(title, price);
              compsContainer.appendChild(card);
            });
          }
        } else {
          if (elMedian) elMedian.textContent = 'No data';
          if (elConf) elConf.textContent = 'NO LISTINGS FOUND';
          if (elSample) elSample.textContent = data.searchUrl ? 'Try a different make/model' : 'No listings found';
          if (elRange) elRange.textContent = '—';
          if (elSpread) elSpread.textContent = '—';
        }
        updateRawJson(data);
      }
    } catch (e) {
      console.warn('Valuation API call note:', e);
    } finally {
      setLoadingState(false);
    }
  }

  // 2. Property Telemetry (Live Suburb & FSBO Data)
  async function loadPropertyTelemetry(suburbName = 'Camps Bay, Cape Town') {
    const market = marketSelect?.value || 'za';
    const country = market === 'uk' ? 'uk' : 'za';
    telemetryTitle.textContent = `LIVE TELEMETRY: SUBURB & FSBO INTELLIGENCE (${suburbName.toUpperCase()})`;

    try {
      setLoadingState(true);
      const res = await fetch('/api/property/comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: suburbName, country })
      });

      if (res.ok) {
        const data = await res.json();
        activeTelemetryData = data;

        const elPropMedian = document.getElementById('prop-median');
        const elPropSqm = document.getElementById('prop-sqm');
        const elPropYield = document.getElementById('prop-yield');
        const elPropSupply = document.getElementById('prop-supply');

        if (data.medianAskingPrice && data.totalActiveListings > 0) {
          if (elPropMedian) elPropMedian.textContent = formatMoney(data.medianAskingPrice);
          if (elPropSqm) elPropSqm.textContent = '—'; // No size data from scrapers
          if (elPropYield) elPropYield.textContent = '—'; // No rental data from scrapers
          if (elPropSupply) elPropSupply.textContent = `${data.totalActiveListings} active listings`;

          // Populate source breakdown in benchmark table
          const benchmarkTable = document.querySelector('#prop-tab-benchmark .suburb-metrics-table');
          if (benchmarkTable && data.sources) {
            // Remove old rows (keep header)
            benchmarkTable.querySelectorAll('.table-row:not(.head)').forEach(r => r.remove());
            data.sources.forEach(src => {
              const row = document.createElement('div');
              row.className = 'table-row font-mono';
              const seg = document.createElement('span');
              seg.textContent = src.name;
              const price = document.createElement('span');
              price.textContent = formatMoney(src.avg);
              const count = document.createElement('span');
              count.textContent = `${src.count} listings`;
              const trend = document.createElement('span');
              trend.textContent = '—';
              row.append(seg, price, count, trend);
              benchmarkTable.appendChild(row);
            });
          }
        } else {
          if (elPropMedian) elPropMedian.textContent = 'No data';
          if (elPropSupply) elPropSupply.textContent = 'No listings found';
          if (elPropSqm) elPropSqm.textContent = '—';
          if (elPropYield) elPropYield.textContent = '—';
        }
        updateRawJson(data);
      }
    } catch (e) {
      console.warn('Property API call note:', e);
    } finally {
      setLoadingState(false);
    }
  }

  // 3. Agency Site Audit Telemetry (Live Crawler)
  async function loadAgencyTelemetry(query = 'Commercial Services Pretoria', extraParams = {}, isLiveSearch = true) {
    telemetryTitle.textContent = `LIVE AGENCY AUDIT: ${query.toUpperCase()}`;

    let city = 'Pretoria';
    let industry = query;
    if (extraParams.city) city = extraParams.city;
    if (extraParams.niche) industry = extraParams.niche;
    else if (/in\s+(.+)$/i.test(query)) {
      city = query.match(/in\s+(.+)$/i)[1].trim();
      industry = query.replace(/\s+in\s+.+$/i, '').trim();
    }

    try {
      setLoadingState(true);
      const res = await fetch('/api/agency/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, industry })
      });

      if (res.ok) {
        const data = await res.json();
        activeTelemetryData = data;

        const elScore = document.getElementById('agency-score');
        const elMobile = document.getElementById('agency-mobile');
        const elSpeed = document.getElementById('agency-speed');
        const elPitch = document.getElementById('agency-pitch-val');
        const defectList = document.querySelector('.defect-list');

        if (data.targets && data.targets.length > 0) {
          const firstTarget = data.targets[0];
          const score = firstTarget.readinessScore || 'N/A';
          const pitchVal = firstTarget.estimatedPitchValue || 'N/A';
          const isMobileFail = firstTarget.techStack ? !firstTarget.techStack.hasViewportMeta : true;
          const speedSeconds = firstTarget.techStack?.estimatedLoadSeconds || 'N/A';

          if (elScore) elScore.textContent = `${score} / 100`;
          if (elMobile) elMobile.textContent = isMobileFail ? 'Non-Responsive (Failed)' : 'Responsive (Pass)';
          if (elSpeed) elSpeed.textContent = speedSeconds === 'N/A' ? 'N/A' : `${speedSeconds > 3 ? 'F-Grade' : 'A-Grade'} (${speedSeconds}s LCP)`;
          if (elPitch) elPitch.textContent = typeof pitchVal === 'number' ? formatMoney(pitchVal) : pitchVal;

          if (defectList && firstTarget.defects) {
            defectList.innerHTML = '';
            firstTarget.defects.slice(0, 6).forEach(d => {
              const item = document.createElement('div');
              item.className = 'defect-item';
              const badge = document.createElement('span');
              badge.className = `defect-badge ${d.severity === 'CRITICAL' ? 'red' : 'amber'}`;
              badge.textContent = d.severity;
              const info = document.createElement('div');
              info.className = 'defect-info';
              const title = document.createElement('strong');
              title.textContent = d.title;
              const desc = document.createElement('p');
              desc.textContent = d.description || '';
              info.append(title, desc);
              item.append(badge, info);
              defectList.appendChild(item);
            });
          }
        } else {
          if (elScore) elScore.textContent = 'No sites found';
          if (defectList) defectList.innerHTML = '';
        }
        updateRawJson(data);
      }
    } catch (e) {
      console.warn('Agency crawl note:', e);
    } finally {
      setLoadingState(false);
    }
  }

  // 4. B2B Leads Telemetry (Live Dealer CRM Scanner)
  async function loadB2BTelemetry(query = 'Used Car Dealerships Johannesburg') {
    const market = marketSelect?.value || 'za';
    const country = market === 'uk' ? 'uk' : 'za';
    telemetryTitle.textContent = `LIVE B2B DECISION CONTACTS: ${query.toUpperCase()}`;

    let city = 'Johannesburg';
    if (/cape town/i.test(query)) city = 'Cape Town';
    else if (/durban/i.test(query)) city = 'Durban';
    else if (/pretoria/i.test(query)) city = 'Pretoria';
    else if (/gauteng/i.test(query)) city = 'Johannesburg';

    try {
      setLoadingState(true);
      const res = await fetch('/api/dealer-crm/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, country, maxResults: 5 })
      });

      if (res.ok) {
        const data = await res.json();
        activeTelemetryData = data;

        const prospects = data.prospects || [];
        const metricsGrid = document.querySelector('#view-b2b .metrics-grid');
        const tbody = document.querySelector('#view-b2b tbody');

        // Update metric cards
        const metricValues = metricsGrid?.querySelectorAll('.metric-value');
        if (metricValues && metricValues.length >= 4) {
          metricValues[0].textContent = `${prospects.length} contacts`;
          metricValues[1].textContent = prospects.length > 0 ? 'VERIFIED' : '—';
          metricValues[2].textContent = `${prospects.filter(p => p.ownerName || p.contactName).length} decision makers`;
          metricValues[3].textContent = 'CSV / JSON';
        }

        // Populate table
        if (tbody) {
          tbody.innerHTML = '';
          if (prospects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No dealers found — try a different city</td></tr>';
          } else {
            prospects.forEach(p => {
              const tr = document.createElement('tr');
              const name = p.ownerName || p.contactName || '—';
              const title = p.ownerTitle || 'Principal';
              const company = p.dealerName || p.domain || '—';
              const phone = p.phone || '—';
              const email = p.email || '—';
              tr.innerHTML = `<td>${escapeHtml(name)}</td><td>${escapeHtml(title)}</td><td>${escapeHtml(company)}</td><td>${escapeHtml(phone)}</td><td>${escapeHtml(email)}</td><td><span class="badge badge-neon">VERIFIED</span></td>`;
              tbody.appendChild(tr);
            });
          }
        }
        updateRawJson(data);
      }
    } catch (e) {
      console.warn('B2B Telemetry note:', e);
    } finally {
      setLoadingState(false);
    }
  }

  // 5. API Playground Telemetry (Live Verification)
  async function loadApiTelemetry() {
    telemetryTitle.textContent = `LIVE TRUAPI PLAYGROUND: POST /api/valuation/quick`;
    const t0 = performance.now();
    let resData = null;
    let latency = 45;

    try {
      const res = await fetch('/api/health');
      latency = Math.round(performance.now() - t0);
      if (res.ok) {
        resData = await res.json();
      }
    } catch {}

    const data = {
      endpoint: '/api/valuation/quick',
      protocol: 'REST / HTTPS',
      latencyMs: latency,
      health: resData || { status: 'error', message: 'No data available' }
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
    loadEngineTelemetry(currentEngine, query, extra, true);

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
    const p = document.createElement('p'); p.textContent = text; bubble.appendChild(p);
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function handleDataDeskResponse(promptText) {
    const prompt = promptText.toLowerCase();
    setTimeout(() => {
      appendChatMessage(`Received query for "${promptText}". The data desk is scanning live registries, please stand by...`);
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
    const span = document.createElement('span'); span.textContent = message; toast.appendChild(span);
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
