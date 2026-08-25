import React from 'react';
import { 
  Car, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  Trash2, Cloud, Sparkles, FolderOpen, Image as ImageIcon, ArrowRight, Download,
  BarChart3, Palette, Copy, Check, Award, Lightbulb, BookOpen, Sliders, ExternalLink,
  FileText, Settings, Camera, LogOut, ScanLine, Loader2, Pencil, X, ChevronDown, HelpCircle, MessageCircle, Shield, History, TrendingUp } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Vehicle, DmsExportResult } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { computeWebReadiness, isStructurallyWebReady } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';
import DiscScanner from './DiscScanner';
import VehiclePicker, { VehiclePickerValue } from './VehiclePicker';
import type { DiscScan } from '../lib/saDisc';
import { Imagin8GatedButton, Imagin8Bundles, ZERO_BUNDLES } from './imagin8-gating';
import { SetupChecklistCard } from './SetupPrompt';

interface InventoryListProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onViewReport?: (vehicle: Vehicle) => void;
  onAddVehicle: (newVehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>, initialPhotos?: Record<string, string>) => void;
  onDeleteVehicle: (id: string) => void;
  onExportToDms?: (vehicle: Vehicle) => Promise<DmsExportResult>;
  onUpdateVehicle?: (vehicle: Vehicle, patch: Partial<Vehicle>) => Promise<Vehicle | null>;
  syncStatus: 'synced' | 'syncing' | 'error';
  onForceSync: () => void;
  onOpenGuide?: () => void;
  onOpenDealerAssist?: () => void;
  /** First-run dealership setup checklist, fetched by App via the TruFlow
   *  bridge. Rendered as a quiet card at the top of the Dashboard tab while
   *  required items are missing. */
  setupStatus?: import('../lib/setupStatus').SetupStatus | null;
  /** Hides the setup card for a week (per-device snooze owned by App). */
  onSetupSnooze?: () => void;
}

// The DMS target is fixed for every device and controlled server-side
// (TRUFLOW_DMS_URL). Phones no longer carry their own base URL — a stale
// localhost left in one phone's storage used to break its exports silently.
// This constant is only used to open the DMS in a browser tab from the header,
// and to show the dealer where their stock lands. It read lens.tru-saas.com —
// TruLens's own address — so "Open TruFlow DMS" reopened TruLens, and Settings
// told the dealer their cars went to the wrong place. flow. is canonical.
const DMS_URL = 'https://flow.tru-saas.com';

