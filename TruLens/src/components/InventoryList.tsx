import React from 'react';
import {
  Car, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  Trash2, Cloud, Sparkles, FolderOpen, Image as ImageIcon, ArrowRight, Download,
  BarChart3, Palette, Copy, Check, Award, Lightbulb, BookOpen, Sliders, ExternalLink,
  FileText, Settings, Camera, LogOut, ScanLine, Loader2, Pencil} from 'lucide-react';
import trulensLogo from '../assets/images/trulens-wordmark.png';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Vehicle, DmsExportResult } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { computeWebReadiness, isStructurallyWebReady } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';
import DiscScanner from './DiscScanner';
import type { DiscScan } from '../lib/saDisc';

interface InventoryListProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onViewReport?: (vehicle: Vehicle) => void;
  onAddVehicle: (newVehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => void;
  onDeleteVehicle: (id: string) => void;
  onExportToDms?: (vehicle: Vehicle) => Promise<DmsExportResult>;
  onUpdateVehicle?: (vehicle: Vehicle, patch: Partial<Vehicle>) => Promise<Vehicle | null>;
  syncStatus: 'synced' | 'syncing' | 'error';
  onForceSync: () => void;
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
  onForceSync
}: InventoryListProps) {
  const { signOut, user, isDemo } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
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

  // Glass pointer glow on vehicle cards
  React.useEffect(() => {
    const root = document.getElementById('inventory-list-container');
    if (!root) return;
    /* Desktop only. The glow it drives is behind @media (hover: hover), so on a
       phone this listener fired through every scroll and wrote CSS custom
       properties on cards for an effect that device can never show. */
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement)?.closest?.('.tl-card-lift') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    root.addEventListener('pointermove', onMove, { passive: true });
    return () => root.removeEventListener('pointermove', onMove);
  }, []);
  
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
    const shortOfPublish = rows
      .filter(({ r }) => r.missingRequired.length > 0)
      .sort((a, b) => a.r.missingRequired.length - b.r.missingRequired.length);
    const readyToExport = rows.filter(({ v, r }) => r.missingRequired.length === 0 && !v.lastDmsExportAt);
    const done = rows.filter(({ r }) => r.missingRequired.length === 0).length;
    return { rows, shortOfPublish, readyToExport, done, total: rows.length };
  }, [vehicles]);

  /** One sentence, the most useful thing true right now. */
  const nextAction = React.useMemo(() => {
    if (fleet.total === 0) {
      return { head: 'No vehicles yet', body: 'Add one to start capturing.' };
    }
    if (fleet.shortOfPublish.length > 0) {
      const nearest = fleet.shortOfPublish[0];
      const missing = nearest.r.missingRequired;
      const name = `${nearest.v.year} ${nearest.v.make} ${nearest.v.model}`.trim();
      return {
        head: `${fleet.shortOfPublish.length} ${fleet.shortOfPublish.length === 1 ? 'vehicle is' : 'vehicles are'} short of publishing`,
        body: `Closest: ${name} — ${missing.length === 1 ? missing[0] : `${missing.length} shots, starting with ${missing[0]}`}.`,
      };
    }
    if (fleet.readyToExport.length > 0) {
      return {
        head: `${fleet.readyToExport.length} ready to send to TruFlow`,
        body: 'Every required shot is captured. Export to publish them.',
      };
    }
    return { head: 'Everything captured', body: `All ${fleet.total} vehicles have their required shots.` };
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
  /* Read-only now: the access code sets this, not the phone. */
  const dealerSlug = localStorage.getItem('trulens_dealer_slug') || '';
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
  const [scanningDisc, setScanningDisc] = React.useState(false);
  const [scanNote, setScanNote] = React.useState<string | null>(null);

  // Fill the form from a scanned licence disc — everything stays editable.
  const applyDiscScan = (d: DiscScan) => {
    setScanningDisc(false);
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
    setShowAddForm(true);
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
        vin: vin.trim(),
        stockNumber: stockNumber.trim(),
        color: color.trim(),
        price: Number(price),
        vehicleType,
        mileage: Number(mileage),
        transmission,
        fuelType,
        status,
      });
    } else {
      onAddVehicle({
        make,
        model,
        year: Number(year),
        trim,
        vin: vin.trim(),
        stockNumber: stockNumber.trim(),
        color: color.trim(),
        price: Number(price),
        vehicleType,
        mileage: Number(mileage),
        transmission,
        fuelType,
        status
      });
    }

    // Reset form
    setEditingVehicle(null);
    setMake('');
    setModel('');
    setYear(new Date().getFullYear());
    setTrim('');
    setVin('');
    setStockNumber('');
    setColor('');
    setPrice(24995);
    setVehicleType('SUV');
    setMileage('');
    setTransmission('Manual');
    setFuelType('Petrol');
    setStatus('In-Progress');
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
        /* The walkaround is called out on its own, and its ABSENCE is stated
           rather than left blank. Every other entry here is omitted when zero,
           which is right for photo categories — but a missing 360 is the one
           thing worth saying out loud. An export that silently carried no video
           read exactly like one that did, and the only way to tell them apart
           was to go and read the dealer's public feed afterwards. */
        const parts = b
          ? [
              b.mainImages ? `${b.mainImages} main` : null,
              b.extras ? `${b.extras} extras` : null,
              b.damage ? `${b.damage} damage` : null,
              b.vin ? `${b.vin} VIN` : null,
              b.serviceBook ? `${b.serviceBook} service` : null,
              b.walkaround ? 'Tru Orbit ✓' : 'no Tru Orbit',
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
      
      {/* App Header */}
      <div className="tl-appbar px-3.5 py-3 flex items-center gap-3 shrink-0">
        {/* The bar used to be a logo, a wide gap, and three secondary buttons.
            The gap now carries the two things a person in a yard needs: whose
            stock this is, and how much is left. The dealership decides which
            dealer's inventory the photos land in and was shown nowhere. */}
        <img
          src={trulensLogo}
          alt="TruLens"
          /* The supplied wordmark is the light-background variant: its "Tru" is
             dark graphite chrome, which goes muddy on #06080D and reads grey.
             Lifting brightness makes the chrome read as silver on dark, matching
             the TruSaaS wordmark the holding site uses. Remove this once a
             proper light-chrome TruLens wordmark exists. */
          className="h-6 w-auto object-contain shrink-0 [filter:brightness(2.1)_contrast(0.95)_saturate(1.05)]"
        />

        <div className="h-7 w-px bg-white/12 shrink-0" aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#E8EAE6] truncate leading-tight">
            {dealershipName}
          </div>
          <div className="text-[12px] text-neutral-400 leading-tight truncate">
            {fleet.total === 0
              ? 'No vehicles yet'
              : fleet.shortOfPublish.length > 0
                ? `${fleet.done}/${fleet.total} complete · ${fleet.shortOfPublish.length} need photos`
                : `${fleet.done}/${fleet.total} complete`}
          </div>
        </div>

        {/* Three buttons crowding a phone header, in three different weights:
            a cyan-filled link to a DIFFERENT product shouting louder than any of
            this app's own content, a "Sync" that read "Err" when it failed, and
            a red-bordered "Out". Red is reserved here for errors and destructive
            actions, and signing out is neither.

            All three are now the same quiet icon button. Sync keeps its colour
            because that one is state, not decoration. */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => window.open(DMS_URL, '_blank')}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] transition-colors cursor-pointer"
            aria-label={`Open TruFlow DMS (${DMS_URL})`}
            title={`Open TruFlow DMS (${DMS_URL})`}
          >
            <ExternalLink size={16} />
          </button>
          <button
            onClick={onForceSync}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
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
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] transition-all cursor-pointer disabled:opacity-50"
            aria-label={user?.email ? `Sign out (${user.email})` : 'Sign out'}
            title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
          >
            {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
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
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
            <input
              type="text"
              placeholder="Search VIN, Stock, Make..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-950 text-[13px] text-neutral-200 pl-8 pr-3 py-2 rounded-lg border border-neutral-850 focus:border-cyan-500/40 outline-none placeholder-neutral-500 font-mono"
            />
          </div>
          <button
            onClick={() => { setEditingVehicle(null); setShowAddForm(!showAddForm); }}
            className="p-2 rounded-lg bg-tru-cyan hover:bg-tru-cyan/90 text-[#E8EAE6] shadow-md cursor-pointer transition-transform"
          >
            <Plus size={16} />
          </button>
        </div>

        {scanningDisc && (
          <DiscScanner onResult={applyDiscScan} onClose={() => setScanningDisc(false)} />
        )}

        {/* Add vehicle Form Box */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-neutral-850 pb-2">
              <span className="text-[13px] font-semibold text-neutral-300 flex items-center gap-2">
                {editingVehicle
                  ? <><Pencil size={14} className="text-tru-cyan" /> Edit vehicle</>
                  : <><Plus size={14} className="text-tru-cyan" /> New vehicle</>}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setScanningDisc(true)}
              className="w-full py-3 rounded-xl bg-[#4FE3DC]/10 border border-[#4FE3DC]/30 text-[#4FE3DC] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#4FE3DC]/15 transition-colors"
            >
              <ScanLine size={16} /> Scan licence disc
            </button>

            {scanNote && (
              <p className="text-[13px] text-[rgba(232,234,230,0.72)]">{scanNote}</p>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-[12px] text-neutral-500">or enter by hand</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Required fields — full width, stacked */}
            <div className="space-y-2">
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Make</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Ford"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Model</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mustang"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Mileage (km)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="e.g. 78400"
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                />
              </div>
            </div>

            {/* Listing detail — 2-col grid */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Year</label>
                <input
                  type="number"
                  placeholder="2024"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan font-mono"
                />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Trim</label>
                <input
                  type="text"
                  placeholder="GT Premium"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Price (R)</label>
                <input
                  type="number"
                  placeholder="35000"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan font-mono"
                />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Stock #</label>
                <input
                  type="text"
                  placeholder="STK-10293"
                  value={stockNumber}
                  onChange={(e) => setStockNumber(e.target.value)}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan font-mono"
                />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Colour</label>
                <input
                  type="text"
                  placeholder="Magnetic Gray"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                />
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Vehicle type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
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
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Transmission</label>
                <select
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value as 'Automatic' | 'Manual')}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                >
                  <option value="Manual">Manual</option>
                  <option value="Automatic">Automatic</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Fuel</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric')}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'In-Progress' | 'Ready')}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan"
                >
                  <option value="In-Progress">In-Progress</option>
                  <option value="Ready">Ready</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-1">VIN</label>
                <input
                  type="text"
                  placeholder="17 characters"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  className="w-full min-h-[46px] bg-neutral-900 text-[15px] px-3 py-2.5 rounded-lg border border-neutral-800 text-[#E8EAE6] outline-none focus:border-tru-cyan font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1 border-t border-neutral-850">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingVehicle(null); }}
                className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-[13px] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-tru-cyan hover:bg-tru-cyan/90 text-[#E8EAE6] rounded-lg text-[13px] font-bold cursor-pointer shadow-md flex items-center justify-center gap-1"
              >
                {editingVehicle ? <><Pencil size={14} /> Save changes</> : <><Plus size={14} /> Add vehicle</>}
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
          <div className="flex items-center gap-1.5 w-max">
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
                  className={`flex items-center gap-1.5 px-3.5 rounded-full text-[13px] font-semibold tracking-normal whitespace-nowrap border transition-colors cursor-pointer ${
                    on
                      ? 'bg-[#4FE3DC] border-[#4FE3DC] text-[#06080D]'
                      : 'bg-white/[0.04] border-white/10 text-neutral-300 hover:border-white/20'
                  }`}
                >
                  {f.label}
                  <span className={`font-mono text-[12px] ${on ? 'text-[#06080D]/70' : 'text-neutral-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <span className="w-px h-6 bg-white/10 mx-1 shrink-0" aria-hidden="true" />

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
                  className={`px-3.5 rounded-full text-[13px] font-semibold tracking-normal whitespace-nowrap border transition-colors cursor-pointer ${
                    on
                      ? 'bg-[#4FE3DC] border-[#4FE3DC] text-[#06080D]'
                      : 'bg-white/[0.04] border-white/10 text-neutral-300 hover:border-white/20'
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
              const requiredTaken = DEFAULT_TEMPLATE.slots.filter(s => s.required && !!photos[s.id]).length;
              const totalRequired = DEFAULT_TEMPLATE.slots.filter(s => s.required).length;
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
                  className={`tl-card-lift bg-neutral-950 rounded-xl border border-neutral-800/80 p-3 hover:border-indigo-500/40 hover:bg-neutral-950/90 flex flex-col gap-2 relative ${
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
                        <h3 className="text-[17px] font-bold text-[#E8EAE6] leading-tight tracking-[-0.01em] flex items-center gap-2">
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
                            className="text-[13px] font-mono bg-neutral-900 px-2 py-0.5 rounded text-neutral-400 border border-neutral-800 hover:border-indigo-500/50 hover:text-indigo-300 flex items-center gap-1"
                            title="Copy stock number"
                          >
                            {vehicle.stockNumber}
                            {copiedStockId === vehicle.id ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
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
                            className="text-[12px] font-bold px-2 py-0.5 rounded border"
                            style={{ color: readiness.color, borderColor: readiness.color + '40', background: readiness.color + '14' }}
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
                        className="p-1 text-neutral-600 hover:text-[#4FE3DC] rounded hover:bg-neutral-900 cursor-pointer"
                        title="Edit vehicle details"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${vehicle.year} ${vehicle.make} from the catalogue?`)) {
                            onDeleteVehicle(vehicle.id);
                          }
                        }}
                        className="p-1 text-neutral-600 hover:text-red-400 rounded hover:bg-neutral-900 cursor-pointer"
                        title="Delete vehicle"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Indicators */}
                  <div className="mt-1 pt-2 border-t border-neutral-900 flex flex-col gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[13px] text-neutral-400 mb-1 font-mono">
                        {/* Was "Required Guide Completion: 7 of 19 (37%)" directly
                            under a chip already reading "Photos 7/19" — the same
                            fact twice, once in product vocabulary and once in
                            plain numbers. The chip keeps the count; this line
                            keeps the percentage the bar is drawing. */}
                        <span>Required photos</span>
                        <span className="font-bold text-neutral-200">
                          {totalRequired > 0 ? Math.round((requiredTaken / totalRequired) * 100) : 100}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                            requiredTaken === totalRequired ? 'bg-emerald-500' : 'bg-indigo-500'
                          } ${requiredTaken > 0 && requiredTaken < totalRequired ? 'tl-progress-sheen' : ''}`}
                          style={{ width: `${totalRequired > 0 ? Math.round((requiredTaken / totalRequired) * 100) : 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(vehicle)}
                        className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[#E8EAE6] bg-tru-cyan hover:bg-cyan-500 on-fill cursor-pointer whitespace-nowrap min-h-[44px] px-2 py-2 rounded-lg transition-colors"
                        title="Open camera guide and take pictures"
                      >
                        <Camera size={13} /> Capture
                      </button>

                      <button
                        onClick={(e) => handleExportClick(e, vehicle)}
                        disabled={takenCount === 0 || exportingId === vehicle.id || !onExportToDms}
                        title={takenCount > 0 ? `Push ${takenCount} photos to TruFlow DMS` : 'Take photos first'}
                        className="flex items-center justify-center gap-2 text-[13px] font-semibold cursor-pointer whitespace-nowrap min-h-[44px] px-2 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-neutral-900 border-[rgba(232,234,230,0.14)] text-[#E8EAE6] hover:bg-neutral-800"
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
                        className="flex items-center justify-center gap-2 text-[13px] font-semibold cursor-pointer whitespace-nowrap min-h-[44px] px-2 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-neutral-900 border-[rgba(232,234,230,0.14)] text-[#E8EAE6] hover:bg-neutral-800"
                      >
                        <FileText size={13} /> Report
                      </button>

                      <button
                        type="button"
                        disabled={!onUpdateVehicle || !isStructurallyWebReady(vehicle) || publishingId === vehicle.id}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!onUpdateVehicle) return;
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
                          vehicle.showOnWebsite
                            ? 'Remove from public website stock feed'
                            : 'Publish to dealer website stock feed'
                        }
                        className={`flex items-center justify-center gap-2 text-[13px] font-semibold cursor-pointer whitespace-nowrap min-h-[44px] px-2 py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          vehicle.showOnWebsite
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25'
                            : 'bg-neutral-900 border-[rgba(232,234,230,0.14)] text-[#E8EAE6] hover:bg-neutral-800'
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
              );

          })
        )}
      </div>
    </>
  ) : currentTab === 'dashboard' ? (
          <div className="space-y-4 pb-6 animate-in fade-in duration-500">
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
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[13px] text-[#E8EAE6]"
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
