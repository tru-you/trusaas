import React from 'react';
import {
  Car, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  Trash2, Cloud, Sparkles, FolderOpen, Image as ImageIcon, ArrowRight, Download,
  BarChart3, Palette, Copy, Check, Award, Lightbulb, Sliders,
  FileText, Settings, Camera, LogOut, Loader2, ScanLine, Pencil
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Vehicle, DmsExportResult } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import DiscScanner from './DiscScanner';
import type { DiscScan } from '../lib/saDisc';
import InstallAppButton from './InstallAppButton';
import { computeInspectionReadiness } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';

interface InventoryListProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onViewReport?: (vehicle: Vehicle) => void;
  onAddVehicle: (newVehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => void;
  onDeleteVehicle: (id: string) => void;
  onExportToDms?: (vehicle: Vehicle) => Promise<DmsExportResult>;
  onOpenTradeIn?: (vehicle: Vehicle) => void;
  onViewTradeInReport?: (vehicle: Vehicle) => void;
  onUpdateVehicle?: (vehicle: Vehicle, patch: Partial<Vehicle>) => Promise<Vehicle | null>;
  syncStatus: 'synced' | 'syncing' | 'error';
  onForceSync: () => void;
}

const DMS_PRESETS = {
  premium: { label: 'TruFlow Premium', url: 'http://localhost:3001' },
  lite: { label: 'TruFlow Lite', url: 'http://localhost:3002' },
  custom: { label: 'Custom URL', url: '' },
} as const;

const DEFAULT_DMS_URL = DMS_PRESETS.premium.url;