export default function InventoryList({
  vehicles,
  onSelectVehicle,
  onViewReport,
  onAddVehicle,
  onDeleteVehicle,
  onExportToDms,
  onUpdateVehicle,
  syncStatus,
  onForceSync,
  onOpenGuide,
  onOpenDealerAssist,
  setupStatus,
  onSetupSnooze
}: InventoryListProps) {
  const { signOut, user, isDemo } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [guideSeen, setGuideSeen] = React.useState(() => !!localStorage.getItem('trulens_guide_seen'));
  const [searchTerm, setSearchTerm] = React.useState('');
  /** Stock # from Flow deep-link (?stock=) — highlight + search */
  const [highlightStock, setHighlightStock] = React.useState<string | null>(null);
  const [deepLinkBanner, setDeepLinkBanner] = React.useState<string | null>(null);
  const [copiedStockId, setCopiedStockId] = React.useState<string | null>(null);
  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [activeFilter, setActiveFilter] = React.useState<'All' | 'In-Progress' | 'Ready' | 'Listed'>('All');
  /** Extra filter: web readiness for floor managers */
  const [readinessFilter, setReadinessFilter] = React.useState<'ALL' | 'NEEDS' | 'READY'>('ALL');
  const [showAddForm, setShowAddForm] = React.useState(false);
  /* Progressive disclosure for the add/edit form: the three (now four) fields
     someone types at the car stay visible; the rest sit behind this toggle.
     The field values live in component state, not the inputs, so collapsing the
     block never loses what was typed. */
  const [showAllFields, setShowAllFields] = React.useState(false);
  const [editingVehicle, setEditingVehicle] = React.useState<Vehicle | null>(null);
  const [currentTab, setCurrentTab] = React.useState<'catalog' | 'dashboard' | 'settings'>('catalog');
  const [exportingId, setExportingId] = React.useState<string | null>(null);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);
  const [exportToast, setExportToast] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  };

  // Flow → TruLens deep-link: /?stock=STK-123
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const stock = (params.get('stock') || params.get('stk') || '').trim();
      if (!stock) return;
      setSearchTerm(stock);
      setHighlightStock(stock);
      setDeepLinkBanner(stock);
      setCurrentTab('catalog');
      setActiveFilter('All');
      setReadinessFilter('ALL');
      // Clean URL after read so refresh doesn't re-flash forever
      const url = new URL(window.location.href);
      url.searchParams.delete('stock');
      url.searchParams.delete('stk');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
  }, []);

  // Scroll highlighted unit into view once inventory is present
  React.useEffect(() => {
    if (!highlightStock || !vehicles.length) return;
    const match = vehicles.find(
      (v) => (v.stockNumber || '').toLowerCase() === highlightStock.toLowerCase()
    );
    if (!match) {
      setDeepLinkBanner(`${highlightStock} · not in this catalogue yet — add or sync from DMS`);
      return;
    }
    const el = cardRefs.current[match.id];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    const t = window.setTimeout(() => setHighlightStock(null), 8000);
    return () => window.clearTimeout(t);
  }, [highlightStock, vehicles]);

  /* The cursor-tracking card glow (.tl-card-lift) is retired — depth lives on
     the controls now, not the cards — so the pointermove listener that drove it
     is gone with it. */

  /**
   * What the yard should do next, derived from the actual fleet.
   *
   * This replaced a hardcoded line claiming vehicles with 360 walkarounds
   * "sell 18% faster on average" — a figure with no source, in an app that
   * holds no sales data, shown to a dealer who would repeat it to a customer.
   * Everything below is computed from photos actually captured.
   */
  const fleet = React.useMemo(() => {
    const rows = vehicles.map(v => ({ v, r: computeWebReadiness(v) }));
    // Listing-readiness is the 10-shot CORE set now. Every slot is optional, so
    // the old missingRequired[] was always empty and read every car as "done".
    const shortOfPublish = rows
      .filter(({ r }) => !r.listingReady)
      .sort((a, b) => a.r.missingCore.length - b.r.missingCore.length);
    const readyToExport = rows.filter(({ v, r }) => r.listingReady && !v.lastDmsExportAt);
    const done = rows.filter(({ r }) => r.listingReady).length;
    return { rows, shortOfPublish, readyToExport, done, total: rows.length };
  }, [vehicles]);

  /** One sentence, the most useful thing true right now. */
  const nextAction = React.useMemo(() => {
    if (fleet.total === 0) {
      return { head: 'No vehicles yet', body: 'Add one to start capturing.' };
    }
    if (fleet.shortOfPublish.length > 0) {
      const nearest = fleet.shortOfPublish[0];
      const missing = nearest.r.missingCore;
      const name = `${nearest.v.year} ${nearest.v.make} ${nearest.v.model}`.trim();
      return {
        head: `${fleet.shortOfPublish.length} ${fleet.shortOfPublish.length === 1 ? 'vehicle is' : 'vehicles are'} short of publishing`,
        body: `Closest: ${name} — ${missing.length === 1 ? missing[0] : `${missing.length} shots, starting with ${missing[0]}`}.`,
      };
    }
    if (fleet.readyToExport.length > 0) {
      return {
        head: `${fleet.readyToExport.length} ready to send to TruFlow`,
        body: 'Every core shot is captured. Export to publish them.',
      };
    }
    return { head: 'Everything captured', body: `All ${fleet.total} vehicles are listing-ready.` };
  }, [fleet]);

  // Settings state (persisted for VIR / share branding)
  const [dealershipName, setDealershipName] = React.useState(
    () => localStorage.getItem('trulens_dealer_name') || ''
  );
  const [branch, setBranch] = React.useState(
    () => localStorage.getItem('trulens_dealer_branch') || ''
  );
  /** Which dealership newly-exported vehicles get tagged to in the DMS —
      must match a slug the DMS's public website feed knows how to isolate.
      A phone used on Caledon's floor should be set to "cars-on-caledon" so
      captures never default to (and leak onto) MKR's site. */
  /* Read-only now: the access code sets this, not the phone. Demo sessions
     always read as "demo" — a slug left in localStorage by a previous real
     sign-in on this browser must never show (or read) as the export target. */
  const dealerSlug = isDemo ? 'demo' : localStorage.getItem('trulens_dealer_slug') || '';
  /** True when the access code itself carried the dealership, in which case the
      server enforces it and nothing on this phone can override it. */
  const dealerPinned = localStorage.getItem('trulens_dealer_pinned') === '1';
  /** Name for the current slug. Starts from the list the picker cached, then
      asks the server if that misses — a phone pinned by a per-dealership code
      never runs the picker, so the cache may not be warm yet and this rendered
      the raw slug where the dealer's name belongs. State, not useMemo: the
      cache is written asynchronously and a memo keyed on the slug would never
      recompute when it landed. */
  const nameFromCache = React.useCallback((slug: string): string => {
    try {
      const cached = JSON.parse(localStorage.getItem('trulens_dealerships_v1') || '[]');
      const hit = Array.isArray(cached) ? cached.find((d: any) => d?.slug === slug) : null;
      return hit?.name || '';
    } catch {
      return '';
    }
  }, []);

  const [dealerDisplayName, setDealerDisplayName] = React.useState(
    () => nameFromCache(dealerSlug) || dealerSlug || ''
  );

  React.useEffect(() => {
    if (!dealerSlug) return;
    const cached = nameFromCache(dealerSlug);
    if (cached) {
      setDealerDisplayName(cached);
      return;
    }
    let cancelled = false;
    fetch('/api/dealerships', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        localStorage.setItem('trulens_dealerships_v1', JSON.stringify(list));
        const hit = list.find((d: any) => d?.slug === dealerSlug);
        if (hit?.name) setDealerDisplayName(hit.name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dealerSlug, nameFromCache]);
  const [dealerWhatsApp, setDealerWhatsApp] = React.useState(
    () => localStorage.getItem('trulens_dealer_wa') || ''
  );
  const [currency, setCurrency] = React.useState(
    () => localStorage.getItem('trulens_currency') || 'ZAR'
  );
  const [aiThreshold, setAiThreshold] = React.useState(() => {
    const n = Number(localStorage.getItem('trulens_ai_threshold'));
    return Number.isFinite(n) && n >= 50 ? n : 85;
  });
  // Clear any per-device DMS URL a phone still has from the old settings —
  // it's now server-controlled, and a leftover localhost would be ignored but
  // is best not lingering in storage.
  React.useEffect(() => {
    if (localStorage.getItem('trulens_dms_url')) {
      localStorage.removeItem('trulens_dms_url');
    }
  }, []);
  const [make, setMake] = React.useState('');
  const [model, setModel] = React.useState('');
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [trim, setTrim] = React.useState('');
  const [mmCode, setMmCode] = React.useState('');
  const [vin, setVin] = React.useState('');
  const [stockNumber, setStockNumber] = React.useState('');
  const [color, setColor] = React.useState('');
  const [price, setPrice] = React.useState(24995);
  const [vehicleType, setVehicleType] = React.useState('SUV');
  /* Shown on every dealer website card. Mileage starts empty rather than 0 so
     the field reads as "not filled in" instead of a car with no kilometres. */
  const [mileage, setMileage] = React.useState('');
  const [transmission, setTransmission] = React.useState<'Automatic' | 'Manual'>('Manual');
  const [fuelType, setFuelType] = React.useState<'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'>('Petrol');
  const [status, setStatus] = React.useState<'In-Progress' | 'Ready'>('In-Progress');
  const [optionalExtras, setOptionalExtras] = React.useState<string[]>([]);
  const [extrasOpen, setExtrasOpen] = React.useState(false);
  const [scanningDisc, setScanningDisc] = React.useState(false);
  const [scanNote, setScanNote] = React.useState<string | null>(null);

  // Live market valuation at the pricing step. Typed locally on purpose — the
  // scraper module is server-only (imports fs/path), so it must never be
  // imported into this browser component.
  const [valuation, setValuation] = React.useState<
    { averageRetailPrice: number | null; listingsFound: number; mileageAdjusted?: boolean; sampleMedianKm?: number | null } | null
  >(null);
  const [valuationLoading, setValuationLoading] = React.useState(false);
  const runValuation = React.useCallback(async () => {
    if (!make.trim() || !model.trim() || !user) return;
    setValuationLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ make: make.trim(), model: model.trim(), year, mileage, vin }),
      });
      setValuation(res.ok ? await res.json() : { averageRetailPrice: null, listingsFound: 0 });
    } catch {
      setValuation({ averageRetailPrice: null, listingsFound: 0 });
    } finally {
      setValuationLoading(false);
    }
  }, [make, model, year, mileage, vin, user]);

  // Imagin8 bundle gating
  const [imagin8Bundles, setImagin8Bundles] = React.useState<Imagin8Bundles>(ZERO_BUNDLES);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await user?.getIdToken();
        const res = await fetch('/api/imagin8/bundles', {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok && alive) {
          const data = await res.json();
          setImagin8Bundles(data);
        }
      } catch {
        // default to ZERO_BUNDLES
      }
    })();
    return () => { alive = false; };
  }, [user]);

  // Imagin8 data lookups — reg check & accident report (shown in Add Vehicle flow)
  const [regCheckResult, setRegCheckResult] = React.useState<any>(null);
  const [regCheckLoading, setRegCheckLoading] = React.useState(false);
  const runRegCheck = React.useCallback(async () => {
    let id = vin.trim() || stockNumber.trim();
    if (!id) {
      if (!isDemo) {
        setRegCheckResult({ error: 'Enter a VIN or stock # first — the check runs against that identifier.' });
        return;
      }
      id = ('DEMO-' + (make || 'car') + '-' + (model || 'x') + '-' + year)
        .toUpperCase().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'DEMO-CAR';
    }
    if (!user) return;
    setRegCheckLoading(true);
    setRegCheckResult(null);
    try {
      const token = await user.getIdToken();
      const qs = new URLSearchParams({ identifier: id, type: 'vin' }).toString();
      const res = await fetch(`/api/imagin8/regcheck?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setRegCheckResult(res.ok ? data : { error: data.error || `Check failed (${res.status})` });
    } catch (e: any) {
      setRegCheckResult({ error: e?.message || 'Check failed' });
    } finally {
      setRegCheckLoading(false);
    }
  }, [vin, stockNumber, user, isDemo, make, model, year]);

  const [accidentResult, setAccidentResult] = React.useState<any>(null);
  const [accidentLoading, setAccidentLoading] = React.useState(false);
  const runAccidentReport = React.useCallback(async () => {
    let id = vin.trim();
    if (!id) {
      if (!isDemo) {
        setAccidentResult({ error: 'Enter a VIN first — the report runs against that VIN.' });
        return;
      }
      id = ('DEMO-' + (make || 'car') + '-' + (model || 'x') + '-' + year)
        .toUpperCase().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'DEMO-CAR';
    }
    if (!user) return;
    setAccidentLoading(true);
    setAccidentResult(null);
    try {
      const token = await user.getIdToken();
      const qs = new URLSearchParams({ vin: id }).toString();
      const res = await fetch(`/api/imagin8/accident-report?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setAccidentResult(res.ok ? data : { error: data.error || `Report failed (${res.status})` });
    } catch (e: any) {
      setAccidentResult({ error: e?.message || 'Report failed' });
    } finally {
      setAccidentLoading(false);
    }
  }, [vin, user, isDemo, make, model, year]);

  // TransUnion price (bundle-gated) — needs an M&M code in production, but in
  // demo the simulated responder accepts any seed so we synthesise one from the
  // form itself. Result renders in the Add Vehicle flow.
  const fmtZAR = (n: number | null | undefined) =>
    n == null ? '—' : 'R ' + Math.round(n).toLocaleString('en-ZA');
  const [tuPriceResult, setTuPriceResult] = React.useState<any>(null);
  const [tuPriceLoading, setTuPriceLoading] = React.useState(false);
  const runTuPrice = React.useCallback(async () => {
    const yearNum = Number(year);
    if (!yearNum || (!mmCode.trim() && !isDemo)) {
      setTuPriceResult({ error: 'Enter an M&M code (or pick model/variant) for a TransUnion price.' });
      return;
    }
    const mm = mmCode.trim() || ('DEMO-' + (make || 'car') + '-' + (model || 'x') + '-' + year)
      .toUpperCase().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'DEMO-CAR';
    setTuPriceLoading(true);
    setTuPriceResult(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/imagin8/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mmCode: mm, year: yearNum, mileage: mileage ? Number(mileage) : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setTuPriceResult(res.ok ? data : { error: data.error || `Price failed (${res.status})` });
    } catch (e: any) {
      setTuPriceResult({ error: e?.message || 'Price failed' });
    } finally { setTuPriceLoading(false); }
  }, [year, mmCode, isDemo, make, model, mileage, user]);


  // Fill the form from a scanned licence disc — everything stays editable.
  const [discPhoto, setDiscPhoto] = React.useState<string | null>(null);

  const applyDiscScan = (d: DiscScan, photo?: string) => {
    setScanningDisc(false);
    if (photo) setDiscPhoto(photo);
    const titleCase = (v) => v.toLowerCase().split(' ').map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    if (d.make) setMake(titleCase(d.make));
    if (d.model) setModel(titleCase(d.model));
    if (d.colour) setColor(titleCase(d.colour));
    if (d.vin) setVin(d.vin);
    if (d.year) setYear(d.year);
    const got = ['make','model','vin','year'].filter((k) => (d as any)[k]).length;
    setScanNote(
      got === 0
        ? "Couldn't read that disc — try again, or type the details in."
        : `Filled ${got} field${got > 1 ? 's' : ''} from the disc — check and adjust.`,
    );
    setTimeout(() => setScanNote(null), 5000);
  };

  const startEditing = (v: Vehicle) => {
    setEditingVehicle(v);
    setMake(v.make);
    setModel(v.model);
    setYear(v.year);
    setTrim(v.trim || '');
    setVin(v.vin || '');
    setStockNumber(v.stockNumber || '');
    setColor(v.color || '');
    setPrice(v.price || 24995);
    setVehicleType(v.vehicleType || 'SUV');
    setMileage(v.mileage != null ? String(v.mileage) : '');
    setTransmission(v.transmission || 'Manual');
    setFuelType(v.fuelType || 'Petrol');
    setStatus(v.status === 'Listed' ? 'Ready' : v.status);
    setOptionalExtras(v.optionalExtras || []);
    setExtrasOpen(false);
    setShowAddForm(true);
  };

  /* Add Vehicle auto-fill: an M&M code resolves the full factory spec via
     Imagin8 Static Info (flat unlimited subscription, so free to run). */
  const [staticLoading, setStaticLoading] = React.useState(false);
  const [staticNote, setStaticNote] = React.useState<string | null>(null);

  const lookupStaticInfo = async (code: string) => {
    const mm = code.trim();
    if (!mm || !user) return;
    setStaticLoading(true);
    setStaticNote(null);
    try {
      const token = await user.getIdToken();
      const qs = new URLSearchParams({ mmCode: mm }).toString();
      const res = await fetch(`/api/imagin8/static?${qs}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'lookup failed');
      const s = await res.json();
      const titleCase = (v: string) =>
        v.toLowerCase().split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
      const filled: string[] = [];
      if (s.make) { setMake(titleCase(s.make)); filled.push('make'); }
      if (s.model) { setModel(titleCase(s.model)); filled.push('model'); }
      const fuelMap: Record<string, 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'> =
        { P: 'Petrol', D: 'Diesel', H: 'Hybrid', E: 'Electric' };
      if (s.fuelType && fuelMap[s.fuelType]) { setFuelType(fuelMap[s.fuelType]); filled.push('fuel'); }
      setStaticNote(
        filled.length
          ? `Filled ${filled.join(', ')} from the M&M code — check and adjust.`
          : "That M&M code didn't return specs — enter details by hand.",
      );
      setTimeout(() => setStaticNote(null), 5000);
    } catch (err: any) {
      setStaticNote(err?.message || 'Spec lookup failed — enter details by hand.');
      setTimeout(() => setStaticNote(null), 5000);
    } finally {
      setStaticLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    /* Mileage is required alongside make/model. It could have been optional and
       carried through as "unknown", but that means three systems each deciding
       how to render a missing number, and the DMS schema has mileage as a
       plain number with no null. The odometer is in front of whoever is
       standing at the car, so ask once here and the rest of the chain can
       trust it. */
    if (!make || !model || !mileage.trim()) return;

    if (editingVehicle && onUpdateVehicle) {
      onUpdateVehicle(editingVehicle, {
        make,
        model,
        year: Number(year),
        trim,
        mmCode: mmCode || undefined,
        vin: vin.trim(),
        stockNumber: stockNumber.trim(),
        color: color.trim(),
        price: Number(price),
        vehicleType,
        mileage: Number(mileage),
        transmission,
        fuelType,
        status,
        optionalExtras,
      });
    } else {
      onAddVehicle({
        make,
        model,
        year: Number(year),
        trim,
        mmCode: mmCode || undefined,
        vin: vin.trim(),
        stockNumber: stockNumber.trim(),
        color: color.trim(),
        price: Number(price),
        vehicleType,
        mileage: Number(mileage),
        transmission,
        fuelType,
        status,
        optionalExtras,
      }, discPhoto ? { license_disc: discPhoto } : undefined);
    }

    // Reset form
    setDiscPhoto(null);
    setEditingVehicle(null);
    setMake('');
    setModel('');
    setYear(new Date().getFullYear());
    setTrim('');
    setMmCode('');
    setVin('');
    setStockNumber('');
    setColor('');
    setPrice(24995);
    setVehicleType('SUV');
    setMileage('');
    setTransmission('Manual');
    setFuelType('Petrol');
    setStatus('In-Progress');
    setOptionalExtras([]);
    setExtrasOpen(false);

    setShowAddForm(false);
  };

  // Filter and search logic
  const filteredVehicles = vehicles.filter(v => {
    const make = (v.make || '').toLowerCase();
    const model = (v.model || '').toLowerCase();
    const vin = (v.vin || '').toLowerCase();
    const stock = (v.stockNumber || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      make.includes(q) || model.includes(q) || vin.includes(q) || stock.includes(q);
    if (!matchesSearch) return false;
    if (activeFilter !== 'All' && v.status !== activeFilter) return false;
    if (readinessFilter !== 'ALL') {
      const r = computeWebReadiness(v);
      if (readinessFilter === 'NEEDS' && (r.level === 'ready' || r.level === 'web-ready' || r.level === 'listed')) {
        return false;
      }
      if (readinessFilter === 'READY' && r.level === 'capture') return false;
    }
    return true;
  });

  const copyStockNumber = async (stock: string, id: string) => {
    try {
      await navigator.clipboard.writeText(stock);
      setCopiedStockId(id);
      window.setTimeout(() => setCopiedStockId((cur) => (cur === id ? null : cur)), 1600);
    } catch {
      /* ignore */
    }
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw size={15} className="animate-spin text-amber-400" />;
      case 'error':
        return <AlertCircle size={15} className="text-red-400" />;
      default:
        return <Cloud size={15} className="text-emerald-400 animate-pulse" />;
    }
  };

  const handleExportClick = async (e: React.MouseEvent, vehicle: Vehicle) => {
    e.stopPropagation();
    if (!onExportToDms) {
      setExportToast({ type: 'err', text: 'Export handler not available' });
      return;
    }
    const takenCount = Object.keys(vehicle.photos || {}).length;
    if (takenCount === 0) {
      setExportToast({ type: 'err', text: 'No photos to export' });
      return;
    }

    setExportingId(vehicle.id);
    setExportToast(null);
    try {
      const result = await onExportToDms(vehicle);
      if (result.success) {
        const b = result.breakdown;
        /* TruOrbit (the Web3D spin) is called out on its own — its ABSENCE
           is stated rather than left blank. Every other entry here is
           omitted when zero, which is right for photo categories, but a
           missing 360 is the one thing worth saying out loud. Reads
           result.truOrbit (set by handleExportToDms after awaiting the
           Web3D autoexport). The old breakdown.walkaround check was for
           the retired video-slot field, which never populates — so the
           toast always said "no TruOrbit" regardless of actual state. */
        const parts = b
          ? [
              b.mainImages ? `${b.mainImages} main` : null,
              b.extras ? `${b.extras} extras` : null,
              b.damage ? `${b.damage} damage` : null,
              b.vin ? `${b.vin} VIN` : null,
              b.serviceBook ? `${b.serviceBook} service` : null,
              result.truOrbit ? 'TruOrbit ✓' : 'no TruOrbit',
            ].filter(Boolean).join(', ')
          : `${takenCount} photos`;
        setExportToast({
          type: 'ok',
          text: result.created
            ? `Created in DMS + exported (${parts})`
            : `Exported to TruFlow DMS (${parts})`,
        });
      } else {
        setExportToast({
          type: 'err',
          text: result.error || result.message || 'DMS export failed',
        });
      }
    } catch (err) {
      setExportToast({
        type: 'err',
        text: err instanceof Error ? err.message : 'Export failed',
      });
    } finally {
      setExportingId(null);
      setTimeout(() => setExportToast(null), 6000);
    }
  };

  return (
    <div id="inventory-list-container" className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      
      {/* App header — the .tl-appbar is retired (62px of chrome that said what
          one line of type says better: whose stock this is, how much is left).
          A plain page title, a count, and three quiet ghost actions. */}
      <div className="px-4 pt-4 pb-1 flex items-start justify-between gap-3 shrink-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <img src="/icons/icon-192.png" alt="" className="h-7 w-7 rounded-[7px] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold text-[#E8EAE6] truncate leading-tight">{dealershipName}</h1>
            <p className="text-[13px] text-neutral-400 leading-tight truncate mt-0.5">
              {fleet.total === 0
                ? 'No vehicles yet'
                : fleet.shortOfPublish.length > 0
                  ? `${fleet.done}/${fleet.total} complete · ${fleet.shortOfPublish.length} need photos`
                  : `${fleet.done}/${fleet.total} complete`}
            </p>
          </div>
        </div>
        {/* Three quiet ghosts — no borders, no boxes, no three-decisions read.
            Sync keeps its colour because that one is state, not decoration. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenDealerAssist && (
            <button
              onClick={onOpenDealerAssist}
              className="flex items-center justify-center h-10 w-10 rounded-[10px] text-[#4FE3DC]/60 hover:text-[#4FE3DC] hover:bg-[rgba(79,227,220,0.06)] transition-colors cursor-pointer"
              aria-label="Dealer Assist"
              title="Dealer Assist"
            >
              <MessageCircle size={18} />
            </button>
          )}
          {onOpenGuide && (
            <button
              onClick={() => { onOpenGuide(); if (!guideSeen) { setGuideSeen(true); localStorage.setItem('trulens_guide_seen', '1'); } }}
              className="relative flex items-center justify-center h-10 w-10 rounded-[10px] text-[rgba(232,234,230,0.55)] hover:text-[#E8EAE6] hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="How do I…?"
              title="How do I…?"
            >
              <HelpCircle size={18} />
              {!guideSeen && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4FE3DC]" />}
            </button>
          )}
          <button
            onClick={() => window.open(DMS_URL, '_blank')}
            className="flex items-center justify-center h-10 w-10 rounded-[10px] text-[rgba(232,234,230,0.55)] hover:text-[#E8EAE6] hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label={`Open TruFlow DMS (${DMS_URL})`}
            title={`Open TruFlow DMS (${DMS_URL})`}
          >
            <ExternalLink size={18} />
          </button>
          <button
            onClick={onForceSync}
            className="flex items-center justify-center h-10 w-10 rounded-[10px] hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label={
              syncStatus === 'syncing' ? 'Syncing now'
                : syncStatus === 'error' ? 'Last sync failed — tap to retry'
                : 'Refresh from the server'
            }
            title={
              syncStatus === 'syncing' ? 'Syncing now'
                : syncStatus === 'error' ? 'Last sync failed — tap to retry'
                : 'Refresh from the server'
            }
          >
            {getSyncIcon()}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center h-10 w-10 rounded-[10px] text-[rgba(232,234,230,0.55)] hover:text-[#E8EAE6] hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
            aria-label={user?.email ? `Sign out (${user.email})` : 'Sign out'}
            title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
          >
            {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={18} />}
          </button>
        </div>
      </div>

      {/* The tab switcher used to sit here and the three-up stat grid under it.
          Between them they took 162px off the top of a 844px phone, and on a
          360x640 Android — which is most of the yard — 73% of the screen was
          chrome before the first vehicle appeared.

          The stats are gone: Total / Shooting / Ready restated what the header
          line above already says, in bigger boxes. The tabs moved to the bottom
          of the screen, where the thumb of the hand holding the phone actually
          reaches. See the nav below the scroll area. */}

      {/* Main Panel Content */}
      <div id="inventory-scroll-container" className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {currentTab === 'catalog' ? (
          <>
            {/* Search & Add New Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
            <input
              type="text"
              placeholder="Search VIN, stock, make…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 bg-[rgba(232,234,230,0.04)] text-[15px] text-neutral-200 pl-10 pr-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] focus:border-[#4FE3DC] outline-none placeholder-neutral-500 font-mono transition-colors"
            />
          </div>
          <button
            onClick={() => { setEditingVehicle(null); setShowAddForm(!showAddForm); }}
            className="bg-tru-cyan on-fill h-11 w-11 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Add vehicle"
          >
            <Plus size={18} />
          </button>
        </div>

        {scanningDisc && (
          <DiscScanner onResult={applyDiscScan} onClose={() => setScanningDisc(false)} />
        )}

        {/* Add vehicle Form Box */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-4 shadow-xl animate-in fade-in duration-200">
            {/* Header — a real title, a one-line subtitle, and a ghost close. */}
            <div className="flex items-start justify-between border-b border-neutral-850 pb-3">
              <div>
                <h3 className="text-[20px] font-semibold text-[#E8EAE6] leading-tight">
                  {editingVehicle ? 'Edit vehicle' : 'New vehicle'}
                </h3>
                <p className="text-[13px] text-[rgba(232,234,230,0.55)] mt-0.5">
                  {editingVehicle ? 'Update this stock unit’s details.' : 'Scan the licence disc, or enter the basics by hand.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingVehicle(null); }}
                className="tru-btn-ghost h-9 w-9 flex items-center justify-center shrink-0 cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scan is the primary: it fills nine fields from one photo. */}
            <button
              type="button"
              onClick={() => setScanningDisc(true)}
              className="btn-primary on-fill w-full min-h-[52px] flex items-center justify-center gap-2 text-[16px] cursor-pointer"
            >
              <ScanLine size={18} /> Scan licence disc
            </button>

            {scanNote && (
              <p className="text-[13px] text-[rgba(232,234,230,0.72)]">{scanNote}</p>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-[12px] text-neutral-500">or enter by hand</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            <div className="space-y-3">
              <VehiclePicker
                theme="lens"
                getToken={() => user.getIdToken()}
                initial={editingVehicle ? { make: editingVehicle.make, model: editingVehicle.model, year: editingVehicle.year, variant: editingVehicle.trim } : undefined}
                onSelect={(v: VehiclePickerValue) => {
                  setMake(v.make);
                  setModel(v.model);
                  setYear(v.year);
                  setTrim(v.variant);
                  setMmCode(v.mmCode);
                }}
              />
              <div>
                <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Mileage (km)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="e.g. 78400"
                  className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] outline-none focus:border-[#4FE3DC] transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Price (R)</label>
                <input
                  type="number"
                  placeholder="35000"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] outline-none focus:border-[#4FE3DC] transition-colors font-mono"
                />
              </div>
            </div>

            {/* Live market valuation — price the car against the real market
                (scraped competitor stock + classifieds, km-adjusted). Manual
                button so it only fires when the dealer wants it. */}
            <div className="mt-1">
              <button
                type="button"
                onClick={runValuation}
                disabled={valuationLoading || !make.trim() || !model.trim()}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] px-3.5 py-2 rounded-xl bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] text-emerald-400 text-[13px] font-medium hover:bg-[color:var(--cyan)]/15 hover:border-[color:var(--cyan)] active:translate-y-[1px] transition-all disabled:opacity-40 cursor-pointer select-none"
              >
                {valuationLoading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                <span className="truncate">{valuationLoading ? 'Checking the market…' : 'Get market value'}</span>
                <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[color:var(--cyan-faint)] text-emerald-400 shrink-0">Free</span>
              </button>
              {valuation && (
                <div className="mt-2 rounded-[12px] border border-[rgba(79,227,220,0.3)] bg-[rgba(79,227,220,0.06)] p-3 text-[13px] text-[#E8EAE6]">
                  {valuation.averageRetailPrice != null ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[rgba(232,234,230,0.72)]">Market average</span>
                        <span className="font-mono font-semibold text-[#4FE3DC]">
                          R {valuation.averageRetailPrice.toLocaleString('en-ZA')}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[rgba(232,234,230,0.6)]">
                        <span>
                          {valuation.listingsFound} listing{valuation.listingsFound === 1 ? '' : 's'}
                          {valuation.mileageAdjusted ? ' · km-adjusted' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPrice(valuation.averageRetailPrice as number)}
                          className="text-[#4FE3DC] underline cursor-pointer"
                        >
                          Use as price
                        </button>
                      </div>
                      {valuation.sampleMedianKm != null && (
                        <div className="mt-1 text-[rgba(232,234,230,0.5)]">
                          Market median: {valuation.sampleMedianKm.toLocaleString('en-ZA')} km
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[rgba(232,234,230,0.6)]">No market data yet — price manually.</span>
                  )}
                </div>
              )}
            </div>

             {/* Imagin8 lookups — TransUnion price + reg check + accident report */}
            <div className="grid grid-cols-2 gap-2">
              <Imagin8GatedButton
                feature="valuation"
                bundles={imagin8Bundles}
                onClick={runTuPrice}
                onUnlock={() => alert('TransUnion valuations are bundle-gated. Contact your TruSaaS account manager to activate live pricing for this dealership.')}
                className="w-full col-span-2"
                label="TransUnion price"
                icon={tuPriceLoading ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
              />
              <Imagin8GatedButton
                feature="regCheck"
                bundles={imagin8Bundles}
                onClick={runRegCheck}
                onUnlock={() => alert('Registration checks are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion verification for this dealership.')}
                className="w-full"
                icon={regCheckLoading ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
              />
              <Imagin8GatedButton
                feature="accidentReport"
                bundles={imagin8Bundles}
                onClick={runAccidentReport}
                onUnlock={() => alert('Accident reports are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion claims history for this dealership.')}
                className="w-full"
                icon={accidentLoading ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
              />
            </div>
            {tuPriceResult && (
              <div className="rounded-[12px] border border-[rgba(79,227,220,0.2)] bg-[rgba(79,227,220,0.04)] p-3 text-[12px] text-[#E8EAE6]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[rgba(232,234,230,0.72)]">TransUnion price</span>
                  {tuPriceResult.error ? (
                    <span className="text-amber-400 font-semibold">{tuPriceResult.error}</span>
                  ) : (
                    <span className="font-semibold text-[#4FE3DC]">
                      Retail {fmtZAR(tuPriceResult.retailPrice)} · Trade {fmtZAR(tuPriceResult.tradePrice)}
                    </span>
                  )}
                </div>
                {!tuPriceResult.error && tuPriceResult.marketValue != null && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[rgba(232,234,230,0.72)]">Market estimate</span>
                    <span>{fmtZAR(tuPriceResult.marketValue)}</span>
                  </div>
                )}
              </div>
            )}
            {regCheckResult && (
              <div className="rounded-[12px] border border-[rgba(79,227,220,0.2)] bg-[rgba(79,227,220,0.04)] p-3 text-[12px] text-[#E8EAE6]">
                <div className="flex items-center justify-between">
                  <span className="text-[rgba(232,234,230,0.72)]">Reg check</span>
                  {regCheckResult.error ? (
                    <span className="text-amber-400 font-semibold">{regCheckResult.error}</span>
                  ) : (
                    <span className={regCheckResult.stolen || regCheckResult.financePending ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                      {regCheckResult.stolen ? 'Stolen' : regCheckResult.financePending ? 'Finance pending' : 'Clear'}
                    </span>
                  )}
                </div>
              </div>
            )}
            {accidentResult && (
              <div className="rounded-[12px] border border-[rgba(79,227,220,0.2)] bg-[rgba(79,227,220,0.04)] p-3 text-[12px] text-[#E8EAE6]">
                <div className="flex items-center justify-between">
                  <span className="text-[rgba(232,234,230,0.72)]">Accident history</span>
                  {accidentResult.error ? (
                    <span className="text-amber-400 font-semibold">{accidentResult.error}</span>
                  ) : (
                    <span className={accidentResult.claims?.length > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                      {accidentResult.claims?.length > 0 ? `${accidentResult.claims.length} claim(s)` : 'No claims'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Everything else behind one disclosure. Values live in component
                state, so collapsing this never loses what was typed, and the
                submit payload is unchanged. */}
            <button
              type="button"
              onClick={() => setShowAllFields((v) => !v)}
              className="tru-btn-ghost w-full min-h-[44px] flex items-center justify-between px-3 text-[13px] cursor-pointer"
            >
              <span>{showAllFields ? 'Fewer details' : 'Colour, VIN, stock # — more details'}</span>
              <ChevronDown size={16} className={`transition-transform ${showAllFields ? 'rotate-180' : ''}`} />
            </button>

            {showAllFields && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Stock #</label>
                  <input
                    type="text"
                    placeholder="STK-10293"
                    value={stockNumber}
                    onChange={(e) => setStockNumber(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] outline-none focus:border-[#4FE3DC] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Colour</label>
                  <input
                    type="text"
                    placeholder="Magnetic Gray"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] outline-none focus:border-[#4FE3DC] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Vehicle type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] outline-none focus:border-[#4FE3DC] transition-colors"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Bakkie / Truck">Bakkie / Truck</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Crossover">Crossover</option>
                    <option value="Coupe">Coupe</option>
                    <option value="Convertible">Convertible</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Transmission</label>
                  <select
                    value={transmission}
                    onChange={(e) => setTransmission(e.target.value as 'Automatic' | 'Manual')}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] outline-none focus:border-[#4FE3DC] transition-colors"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Automatic">Automatic</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Fuel</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric')}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] outline-none focus:border-[#4FE3DC] transition-colors"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'In-Progress' | 'Ready')}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] outline-none focus:border-[#4FE3DC] transition-colors"
                  >
                    <option value="In-Progress">In-Progress</option>
                    <option value="Ready">Ready</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">VIN</label>
                  <input
                    type="text"
                    placeholder="17 characters"
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] outline-none focus:border-[#4FE3DC] transition-colors font-mono"
                  />
                </div>
                {/* Auto-filled by the make/model picker above (the M&M code it
                    resolves); editable for a hand correction. */}
                <div>
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">M&amp;M Code</label>
                  <input
                    type="text"
                    placeholder="From make/model — auto-fills specs"
                    value={mmCode}
                    onChange={(e) => setMmCode(e.target.value)}
                    onBlur={(e) => lookupStaticInfo(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] outline-none focus:border-[#4FE3DC] transition-colors font-mono"
                  />
                  {staticLoading && (
                    <p className="mt-1 text-[12px] text-[rgba(232,234,230,0.5)]">Looking up specs…</p>
                  )}
                  {staticNote && (
                    <p className="mt-1 text-[12px] text-[#4FE3DC]">{staticNote}</p>
                  )}
                </div>

                {/* Optional Extras — full-width multi-select checklist */}
                <div className="col-span-2 relative">
                  <label className="text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1">Optional Extras</label>
                  <button
                    type="button"
                    onClick={() => setExtrasOpen((v) => !v)}
                    className="w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-left flex items-center justify-between outline-none focus:border-[#4FE3DC] transition-colors cursor-pointer"
                  >
                    <span className={optionalExtras.length ? 'text-[#E8EAE6]' : 'text-[rgba(232,234,230,0.32)]'}>
                      {optionalExtras.length ? `${optionalExtras.length} selected` : 'Select features…'}
                    </span>
                    <ChevronDown size={16} className={`text-[rgba(232,234,230,0.45)] transition-transform ${extrasOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {extrasOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-neutral-950 border border-neutral-800 rounded-[12px] shadow-2xl max-h-[320px] overflow-y-auto p-2 space-y-3 animate-in fade-in duration-100">
                      {([
                        ['Safety', ['Park Distance Control', 'Reverse Camera', '360° Camera', 'Blind Spot Monitor', 'Lane Assist']],
                        ['Comfort', ['Leather Seats', 'Heated Seats', 'Electric Seats', 'Sunroof / Panoramic Roof', 'Keyless Entry & Start', 'Dual-Zone Climate Control']],
                        ['Tech', ['Navigation', 'Apple CarPlay / Android Auto', 'Bluetooth', 'Digital Cockpit']],
                        ['Drivetrain', ['AWD / 4WD', 'Towbar', 'Adaptive Cruise Control']],
                        ['Exterior', ['Alloy Wheels', 'LED / Xenon Headlights', 'Roof Rails', 'Tinted Windows']],
                      ] as [string, string[]][]).map(([group, items]) => (
                        <div key={group}>
                          <p className="text-[12px] font-semibold text-[rgba(232,234,230,0.4)] uppercase tracking-wider px-1 mb-1">{group}</p>
                          {items.map((item) => {
                            const on = optionalExtras.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setOptionalExtras((prev) => on ? prev.filter((x) => x !== item) : [...prev, item])}
                                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-[rgba(232,234,230,0.06)] transition-colors cursor-pointer"
                              >
                                <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-[#4FE3DC] border-[#4FE3DC]' : 'border-[rgba(232,234,230,0.25)] bg-transparent'}`}>
                                  {on && <Check size={12} className="text-neutral-950" strokeWidth={3} />}
                                </span>
                                <span className={`text-[14px] ${on ? 'text-[#E8EAE6]' : 'text-[rgba(232,234,230,0.6)]'}`}>{item}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {optionalExtras.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {optionalExtras.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 bg-[rgba(79,227,220,0.12)] text-[#4FE3DC] text-[12px] font-medium px-2 py-0.5 rounded-full"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => setOptionalExtras((prev) => prev.filter((x) => x !== item))}
                            className="hover:text-white transition-colors cursor-pointer"
                          ><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ranked, not 50/50: the action on top, the way out below. */}
            <div className="pt-1 border-t border-neutral-850 space-y-2">
              <button
                type="submit"
                className="btn-primary on-fill w-full min-h-[48px] flex items-center justify-center gap-2 text-[15px] cursor-pointer"
              >
                {editingVehicle ? <><Pencil size={15} /> Save changes</> : <><Plus size={15} /> Add vehicle</>}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingVehicle(null); }}
                className="tru-btn-ghost w-full min-h-[44px] flex items-center justify-center text-[13px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Export toast */}
        {exportToast && (
          <div
            className={`rounded-lg border px-3 py-2 text-[13px] font-medium flex items-start gap-2 ${
              exportToast.type === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {exportToast.type === 'ok' ? <CheckCircle2 size={12} className="shrink-0 mt-0.5" /> : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
            <span className="leading-snug">{exportToast.text}</span>
          </div>
        )}

        {deepLinkBanner && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-normal text-cyan-300">Opened from Flow</p>
              <p className="text-[13px] text-neutral-200 mt-0.5 font-mono truncate">{deepLinkBanner}</p>
            </div>
            <button
              type="button"
              onClick={() => { setDeepLinkBanner(null); setHighlightStock(null); setSearchTerm(''); }}
              className="text-[13px] font-bold text-cyan-300 hover:text-[#E8EAE6] shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Filters Panel */}
        {/* Filters — one scrolling row instead of two stacked ones.
            Two full-width rows of chips cost 109px and pushed the first vehicle
            below the fold. They are also two halves of the same question, so
            they read better side by side than stacked.

            Each chip carries its own count: the number is the reason you would
            tap it, and it is what the deleted stat grid was there to tell you. */}
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
          {/* Underlined tab row, not filled pills — a row of five cyan pills read
              as five buttons and competed with the real action. The active tab
              carries the cyan underline; the count is the reason you'd tap it. */}
          <div className="flex items-center gap-4 w-max border-b border-white/10">
            {([
              { id: 'All' as const, label: 'All' },
              { id: 'In-Progress' as const, label: 'In progress' },
              { id: 'Ready' as const, label: 'Ready' },
              { id: 'Listed' as const, label: 'Listed' },
            ]).map((f) => {
              const count = f.id === 'All'
                ? vehicles.length
                : vehicles.filter((v) => v.status === f.id).length;
              const on = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={`flex items-center gap-1.5 px-0.5 py-2 -mb-px border-b-2 text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    on ? 'text-[#E8EAE6] border-[#4FE3DC]' : 'text-neutral-400 border-transparent hover:text-[#E8EAE6]'
                  }`}
                >
                  {f.label}
                  <span className={`font-mono text-[12px] ${on ? 'text-[#4FE3DC]' : 'text-neutral-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <span className="w-px h-4 bg-white/10 mx-1 shrink-0 self-center" aria-hidden="true" />

            {([
              { id: 'ALL' as const, label: 'Any readiness' },
              { id: 'NEEDS' as const, label: 'Needs shots' },
              { id: 'READY' as const, label: 'Web-ready' },
            ]).map((f) => {
              const on = readinessFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setReadinessFilter(f.id)}
                  className={`px-0.5 py-2 -mb-px border-b-2 text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    on ? 'text-[#E8EAE6] border-[#4FE3DC]' : 'text-neutral-400 border-transparent hover:text-[#E8EAE6]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Vehicles Inventory List */}
        <div className="space-y-3 pb-4">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-10 bg-gradient-to-b from-neutral-950/80 to-neutral-900/40 rounded-xl border border-dashed border-indigo-500/20 flex flex-col items-center justify-center p-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                <Camera size={22} className="text-indigo-400" />
              </div>
              <p className="text-[16px] text-[#E8EAE6] font-bold">
                {searchTerm || readinessFilter !== 'ALL' || activeFilter !== 'All' ? 'No matches' : 'No vehicles yet'}
              </p>
              <p className="text-[13px] text-neutral-500 mt-2 max-w-[220px] leading-relaxed">
                {searchTerm
                  ? `Nothing matched “${searchTerm}”. Clear search or add the unit from DMS stock #.`
                  : 'Add a stock unit, then take the guided shots. Export to DMS when ready.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (searchTerm || readinessFilter !== 'ALL' || activeFilter !== 'All') {
                    setSearchTerm('');
                    setReadinessFilter('ALL');
                    setActiveFilter('All');
                    setDeepLinkBanner(null);
                  } else {
                    setShowAddForm(true);
                  }
                }}
                className="mt-4 px-4 py-2 rounded-xl tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] text-[13px] font-semibold tracking-normal flex items-center gap-2"
              >
                <Plus size={12} />{' '}
                {searchTerm || readinessFilter !== 'ALL' || activeFilter !== 'All' ? 'Clear filters' : 'Add first vehicle'}
              </button>
            </div>
          ) : (
            filteredVehicles.map(vehicle => {
              // Count completed photos (always use safe photos map)
              const photos = vehicle.photos || {};
              const takenCount = Object.keys(photos).length;
              const totalCount = DEFAULT_TEMPLATE.slots.length;
              const coreTaken = DEFAULT_TEMPLATE.slots.filter(s => s.tier === 'core' && !!photos[s.id]).length;
              const totalCore = DEFAULT_TEMPLATE.slots.filter(s => s.tier === 'core').length;
              const readiness = computeWebReadiness(vehicle);
              /* Photos are files now, so the hero is usually "/media/<hash>.jpg"
                 rather than a data URI. Testing only for data: left every
                 migrated vehicle with a blank thumbnail. */
              const thumb =
                typeof photos.front_bumper === 'string' &&
                (photos.front_bumper.startsWith('data:') ||
                  photos.front_bumper.startsWith('/media/') ||
                  photos.front_bumper.startsWith('http'))
                  ? photos.front_bumper
                  : null;
              const priceLabel = Number(vehicle.price || 0).toLocaleString();
              const isHighlighted =
                !!highlightStock &&
                (vehicle.stockNumber || '').toLowerCase() === highlightStock.toLowerCase();

              return (
                <div 
                  key={vehicle.id}
                  ref={(el) => { cardRefs.current[vehicle.id] = el; }}
                  data-stock={vehicle.stockNumber}
                  className={`bg-neutral-950 rounded-2xl border border-neutral-800/80 p-3 hover:border-[rgba(232,234,230,0.20)] hover:bg-neutral-950/90 flex flex-col gap-2 relative ${
                    isHighlighted ? 'tl-stock-highlight' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {/* Photo Preview Miniature Thumbnail or Car icon */}
                      <div className="w-12 h-12 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt="Front bumper"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Car size={20} className="text-neutral-600" />
                        )}
                        <span className="absolute bottom-0 right-0 bg-black/80 px-1 text-[13px] font-mono font-bold text-neutral-300">
                          {takenCount}/{totalCount}
                        </span>
                      </div>

                      {/* Details */}
                      <div>
                        {/* The one thing scanned for on this screen, so it takes
                            the top of the scale. Everything else on the card was
                            the same 13px, which is why the list read as a wall. */}
                        <h3 className="text-[17px] font-semibold text-[#E8EAE6] leading-tight tracking-[-0.01em] flex items-center gap-2">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                          {isHighlighted && (
                            <span className="text-[13px] font-semibold tracking-normal text-cyan-300 bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 rounded">
                              From Flow
                            </span>
                          )}
                        </h3>
                        <p className="text-[13px] text-neutral-400 font-medium mt-0.5">
                          {vehicle.trim || 'Standard Trim'} • <span className="text-neutral-300">R {priceLabel}</span>
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (vehicle.stockNumber) copyStockNumber(vehicle.stockNumber, vehicle.id);
                            }}
                            className="text-[12px] font-mono text-[rgba(232,234,230,0.42)] hover:text-[rgba(232,234,230,0.72)] flex items-center gap-1 min-h-[32px] px-2 -mx-2"
                            title="Copy stock number"
                          >
                            {vehicle.stockNumber}
                            {copiedStockId === vehicle.id ? <Check size={12} className="text-[#4FE3DC]" /> : <Copy size={12} />}
                          </button>
                          {/* The vehicle.status chip stood here. It is a field somebody
                              sets by hand, while the chip beside it is derived from the
                              photos, score, checklist and signature actually on the
                              record — so the two drifted apart and read "Capturing" next
                              to "Capture in progress", which is the same sentence twice.

                              status still drives the filter row above, where it is the
                              user's own label and belongs. On the card, the derived
                              stage is the one that cannot be wrong. */}
                          {vehicle.lastDmsExportAt && (
                            <span className="text-[12px] text-neutral-500 font-mono" title={vehicle.lastDmsExportAt}>
                              Exported {new Date(vehicle.lastDmsExportAt).toLocaleDateString()}
                            </span>
                          )}
                          <span
                            className="text-[12px] font-semibold"
                            style={{ color: readiness.color }}
                            title={readiness.reasons.join(' · ') || readiness.label}
                          >
                            {readiness.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(vehicle);
                          document.getElementById('inventory-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center justify-center h-11 w-11 rounded-[12px] text-[rgba(232,234,230,0.55)] hover:text-[#E8EAE6] hover:bg-[rgba(232,234,230,0.06)] cursor-pointer transition-colors"
                        title="Edit vehicle details"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${vehicle.year} ${vehicle.make} from the catalogue?`)) {
                            onDeleteVehicle(vehicle.id);
                          }
                        }}
                        className="flex items-center justify-center h-11 w-11 rounded-[12px] text-[rgba(232,234,230,0.55)] hover:text-[#C07676] hover:bg-[rgba(184,106,106,0.14)] cursor-pointer transition-colors"
                        title="Delete vehicle"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Indicators */}
                  <div className="mt-1 pt-2 border-t border-neutral-900 flex flex-col gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[13px] text-neutral-400 mb-1 font-mono">
                        {/* The chip above keeps the raw count; this line is the
                            percentage the bar draws — CORE shots, not the old
                            all-optional "required" set that always read 100%. */}
                        <span>Core photos</span>
                        <span className="font-bold text-neutral-200">
                          {totalCore > 0 ? Math.round((coreTaken / totalCore) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-[rgba(232,234,230,0.08)] h-[3px] rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                            coreTaken === totalCore ? 'bg-emerald-500' : 'bg-indigo-500'
                          } ${coreTaken > 0 && coreTaken < totalCore ? 'tl-progress-sheen' : ''}`}
                          style={{ width: `${totalCore > 0 ? Math.round((coreTaken / totalCore) * 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* One primary (the job), a 3-up ghost row (the extras). Was a
                        cyan fill, two grey fills and a blue fill at equal weight,
                        which said nothing on the card was the job. */}
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(vehicle)}
                        className="btn-primary on-fill flex items-center justify-center gap-2 text-[15px] cursor-pointer whitespace-nowrap w-full min-h-[44px] px-2 py-2"
                        title="Open camera guide and take pictures"
                      >
                        <Camera size={15} /> Take pictures
                      </button>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={(e) => handleExportClick(e, vehicle)}
                          disabled={takenCount === 0 || exportingId === vehicle.id || !onExportToDms}
                          title={takenCount > 0 ? (isDemo ? `Push ${takenCount} photos to the demo showroom` : `Push ${takenCount} photos to TruFlow DMS`) : 'Take photos first'}
                          className="tru-btn-ghost flex items-center justify-center gap-1.5 text-[13px] cursor-pointer min-h-[44px] px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {exportingId === vehicle.id ? (
                            <><RefreshCw size={13} className="animate-spin" /> Syncing</>
                          ) : (
                            <><Download size={13} /> Export</>
                          )}
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); onViewReport?.(vehicle); }}
                          disabled={takenCount === 0}
                          title={takenCount > 0 ? 'Open inspection report' : 'Take photos first'}
                          className="tru-btn-ghost flex items-center justify-center gap-1.5 text-[13px] cursor-pointer min-h-[44px] px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FileText size={13} /> Report
                        </button>

                        {/* Publish: a secondary when the car is web-ready, a disabled
                            control when it isn't — never a coloured button that
                            refuses. No blue anywhere. */}
                        <button
                          type="button"
                          disabled={isDemo || !onUpdateVehicle || !isStructurallyWebReady(vehicle) || publishingId === vehicle.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!onUpdateVehicle || isDemo) return;
                            setPublishingId(vehicle.id);
                            const nextShow = !vehicle.showOnWebsite;
                            const saved = await onUpdateVehicle(vehicle, {
                              showOnWebsite: nextShow,
                              status: nextShow && vehicle.status === 'In-Progress' ? 'Ready' : vehicle.status,
                              dealerName: dealershipName,
                              dealerWhatsApp: dealerWhatsApp || vehicle.dealerWhatsApp,
                            });
                            if (saved && onExportToDms) {
                              await onExportToDms(saved).catch(() => {});
                            }
                            setPublishingId(null);
                            if (saved) {
                              setExportToast({
                                type: 'ok',
                                text: nextShow
                                  ? `${vehicle.stockNumber} published to website feed`
                                  : `${vehicle.stockNumber} removed from website feed`,
                              });
                              setTimeout(() => setExportToast(null), 3200);
                            } else {
                              setExportToast({ type: 'err', text: 'Could not update publish status' });
                              setTimeout(() => setExportToast(null), 3200);
                            }
                          }}
                          title={
                            isDemo
                              ? 'Demo mode — publishing disabled'
                              : vehicle.showOnWebsite
                                ? 'Remove from public website stock feed'
                                : 'Publish to dealer website stock feed'
                          }
                          className={`flex items-center justify-center gap-1.5 text-[13px] cursor-pointer min-h-[44px] px-2 rounded-[12px] transition-colors disabled:cursor-not-allowed ${
                            isStructurallyWebReady(vehicle)
                              ? 'tru-btn-secondary'
                              : 'text-[rgba(232,234,230,0.30)]'
                          }`}
                        >
                          {publishingId === vehicle.id ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <ExternalLink size={13} />
                          )}
                          {vehicle.showOnWebsite ? 'Unpublish' : 'Publish'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );

          })
        )}
      </div>
    </>
  ) : currentTab === 'dashboard' ? (
          <div className="space-y-4 pb-6 animate-in fade-in duration-500">
            {/* Dealership setup reminder — quiet card while required items are
                missing on the shared TruFlow record. Dismissed state lives
                server-side (ack) + a short per-device snooze; the card itself
                hides once requiredComplete flips true. */}
            <SetupChecklistCard
              status={setupStatus}
              onSetUp={() => setCurrentTab('settings')}
              onSnooze={onSetupSnooze}
            />

            {/* Dashboard heading & revenue overview */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-[#4FE3DC]" />
                  <span className="text-[13px] font-semibold text-[#E8EAE6]">Dashboard</span>
                </div>
                <p className="text-[12px] text-[rgba(232,234,230,0.55)] mt-0.5">Photography & readiness audit</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[13px] font-semibold text-[#4FE3DC]">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'Ready' ? v.price : 0), 0).toLocaleString()} ready
                </span>
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'In-Progress' ? v.price : 0), 0).toLocaleString()} pending
                </span>
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-[rgba(232,234,230,0.14)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]">Catalogue</span>
                <span className="text-[16px] font-semibold text-[#E8EAE6]">{vehicles.length}</span>
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-[rgba(232,234,230,0.14)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]">Ready</span>
                <span className="text-[16px] font-semibold text-[#4FE3DC]">{vehicles.filter(v => v.status === 'Ready').length}</span>
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-[rgba(232,234,230,0.14)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]">Pending</span>
                <span className="text-[16px] font-semibold text-[#E8EAE6]">{vehicles.filter(v => v.status === 'In-Progress').length}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-[rgba(232,234,230,0.14)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]">Capture rate</span>
                <span className="text-[16px] font-semibold text-[#4FE3DC]">
                  {Math.round((vehicles.reduce((acc, v) => acc + Object.keys(v.photos || {}).length, 0) / (vehicles.length * DEFAULT_TEMPLATE.slots.length || 1)) * 100)}%
                </span>
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-[rgba(232,234,230,0.14)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]">Photos</span>
                <span className="text-[16px] font-semibold text-[#4FE3DC]">
                  {vehicles.reduce((acc, v) => acc + Object.keys(v.photos || {}).length, 0)}
                </span>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-2 gap-2">
              {/* Readiness */}
              <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]  mb-2">Readiness</span>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Ready', value: vehicles.filter(v => v.status === 'Ready').length },
                          { name: 'In-Progress', value: vehicles.filter(v => v.status === 'In-Progress').length }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#4FE3DC" />
                        <Cell fill="#8B8D89" />
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', fontSize: '13px', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[12px] text-[rgba(232,234,230,0.55)]">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#4FE3DC]"/> Ready</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#8B8D89]"/> Pending</span>
                </div>
              </div>

              {/* Weekly Capture Volume */}
              <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[12px] text-[rgba(232,234,230,0.55)]  mb-2">Weekly activity</span>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Mon', photos: 12 },
                      { name: 'Tue', photos: 19 },
                      { name: 'Wed', photos: 15 },
                      { name: 'Thu', photos: 22 },
                      { name: 'Fri', photos: 30 },
                      { name: 'Sat', photos: 8 },
                      { name: 'Sun', photos: 4 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                      {/* Was fontSize 7 on #737373 — the day labels under this chart
                          were the smallest type in the app by a wide margin, well
                          under the 12px floor brand.css sets, and the grey sat
                          around 3.5:1 on the panel. Recharts writes these as inline
                          SVG attributes, so no stylesheet rule reaches them. */}
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'rgba(232,234,230,0.55)' }} />
                      <YAxis hide />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', fontSize: '13px', borderRadius: '8px' }}
                      />
                      <Bar dataKey="photos" fill="#4FE3DC" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Critical Action Items */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                {/* "Attention Required" and "Action Needed" side by side said the
                    same thing twice and neither said what to do. The heading now
                    names the work; the count is the urgency. */}
                <span className="text-[13px] font-semibold text-[#E8EAE6]">Still to shoot</span>
                <span className="text-[13px] text-[rgba(232,234,230,0.55)] font-medium">
                  {vehicles.filter(v => v.status === 'In-Progress').length}
                </span>
              </div>
              <div className="space-y-2">
                {vehicles.filter(v => v.status === 'In-Progress').length === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-[13px] text-[rgba(232,234,230,0.55)]">All vehicles shot.</p>
                  </div>
                ) : (
                  vehicles.filter(v => v.status === 'In-Progress').slice(0, 3).map(v => {
                    const missingCount = DEFAULT_TEMPLATE.slots.filter(s => s.required && !(v.photos || {})[s.id]).length;
                    return (
                      <div key={v.id} className="flex items-center justify-between p-2 bg-neutral-900/40 rounded-lg border border-neutral-850/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[rgba(232,234,230,0.055)] flex items-center justify-center">
                            <Car size={12} className="text-[rgba(232,234,230,0.55)]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#E8EAE6]">{v.year} {v.make}</p>
                            <p className="text-[13px] text-neutral-500">Missing {missingCount} required shots</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onSelectVehicle(v)}
                          className="text-[13px] font-medium text-[#4FE3DC] hover:text-[#4FE3DC]/80"
                        >
                          Complete →
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Next action — computed from the fleet, not asserted. */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#4FE3DC]/12 text-[#4FE3DC] shrink-0">
                <Lightbulb size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-medium text-[rgba(232,234,230,0.55)]">Do next</span>
                <p className="text-[16px] font-semibold text-[#E8EAE6] leading-snug mt-1">
                  {nextAction.head}
                </p>
                <p className="text-[13px] text-neutral-300 leading-snug mt-0.5">
                  {nextAction.body}
                </p>
                {fleet.total > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#4FE3DC] transition-all duration-500"
                        style={{ width: `${Math.round((fleet.done / fleet.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-mono text-neutral-400 shrink-0">
                      {fleet.done}/{fleet.total} complete
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-6 animate-in slide-in-from-right-4 duration-500">
            {/* Settings Heading */}
            <div className="flex items-center gap-2">
              <Sliders size={15} className="text-indigo-400" />
              <span className="text-[13px] font-bold text-neutral-200 tracking-normal">Dealership settings</span>
            </div>

            {/* Profile Section */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40">
                <span className="text-[13px] font-bold text-neutral-400 ">Dealership profile</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[12px] text-neutral-500 font-semibold">Dealership name</label>
                  <input 
                    type="text" 
                    value={dealershipName}
                    onChange={(e) => setDealershipName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-[13px] text-[#E8EAE6] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] text-neutral-500 font-semibold">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-[13px] text-[#E8EAE6] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                {/* Not a choice any more.
                    This was a <select> carrying a hardcoded two-dealer list, and
                    for a phone signed in with a per-dealership code the server
                    takes the dealership from the token and ignores whatever the
                    phone claims — so changing it did nothing while looking like
                    it did something. The code decides; this reports it. */}
                <div className="space-y-2">
                  <label className="text-[12px] text-neutral-500 font-semibold">Dealership (DMS tagging)</label>
                  <div className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-3">
                    <div className="text-[15px] font-semibold text-[#E8EAE6]">
                      {dealerDisplayName || 'Not set'}
                    </div>
                    {dealerSlug && (
                      <div className="text-[13px] font-mono text-[#4FE3DC] mt-0.5">{dealerSlug}</div>
                    )}
                  </div>
                  <p className="text-[13px] text-neutral-600 leading-relaxed">
                    {dealerPinned
                      ? 'Set by the access code this phone signed in with, and enforced by the server — captures cannot file to another dealer, whatever this phone sends. To change it, sign out and sign in with that dealership’s code.'
                      : 'Chosen when this phone signed in. To change it, sign out and sign in again — or ask TruSaaS for a dealership code, which pins it server-side so a wrong pick cannot put cars in another dealer’s stock.'}
                  </p>
                </div>
              </div>
            </div>

            {/* DMS export target — fixed for every device, server-controlled */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40 flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-400 ">TruFlow DMS Export Target</span>
                <ExternalLink size={12} className="text-[#4FE3DC]" />
              </div>
              <div className="p-4 space-y-3">
                <p className="text-[13px] text-neutral-500 leading-relaxed">
                  <strong className="text-neutral-300">Export to DMS</strong> pushes photos via{' '}
                  <span className="font-mono text-neutral-400">/api/sync/push-photos</span>.
                  Match by stock number; missing stock is created automatically.
                </p>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-3">
                  <div className="min-w-0">
                    <div className="text-[12px] text-[rgba(232,234,230,0.55)]">Target</div>
                    <div className="text-[13px] font-mono text-[#E8EAE6] truncate">{DMS_URL}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(DMS_URL, '_blank')}
                    className="shrink-0 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 rounded-lg text-[13px] font-bold cursor-pointer"
                    title="Open DMS in browser"
                  >
                    Open
                  </button>
                </div>
                <p className="text-[13px] text-neutral-600 leading-relaxed">
                  The same DMS for every device — set on the server, so a phone can't point exports
                  at the wrong place.
                </p>
              </div>
            </div>

            {/* Regional & Localization */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40">
                <span className="text-[13px] font-bold text-neutral-400 ">Regional & Localization</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-bold text-neutral-200">Currency</p>
                    <p className="text-[13px] text-neutral-500">Global display currency for valuations</p>
                  </div>
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded min-h-[44px] px-3 text-[13px] text-[#E8EAE6]"
                  >
                    <option value="ZAR">South African Rand (R)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="GBP">British Pound (£)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AI Core Tuning */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40 flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-400 ">AI Capture Intelligence</span>
                <Sparkles size={11} className="text-indigo-400" />
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[13px] font-bold text-neutral-200">AI Quality Threshold</p>
                    <span className="text-[13px] font-mono text-indigo-400 font-bold">{aiThreshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="98" 
                    value={aiThreshold}
                    onChange={(e) => setAiThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[13px] text-neutral-500 leading-relaxed italic">
                    Images scoring below this threshold will be flagged for immediate re-capture. Higher thresholds ensure "Perfect" listings but may require more capture attempts.
                  </p>
                </div>
              </div>
            </div>


            {/* Data Management */}
            <div className="pt-2 space-y-2">
              <label className="block space-y-1">
                <span className="text-[13px] tracking-normal text-neutral-500 font-bold">WhatsApp sales number</span>
                <input
                  value={dealerWhatsApp}
                  onChange={(e) => setDealerWhatsApp(e.target.value)}
                  placeholder="+27 …"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-[#E8EAE6]"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('trulens_dealer_name', dealershipName);
                  localStorage.setItem('trulens_dealer_branch', branch);
                  localStorage.setItem('trulens_dealer_slug', dealerSlug);
                  if (dealerSlug) localStorage.setItem('trulens_dealer_confirmed', '1');
                  localStorage.setItem('trulens_dealer_wa', dealerWhatsApp);
                  localStorage.setItem('trulens_currency', currency);
                  localStorage.setItem('trulens_ai_threshold', String(aiThreshold));
                  setExportToast({ type: 'ok', text: 'Settings saved on this device (used in VIR & WhatsApp)' });
                  setTimeout(() => setExportToast(null), 2800);
                }}
                className="w-full tl-btn-3d font-bold py-3 rounded-xl text-[15px] transition-all"
              >
                Save Configuration
              </button>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                <div className="text-[13px] tracking-normal text-red-300/80 font-bold">Session</div>
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  {isDemo
                    ? 'Signed in as demo inspector (offline). Log out returns to the login screen.'
                    : localStorage.getItem('trulens_device_token')
                      ? `Signed in · ${localStorage.getItem('trulens_dealer_slug') || 'dealer device'}`
                      : user?.email
                        ? `Signed in as ${user.email}`
                        : 'Signed in'}
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tracking-normal text-red-200 bg-red-500/15 border border-red-500/35 hover:bg-red-500/25 transition-all disabled:opacity-50"
                >
                  <LogOut size={14} />
                  {loggingOut ? 'Signing out…' : 'Log out'}
                </button>
              </div>
            </div>

            <div className="pt-8 pb-4 flex flex-col items-center opacity-40">
              <span className="text-[13px] text-[rgba(232,234,230,0.32)]">Powered by TruSaaS</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom navigation ────────────────────────────────────────────────
          Moved down from the top of the screen. On a phone held in one hand the
          top third is the hardest place to reach and the bottom is the easiest,
          and this is an app used one-handed while the other hand is on the car.

          pb uses the safe-area inset so the labels clear the iOS home indicator
          rather than sitting under it. */}
      <nav
        className="tl-bottomnav shrink-0 flex items-stretch gap-1 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))]"
        aria-label="Sections"
      >
        {([
          { id: 'catalog' as const, label: 'Catalogue', Icon: FolderOpen, title: 'Vehicle catalogue' },
          { id: 'dashboard' as const, label: 'Dashboard', Icon: BarChart3, title: 'Fleet dashboard' },
          { id: 'settings' as const, label: 'Settings', Icon: Settings, title: 'Dealership & DMS settings' },
        ]).map(({ id, label, Icon, title }) => {
          const on = currentTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCurrentTab(id)}
              title={title}
              aria-current={on ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[12px] font-semibold tracking-normal transition-colors cursor-pointer ${
                on ? 'text-[#4FE3DC] bg-[#4FE3DC]/10' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon size={18} strokeWidth={on ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