export default function InventoryList({
  vehicles,
  onSelectVehicle,
  onViewReport,
  onAddVehicle,
  onDeleteVehicle,
  onExportToDms,
  onOpenTradeIn,
  onViewTradeInReport,
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
  const [activeFilter, setActiveFilter] = React.useState<'All' | 'In-Progress' | 'Ready'>('All');
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editingVehicle, setEditingVehicle] = React.useState<Vehicle | null>(null);
  const [currentTab, setCurrentTab] = React.useState<'catalog' | 'dashboard' | 'settings'>('catalog');
  const [exportingId, setExportingId] = React.useState<string | null>(null);

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
   * Replaces a hardcoded line claiming vehicles with 360 walkarounds "sell 18%
   * faster on average" — no source, and TruInspect holds no sales data. It was
   * labelled Business Intelligence and shown to a dealer, who repeats it to a
   * customer, at which point it is their claim too.
   *
   * Framed around finishing an inspection rather than publishing: this app
   * produces the VIR, and an unsigned or half-answered one is the thing that
   * causes trouble later.
   */
  const fleet = React.useMemo(() => {
    const rows = vehicles.map(v => {
      const r = computeInspectionReadiness(v);
      const answered = Object.keys(v.inspectionChecklist || {}).length;
      const signed = !!(v.inspectorName && v.inspectorName.trim());
      return { v, r, answered, signed };
    });
    return {
      rows,
      needPhotos: rows.filter(({ r }) => r.missingRequired.length > 0)
        .sort((a, b) => a.r.missingRequired.length - b.r.missingRequired.length),
      needChecklist: rows.filter(({ r, answered }) => r.missingRequired.length === 0 && answered === 0),
      needSignoff: rows.filter(({ r, answered, signed }) => r.missingRequired.length === 0 && answered > 0 && !signed),
      complete: rows.filter(({ r, answered, signed }) => r.missingRequired.length === 0 && answered > 0 && signed).length,
      total: rows.length,
    };
  }, [vehicles]);

  /** One sentence, the most useful thing true right now. */
  const nextAction = React.useMemo(() => {
    if (fleet.total === 0) return { head: 'No vehicles yet', body: 'Add one to start an inspection.' };
    if (fleet.needPhotos.length > 0) {
      const n = fleet.needPhotos[0];
      const missing = n.r.missingRequired;
      const name = `${n.v.year} ${n.v.make} ${n.v.model}`.trim();
      return {
        head: `${fleet.needPhotos.length} ${fleet.needPhotos.length === 1 ? 'inspection is' : 'inspections are'} short of photos`,
        body: `Closest: ${name} — ${missing.length === 1 ? missing[0] : `${missing.length} shots, starting with ${missing[0]}`}.`,
      };
    }
    if (fleet.needChecklist.length > 0) {
      const name = `${fleet.needChecklist[0].v.year} ${fleet.needChecklist[0].v.make} ${fleet.needChecklist[0].v.model}`.trim();
      return {
        head: `${fleet.needChecklist.length} awaiting the checklist`,
        body: `Photos are done. Next: ${name}.`,
      };
    }
    if (fleet.needSignoff.length > 0) {
      const name = `${fleet.needSignoff[0].v.year} ${fleet.needSignoff[0].v.make} ${fleet.needSignoff[0].v.model}`.trim();
      return {
        head: `${fleet.needSignoff.length} unsigned`,
        body: `The VIR prints a blank signature block until an inspector is named. Next: ${name}.`,
      };
    }
    return { head: 'All inspections complete', body: `${fleet.total} signed off and ready to issue.` };
  }, [fleet]);

  // Settings state (persisted for VIR / share branding)
  const [dealershipName, setDealershipName] = React.useState(
    () => localStorage.getItem('trulens_dealer_name') || ''
  );
  const [branch, setBranch] = React.useState(
    () => localStorage.getItem('trulens_dealer_branch') || ''
  );
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
  const [dmsUrl, setDmsUrl] = React.useState(() =>
    localStorage.getItem('trulens_dms_url') || DEFAULT_DMS_URL
  );
  const [dmsPreset, setDmsPreset] = React.useState<'premium' | 'lite' | 'custom'>(() => {
    const saved = localStorage.getItem('trulens_dms_url') || DEFAULT_DMS_URL;
    if (saved.includes(':3002')) return 'lite';
    if (saved.includes(':3001') || saved === DEFAULT_DMS_URL) return 'premium';
    return 'custom';
  });
  const [dmsUrlSaved, setDmsUrlSaved] = React.useState(false);
  const [make, setMake] = React.useState('');
  const [model, setModel] = React.useState('');
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [trim, setTrim] = React.useState('');
  const [vin, setVin] = React.useState('');
  const [stockNumber, setStockNumber] = React.useState('');
  const [color, setColor] = React.useState('');
  const [price, setPrice] = React.useState(24995);
  const [vehicleType, setVehicleType] = React.useState('SUV');
  const [mileage, setMileage] = React.useState('');
  const [transmission, setTransmission] = React.useState<'Automatic' | 'Manual'>('Manual');
  const [fuelType, setFuelType] = React.useState<'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'>('Petrol');
  const [status, setStatus] = React.useState<'In-Progress' | 'Ready'>('In-Progress');

  /* Licence-disc scan — same component and parser as TruLens. An inspector
     standing at the windscreen has the disc in front of them; typing a 17-char
     VIN off it by hand is the slowest and most error-prone part of starting an
     inspection, and a wrong VIN is on the report for good. */
  const [scanningDisc, setScanningDisc] = React.useState(false);
  const [scanNote, setScanNote] = React.useState<string | null>(null);

  const applyDiscScan = (d: DiscScan) => {
    setScanningDisc(false);
    const titleCase = (v: string) =>
      v.toLowerCase().split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
    if (d.make) setMake(titleCase(d.make));
    if (d.model) setModel(titleCase(d.model));
    if (d.colour) setColor(titleCase(d.colour));
    if (d.vin) setVin(d.vin);
    if (d.year) setYear(d.year);
    const got = ['make', 'model', 'vin', 'year'].filter((k) => (d as any)[k]).length;
    setScanNote(
      got === 0
        ? "Couldn't read that disc — try again, or type the details in."
        : `Filled ${got} field${got > 1 ? 's' : ''} from the disc — check and adjust.`,
    );
    setTimeout(() => setScanNote(null), 5000);
  };

  // Generate mock VIN and Stock helpers
  const handleAutoGenerateData = () => {
    const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let mockVin = '1HGCR2F8';
    for (let i = 0; i < 9; i++) {
      mockVin += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    const mockStock = 'S' + Math.floor(100000 + Math.random() * 900000);
    setVin(mockVin);
    setStockNumber(mockStock);
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
    if (!make || !model) return;

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
        mileage: mileage.trim() ? Number(mileage) : undefined,
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
        vin: vin || 'VIN-PENDING-' + Math.floor(1000 + Math.random() * 9000),
        stockNumber: stockNumber || 'STK-' + Math.floor(10000 + Math.random() * 90000),
        color: color || 'Black',
        price: Number(price),
        vehicleType,
        mileage: mileage.trim() ? Number(mileage) : undefined,
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

  const applyDmsPreset = (preset: 'premium' | 'lite' | 'custom') => {
    setDmsPreset(preset);
    if (preset === 'premium' || preset === 'lite') {
      const url = DMS_PRESETS[preset].url;
      setDmsUrl(url);
      localStorage.setItem('trulens_dms_url', url);
      setDmsUrlSaved(true);
      setTimeout(() => setDmsUrlSaved(false), 2000);
    }
  };

  const saveDmsUrl = () => {
    const cleaned = dmsUrl.trim().replace(/\/$/, '') || DEFAULT_DMS_URL;
    setDmsUrl(cleaned);
    localStorage.setItem('trulens_dms_url', cleaned);
    if (cleaned.includes(':3002')) setDmsPreset('lite');
    else if (cleaned.includes(':3001')) setDmsPreset('premium');
    else setDmsPreset('custom');
    setDmsUrlSaved(true);
    setTimeout(() => setDmsUrlSaved(false), 2000);
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
        const parts = b
          ? [
              b.mainImages ? `${b.mainImages} main` : null,
              b.extras ? `${b.extras} extras` : null,
              b.damage ? `${b.damage} damage` : null,
              b.vin ? `${b.vin} VIN` : null,
              b.serviceBook ? `${b.serviceBook} service` : null,
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
        {/* Was a wordmark, a wide gap, and two buttons. The gap now carries the
            two things that matter on a yard phone: whose vehicles these are, and
            how much is left.

            The "Sync" button is gone. It was wired to fetchInventory — a local
            refetch, not a cloud sync — and TruInspect is standalone, so a cloud
            icon labelled Sync described something that never happened. */}
        <div className="font-display font-semibold text-[16px] tracking-tight shrink-0">
          <span className="text-neutral-200">Tru</span><span className="text-[#4FE3DC]">Inspect</span>
        </div>

        <div className="h-7 w-px bg-white/12 shrink-0" aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#E8EAE6] truncate leading-tight">
            {dealershipName}
          </div>
          <div className="text-[12px] text-neutral-400 leading-tight truncate">
            {fleet.total === 0
              ? 'No vehicles yet'
              : fleet.needPhotos.length > 0
                ? `${fleet.complete}/${fleet.total} signed off · ${fleet.needPhotos.length} need photos`
                : fleet.needSignoff.length > 0
                  ? `${fleet.complete}/${fleet.total} signed off · ${fleet.needSignoff.length} unsigned`
                  : `${fleet.complete}/${fleet.total} signed off`}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] transition-all cursor-pointer disabled:opacity-50"
            aria-label={user?.email ? `Sign out (${user.email})` : 'Sign out'}
            title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
          >
            {/* Was a red-bordered button labelled "Out". Red is reserved here for
                errors and destructive actions, and signing out is neither — it
                was the loudest thing in the header. "Out" is also not a word for
                this; the icon is, and Settings still carries a spelled-out
                "Log out" for anyone who wants the longer route. */}
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
              className="w-full bg-neutral-950 text-[13px] text-neutral-200 pl-9 pr-3 min-h-[44px] rounded-lg border border-neutral-850 focus:border-indigo-500 outline-none placeholder-neutral-500 font-mono"
            />
          </div>
          <button
            onClick={() => { setEditingVehicle(null); setShowAddForm(!showAddForm); }}
            aria-label={showAddForm ? (editingVehicle ? 'Close edit form' : 'Close new vehicle form') : 'Add a vehicle'}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 rounded-lg bg-trulens-purple hover:bg-trulens-purple/90 text-[#E8EAE6] shadow-md cursor-pointer transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>

        {scanningDisc && (
          <DiscScanner onResult={applyDiscScan} onClose={() => setScanningDisc(false)} />
        )}

        {/* Add vehicle Form Box */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-2 gap-2">
              <span className="text-[13px] font-bold text-neutral-300 flex items-center gap-2 shrink-0">
                {editingVehicle
                  ? <><Pencil size={14} className="text-trulens-purple" /> Edit vehicle</>
                  : <><Plus size={14} className="text-trulens-purple" /> New vehicle</>}
              </span>
              <button
                type="button"
                onClick={() => setScanningDisc(true)}
                className="flex items-center gap-2 text-[13px] font-semibold px-3 py-1 rounded-full bg-[#4FE3DC]/15 text-[#4FE3DC] border border-[#4FE3DC]/30 shrink-0"
              >
                <ScanLine size={12} /> Scan disc
              </button>
            </div>

            {scanNote && (
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] -mt-1">{scanNote}</p>
            )}

            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={handleAutoGenerateData}
                className="text-[13px] text-trulens-blue hover:text-trulens-blue/80 underline"
              >
                Auto-fill VIN &amp; stock
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Make *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Ford"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mustang"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Year</label>
                <input
                  type="number"
                  placeholder="2024"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
                />
              </div>
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Trim</label>
                <input
                  type="text"
                  placeholder="GT Premium"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Price (R)</label>
                <input
                  type="number"
                  placeholder="35000"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Stock #</label>
                <input
                  type="text"
                  placeholder="STK-10293"
                  value={stockNumber}
                  onChange={(e) => setStockNumber(e.target.value)}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
                />
              </div>
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Colour</label>
                <input
                  type="text"
                  placeholder="Magnetic Gray"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Vehicle type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
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
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'In-Progress' | 'Ready')}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                >
                  <option value="In-Progress">In-Progress</option>
                  <option value="Ready">Ready</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Mileage (km)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="e.g. 78400"
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Transmission</label>
                <select
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value as 'Automatic' | 'Manual')}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                >
                  <option value="Manual">Manual</option>
                  <option value="Automatic">Automatic</option>
                </select>
              </div>
              <div>
                <label className="text-[13px] text-neutral-400 font-bold block mb-1">Fuel</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric')}
                  className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[13px] text-neutral-400 font-bold block mb-1">VIN (17 characters)</label>
              <input
                type="text"
                placeholder="Auto-generate or enter VIN"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                className="w-full bg-neutral-900 text-[13px] px-2 py-2 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
              />
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
                className="flex-1 py-2 bg-trulens-purple hover:bg-trulens-purple/90 text-[#E8EAE6] rounded-lg text-[13px] font-bold cursor-pointer shadow-md flex items-center justify-center gap-1"
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

        {/* Filters — one scrolling row instead of two stacked ones.
            Two full-width rows of chips cost 109px and pushed the first vehicle
            below the fold. They are also two halves of the same question, so
            they read better side by side than stacked.

            Each chip carries its own count: the number is the reason you would
            tap it, and it is what the deleted stat grid was there to tell you. */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5">
            {([
              { id: 'All' as const, label: 'All' },
              { id: 'In-Progress' as const, label: 'In progress' },
              { id: 'Ready' as const, label: 'Ready' },
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
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[13px] font-semibold tracking-normal whitespace-nowrap border transition-colors cursor-pointer ${
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
                {searchTerm || activeFilter !== 'All' ? 'No matches' : 'No vehicles yet'}
              </p>
              <p className="text-[13px] text-neutral-500 mt-2 max-w-[220px] leading-relaxed">
                {searchTerm
                  ? `Nothing matched “${searchTerm}”. Clear search or add the unit to inspect.`
                  : 'Add a vehicle, take the guided shots, answer the checklist, then issue the report.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (searchTerm || activeFilter !== 'All') {
                    setSearchTerm('');
                                  setActiveFilter('All');
                    setDeepLinkBanner(null);
                  } else {
                    setShowAddForm(true);
                  }
                }}
                className="mt-4 px-4 py-2 rounded-xl tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] text-[13px] font-semibold tracking-normal flex items-center gap-2"
              >
                <Plus size={12} />{' '}
                {searchTerm || activeFilter !== 'All' ? 'Clear filters' : 'Add first vehicle'}
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
              const readiness = computeInspectionReadiness(vehicle);
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
                            className="text-[13px] font-mono bg-neutral-900 px-2 min-h-[36px] rounded text-neutral-400 border border-neutral-800 hover:border-indigo-500/50 hover:text-indigo-300 flex items-center gap-2"
                            title="Copy stock number"
                          >
                            {vehicle.stockNumber}
                            {copiedStockId === vehicle.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          {/* The vehicle.status chip stood here. It is a field somebody
                              sets by hand, while the chip beside it is derived from the
                              photos, score, checklist and signature actually on the
                              record — so the two drifted apart and one card was showing
                              "Capturing" next to "VIR issued" at the same time. On
                              TruLens the pair read "Capturing" and "Capture in progress",
                              which is the same sentence twice.

                              status still drives the filter row above, where it is the
                              user's own label and belongs. On the card, the derived
                              stage is the one that cannot be wrong. */}
                          {vehicle.inspectionChecklist && Object.keys(vehicle.inspectionChecklist).length > 0 && (
                            <span className="text-[13px] font-bold px-2 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                              Checklist {Object.keys(vehicle.inspectionChecklist).length}
                            </span>
                          )}
                          <span
                            className="text-[13px] font-bold px-2 py-0.5 rounded border"
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
                        className="flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 text-neutral-600 hover:text-[#4FE3DC] rounded hover:bg-neutral-900 cursor-pointer"
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
                        className="flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 text-neutral-600 hover:text-red-400 rounded hover:bg-neutral-900 cursor-pointer"
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
                        {/* Was "Required Guide Completion: 7 of 19 (37%)" directly
                            under a chip already reading "Photos 7/19" — the same
                            fact twice, once in product vocabulary and once in
                            plain numbers. The chip keeps the count; this line
                            keeps the percentage the bar is drawing. */}
                        <span>Required photos</span>
                        <span className="font-bold text-neutral-200">
                          {Math.round((requiredTaken / totalRequired) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                            requiredTaken === totalRequired ? 'bg-emerald-500' : 'bg-indigo-500'
                          } ${requiredTaken > 0 && requiredTaken < totalRequired ? 'tl-progress-sheen' : ''}`}
                          style={{ width: `${Math.round((requiredTaken / totalRequired) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Four buttons, always the same four: Inspect and Trade-In are
                        the two ways to work a vehicle (photo capture is the first
                        step inside each, not a separate button competing with
                        them); VIR and Trade-In Report are the two documents that
                        come out the other end. Both report buttons are always
                        present — each opens straight to its report's own
                        not-started state (same pattern the VIR already used at
                        0/23 photos) rather than appearing/disappearing as work
                        progresses. */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(vehicle)}
                        className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[#E8EAE6] tl-btn-3d bg-indigo-600 hover:bg-indigo-500 cursor-pointer min-h-[44px] rounded-lg border border-indigo-400/40 transition-colors shadow-sm"
                        title="Inspect — capture the shot list, then rate condition and check function"
                      >
                        <Camera size={12} /> Inspect
                      </button>

                      {onOpenTradeIn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenTradeIn(vehicle); }}
                          title="Trade-in appraisal — 27-step walk-around with valuation"
                          className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer bg-emerald-500/10 min-h-[44px] rounded-lg border border-emerald-500/25 transition-colors"
                        >
                          <BarChart3 size={12} /> Trade-In
                          {vehicle.tradeInData && <span className="ml-0.5 text-[12px]">✓</span>}
                        </button>
                      )}

                      {onViewReport && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewReport(vehicle); }}
                          title="Vehicle Inspection Report"
                          className="on-fill flex items-center justify-center gap-1.5 text-[13px] font-bold cursor-pointer min-h-[44px] rounded-lg transition-colors shadow-sm"
                          style={{ background: 'linear-gradient(120deg, #7FF0EA, #4FE3DC)' }}
                        >
                          <FileText size={12} /> VIR
                        </button>
                      )}

                      {onViewTradeInReport && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewTradeInReport(vehicle); }}
                          title="Trade-In Appraisal Report"
                          className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer bg-emerald-500/10 min-h-[44px] rounded-lg border border-emerald-500/25 transition-colors"
                        >
                          <BarChart3 size={12} /> TIR
                        </button>
                      )}
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
            {/* Dashboard Heading & Revenue Overview */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-indigo-400" />
                  <span className="text-[13px] font-bold text-neutral-200 tracking-normal">Dashboard</span>
                </div>
                <p className="text-[13px] text-neutral-500 mt-0.5">Photography, inspections & trade-in appraisals</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[13px] font-bold text-emerald-400">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'Ready' || v.status === 'Listed' ? v.price : 0), 0).toLocaleString()} Ready
                </span>
                <span className="text-[13px] text-neutral-500">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'In-Progress' ? v.price : 0), 0).toLocaleString()} Pending
                </span>
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[13px] text-neutral-500  font-bold">Catalogue</span>
                <span className="text-[16px] font-semibold text-[#E8EAE6]">{vehicles.length}</span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[13px] text-emerald-500  font-bold">Ready</span>
                <span className="text-[16px] font-semibold text-emerald-400">{vehicles.filter(v => v.status === 'Ready' || v.status === 'Listed').length}</span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[13px] text-amber-500  font-bold">Pending</span>
                <span className="text-[16px] font-semibold text-amber-400">{vehicles.filter(v => v.status === 'In-Progress').length}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[13px] text-indigo-500  font-bold">Capture rate</span>
                <span className="text-[16px] font-semibold text-indigo-400">
                  {Math.round((vehicles.reduce((acc, v) => acc + Object.keys(v.photos || {}).length, 0) / (vehicles.length * DEFAULT_TEMPLATE.slots.length || 1)) * 100)}%
                </span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-emerald-800/40 flex flex-col justify-between h-16">
                <span className="text-[13px] text-emerald-500  font-bold">Trade-Ins</span>
                <span className="text-[16px] font-semibold text-emerald-400">{vehicles.filter(v => v.tradeInData).length}</span>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-2 gap-2">
              {/* Readiness */}
              <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[13px] font-bold text-neutral-400  mb-2">Readiness</span>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Ready', value: vehicles.filter(v => v.status === 'Ready' || v.status === 'Listed').length },
                          { name: 'In-Progress', value: vehicles.filter(v => v.status === 'In-Progress').length }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', fontSize: '13px', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[13px] text-neutral-500 font-bold ">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Ready</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"/> Pending</span>
                </div>
              </div>

              {/* Weekly Capture Volume */}
              <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[13px] font-bold text-neutral-400  mb-2">Weekly activity</span>
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
              {/* "Attention Required" and "Action Needed" side by side said the
                  same thing twice and neither said what to do. The heading now
                  names the work; the count is the urgency. */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-[#E8EAE6]">Still to shoot</span>
                <span className="text-[13px] text-amber-400 font-semibold">
                  {vehicles.filter(v => v.status === 'In-Progress').length}
                </span>
              </div>
              <div className="space-y-2">
                {vehicles.filter(v => v.status === 'In-Progress').length === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-[13px] text-neutral-500 font-medium">All clear! Your inventory is fully documented.</p>
                  </div>
                ) : (
                  vehicles.filter(v => v.status === 'In-Progress').slice(0, 3).map(v => {
                    const missingCount = DEFAULT_TEMPLATE.slots.filter(s => s.required && !(v.photos || {})[s.id]).length;
                    return (
                      <div key={v.id} className="flex items-center justify-between p-2 bg-neutral-900/40 rounded-lg border border-neutral-850/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-amber-500/10 flex items-center justify-center">
                            <Car size={12} className="text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-neutral-200">{v.year} {v.make}</p>
                            <p className="text-[13px] text-neutral-500">Missing {missingCount} required shots</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onSelectVehicle(v)}
                          className="text-[13px] font-bold text-indigo-400 hover:text-indigo-300"
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
                        style={{ width: `${Math.round((fleet.complete / fleet.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-mono text-neutral-400 shrink-0">
                      {fleet.complete}/{fleet.total} signed off
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
              <span className="text-[13px] font-bold text-neutral-200 tracking-normal">Organisation settings</span>
            </div>

            {/* Profile Section */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40">
                <span className="text-[13px] font-bold text-neutral-400 ">Organisation profile</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[13px] text-neutral-500  font-bold">Organisation name</label>
                  <input 
                    type="text" 
                    value={dealershipName}
                    onChange={(e) => setDealershipName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-[#E8EAE6] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] text-neutral-500  font-bold">Branch</label>
                  <input 
                    type="text" 
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-[#E8EAE6] focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                <span className="text-[13px] font-bold text-neutral-400 ">Capture quality</span>
                <Camera size={11} className="text-cyan-400" />
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[13px] font-bold text-neutral-200">Minimum photo quality</p>
                    <span className="text-[13px] font-mono text-cyan-400 font-bold">{aiThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="98"
                    value={aiThreshold}
                    onChange={(e) => setAiThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <p className="text-[13px] text-neutral-500 leading-relaxed italic">
                    Photos that come out too dark or blurry to below this level get flagged for a re-take, so every shot on the report is clear.
                  </p>
                </div>
              </div>
            </div>

            {/* Trade-In Margin */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40 flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-400">Trade-in margin</span>
                <BarChart3 size={11} className="text-emerald-400" />
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[13px] font-bold text-neutral-200">Dealer margin %</p>
                  <span className="text-[13px] font-mono text-emerald-400 font-bold">
                    {Number(localStorage.getItem('trulens_margin_pct')) || 15}%
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={Number(localStorage.getItem('trulens_margin_pct')) || 15}
                  onChange={(e) => localStorage.setItem('trulens_margin_pct', String(Math.max(0, Math.min(100, Number(e.target.value) || 15))))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-[#E8EAE6] focus:outline-none focus:border-emerald-500/40"
                />
                <p className="text-[13px] text-neutral-500 leading-relaxed italic">
                  Applied to trade-in valuations. Hidden from customer-facing exports.
                </p>
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
                  localStorage.setItem('trulens_dealer_wa', dealerWhatsApp);
                  localStorage.setItem('trulens_currency', currency);
                  localStorage.setItem('trulens_ai_threshold', String(aiThreshold));
                  localStorage.setItem('trulens_dms_url', dmsUrl);
                  setDmsUrlSaved(true);
                  setExportToast({ type: 'ok', text: 'Settings saved on this device (used in VIR & WhatsApp)' });
                  setTimeout(() => setExportToast(null), 2800);
                  setTimeout(() => setDmsUrlSaved(false), 1600);
                }}
                className="w-full tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] font-bold py-3 rounded-xl text-[13px] transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                Save Configuration
              </button>

              {/* The install banner is dismissible and only shows when the
                  browser volunteers the prompt, so this is the only reliable
                  way back to installing once it has been closed. */}
              <InstallAppButton />

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                <div className="text-[13px] tracking-normal text-red-300/80 font-bold">Session</div>
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  {isDemo
                    ? 'Signed in as demo inspector (offline). Log out returns to the login screen.'
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
          { id: 'settings' as const, label: 'Settings', Icon: Settings, title: 'Organisation settings' },
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
