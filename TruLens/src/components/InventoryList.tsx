import React from 'react';
import {
  Car, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  Trash2, Cloud, Sparkles, FolderOpen, Image as ImageIcon, ArrowRight, Download,
  BarChart3, Palette, Copy, Check, Award, Lightbulb, BookOpen, Sliders, ExternalLink,
  FileText, Settings, Camera, LogOut
} from 'lucide-react';
import trulensLogo from '../assets/images/trulens-lockup.png';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Vehicle, PHOTO_SLOTS, DmsExportResult } from '../types';
import { computeWebReadiness, isStructurallyWebReady } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';

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
  
  // Settings state (persisted for VIR / share branding)
  const [dealershipName, setDealershipName] = React.useState(
    () => localStorage.getItem('trulens_dealer_name') || 'TruLens South Africa'
  );
  const [branch, setBranch] = React.useState(
    () => localStorage.getItem('trulens_dealer_branch') || 'Johannesburg Central'
  );
  /** Which dealership newly-exported vehicles get tagged to in the DMS —
      must match a slug the DMS's public website feed knows how to isolate.
      A phone used on Caledon's floor should be set to "cars-on-caledon" so
      captures never default to (and leak onto) MKR's site. */
  const [dealerSlug, setDealerSlug] = React.useState(
    () => localStorage.getItem('trulens_dealer_slug') || 'mkr-autosales'
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
  const [status, setStatus] = React.useState<'In-Progress' | 'Ready'>('In-Progress');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make || !model) return;
    
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
      status
    });

    // Reset form
    setMake('');
    setModel('');
    setYear(new Date().getFullYear());
    setTrim('');
    setVin('');
    setStockNumber('');
    setColor('');
    setPrice(24995);
    setVehicleType('SUV');
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
      <div className="tl-glass p-4 border-b border-cyan-500/20 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <img src={trulensLogo} alt="TruLens" className="h-8 w-auto object-contain tl-float drop-shadow-[0_0_10px_rgba(79,227,220,0.30)]" />
        </div>

        {/* Flow DMS, sync & log out */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => window.open(dmsUrl || DEFAULT_DMS_URL, '_blank')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4FE3DC] hover:bg-[#7FF0EA] border border-transparent text-[12px] text-[#06080D] font-semibold tracking-normal transition-colors cursor-pointer"
            title={`Open TruFlow DMS (${dmsUrl || DEFAULT_DMS_URL})`}
          >
            <ExternalLink size={10} />
            <span className="hidden sm:inline">TruFlow</span>
          </button>
          <button 
            onClick={onForceSync}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[13px] text-neutral-300 transition-colors cursor-pointer"
            title="Force Cloud Sync"
          >
            {getSyncIcon()}
            <span className="font-mono hidden xs:inline">
              {syncStatus === 'syncing' ? '…' : syncStatus === 'error' ? 'Err' : 'Sync'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[12px] text-red-300 font-semibold tracking-normal transition-all cursor-pointer disabled:opacity-50"
            title={user?.email ? `Log out (${user.email})` : 'Log out of TruLens'}
          >
            <LogOut size={11} />
            {loggingOut ? '…' : 'Out'}
          </button>
        </div>
      </div>

      {/* Tab Switcher — equal tabs so Settings is not mistaken for a camera FAB */}
      <div className="flex bg-black/40 p-1.5 border-b border-cyan-500/15 shrink-0 gap-1 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setCurrentTab('catalog')}
          className={`flex-1 py-2 text-[13px] tracking-normal font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            currentTab === 'catalog'
              ? 'tl-glass text-trulens-purple shadow-lg shadow-[#4FE3DC]/20 border border-trulens-purple/40'
              : 'text-neutral-400 hover:text-neutral-200 border border-transparent hover:bg-white/5'
          }`}
        >
          <FolderOpen size={12} />
          Catalogue
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('dashboard')}
          className={`flex-1 py-2 text-[13px] tracking-normal font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            currentTab === 'dashboard'
              ? 'tl-glass text-trulens-blue shadow-lg shadow-[#4D9BFF]/20 border border-trulens-blue/40'
              : 'text-neutral-400 hover:text-neutral-200 border border-transparent hover:bg-white/5'
          }`}
        >
          <BarChart3 size={12} />
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('settings')}
          className={`flex-1 py-2 text-[13px] tracking-normal font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            currentTab === 'settings'
              ? 'tl-glass text-[#E8EAE6] shadow-lg border border-neutral-500/40'
              : 'text-neutral-400 hover:text-neutral-200 border border-transparent hover:bg-white/5'
          }`}
          title="Dealership & DMS settings"
        >
          <Settings size={12} />
          Settings
        </button>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-neutral-950/40 border-b border-neutral-850 shrink-0">
        <div className="bg-neutral-950/70 p-2 rounded-lg border border-neutral-800/60 flex flex-col">
          <span className="text-[12px] text-neutral-400  font-bold tracking-wider">Total Catalogue</span>
          <span className="text-base font-semibold text-[#E8EAE6] mt-0.5">{vehicles.length}</span>
        </div>
        <div className="bg-neutral-950/70 p-2 rounded-lg border border-neutral-800/60 flex flex-col">
          <span className="text-[12px] text-amber-400  font-bold tracking-wider">Shooting</span>
          <span className="text-base font-semibold text-amber-400 mt-0.5">
            {vehicles.filter(v => v.status === 'In-Progress').length}
          </span>
        </div>
        <div className="bg-neutral-950/70 p-2 rounded-lg border border-neutral-800/60 flex flex-col">
          <span className="text-[12px] text-emerald-400  font-bold tracking-wider">Ready (Web)</span>
          <span className="text-base font-semibold text-emerald-400 mt-0.5">
            {vehicles.filter(v => v.status === 'Ready' || v.status === 'Listed').length}
          </span>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
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
              className="w-full bg-neutral-950 text-xs text-neutral-200 pl-8 pr-3 py-2 rounded-lg border border-neutral-850 focus:border-indigo-500 outline-none placeholder-neutral-500 font-mono"
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-2 rounded-lg bg-trulens-purple hover:bg-trulens-purple/90 text-[#E8EAE6] shadow-md cursor-pointer transition-transform"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Add Vehicle Form Box */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3.5 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-1.5">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <Plus size={14} className="text-trulens-purple" /> New Inventory Vehicle
              </span>
              <button 
                type="button" 
                onClick={handleAutoGenerateData} 
                className="text-[12px] text-trulens-blue hover:text-trulens-blue/80 underline"
              >
                Auto-Fill VIN & Stock
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Make *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Ford"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mustang"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Year</label>
                <input
                  type="number"
                  placeholder="2024"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
                />
              </div>
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Trim</label>
                <input
                  type="text"
                  placeholder="GT Premium"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Price (R)</label>
                <input
                  type="number"
                  placeholder="35000"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Stock #</label>
                <input
                  type="text"
                  placeholder="STK-10293"
                  value={stockNumber}
                  onChange={(e) => setStockNumber(e.target.value)}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
                />
              </div>
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Color</label>
                <input
                  type="text"
                  placeholder="Magnetic Gray"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
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
                <label className="text-[12px] text-neutral-400 font-bold block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'In-Progress' | 'Ready')}
                  className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple"
                >
                  <option value="In-Progress">In-Progress</option>
                  <option value="Ready">Ready</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[12px] text-neutral-400 font-bold block mb-1">VIN (17 characters)</label>
              <input
                type="text"
                placeholder="Auto-generate or enter VIN"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                className="w-full bg-neutral-900 text-xs px-2 py-1.5 rounded border border-neutral-800 text-[#E8EAE6] outline-none focus:border-trulens-purple font-mono"
              />
            </div>

            <div className="flex gap-2 pt-1 border-t border-neutral-850">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-trulens-purple hover:bg-trulens-purple/90 text-[#E8EAE6] rounded-lg text-xs font-bold cursor-pointer shadow-md flex items-center justify-center gap-1"
              >
                <Plus size={14} /> Add Vehicle
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
              <p className="text-[12px] font-semibold tracking-normal text-cyan-300">Opened from Flow</p>
              <p className="text-[13px] text-neutral-200 mt-0.5 font-mono truncate">{deepLinkBanner}</p>
            </div>
            <button
              type="button"
              onClick={() => { setDeepLinkBanner(null); setHighlightStock(null); setSearchTerm(''); }}
              className="text-[12px] font-bold text-cyan-300 hover:text-[#E8EAE6] shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Filters Panel */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-850">
          {(['All', 'In-Progress', 'Ready', 'Listed'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex-1 text-center py-1.5 rounded-md text-[13px] font-bold tracking-normal cursor-pointer transition-all ${
                activeFilter === filter
                  ? 'bg-neutral-800 text-indigo-400 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Readiness quick filter — useful for "what still needs a shoot?" */}
        <div className="flex items-center gap-1.5">
          {([
            { id: 'ALL' as const, label: 'All readiness' },
            { id: 'NEEDS' as const, label: 'Needs shots' },
            { id: 'READY' as const, label: 'Web-ready' },
          ]).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setReadinessFilter(f.id)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold tracking-normal border transition-all ${
                readinessFilter === f.id
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Vehicles Inventory List */}
        <div className="space-y-2.5 pb-4">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-10 bg-gradient-to-b from-neutral-950/80 to-neutral-900/40 rounded-xl border border-dashed border-indigo-500/20 flex flex-col items-center justify-center p-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                <Camera size={22} className="text-indigo-400" />
              </div>
              <p className="text-sm text-[#E8EAE6] font-bold">
                {searchTerm || readinessFilter !== 'ALL' || activeFilter !== 'All' ? 'No matches' : 'No vehicles yet'}
              </p>
              <p className="text-[13px] text-neutral-500 mt-1.5 max-w-[220px] leading-relaxed">
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
                className="mt-4 px-4 py-2 rounded-xl tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] text-[13px] font-semibold tracking-normal flex items-center gap-1.5"
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
              const totalCount = PHOTO_SLOTS.length;
              const requiredTaken = PHOTO_SLOTS.filter(s => s.required && !!photos[s.id]).length;
              const totalRequired = PHOTO_SLOTS.filter(s => s.required).length;
              const readiness = computeWebReadiness(vehicle);
              const thumb = typeof photos.front_3_4 === 'string' && photos.front_3_4.startsWith('data:')
                ? photos.front_3_4
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
                    <div className="flex items-start gap-2.5">
                      {/* Photo Preview Miniature Thumbnail or Car icon */}
                      <div className="w-12 h-12 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {thumb ? (
                          <img 
                            src={thumb} 
                            alt="Front 3/4" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Car size={20} className="text-neutral-600" />
                        )}
                        <span className="absolute bottom-0 right-0 bg-black/80 px-1 text-[12px] font-mono font-bold text-neutral-300">
                          {takenCount}/{totalCount}
                        </span>
                      </div>

                      {/* Details */}
                      <div>
                        <h3 className="text-xs font-bold text-[#E8EAE6] flex items-center gap-1">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                          {isHighlighted && (
                            <span className="text-[12px] font-semibold tracking-normal text-cyan-300 bg-cyan-500/20 border border-cyan-500/40 px-1.5 py-0.5 rounded">
                              From Flow
                            </span>
                          )}
                        </h3>
                        <p className="text-[13px] text-neutral-400 font-medium mt-0.5">
                          {vehicle.trim || 'Standard Trim'} • <span className="text-neutral-300">R {priceLabel}</span>
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (vehicle.stockNumber) copyStockNumber(vehicle.stockNumber, vehicle.id);
                            }}
                            className="text-[12px] font-mono bg-neutral-900 px-1.5 py-0.5 rounded text-neutral-400 border border-neutral-800 hover:border-indigo-500/50 hover:text-indigo-300 flex items-center gap-1"
                            title="Copy stock number"
                          >
                            STK {vehicle.stockNumber}
                            {copiedStockId === vehicle.id ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                          </button>
                          <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded border ${
                            vehicle.status === 'Listed'
                              ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                              : vehicle.status === 'Ready' 
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          }`}>
                            {vehicle.status === 'Listed'
                              ? 'In DMS'
                              : vehicle.status === 'Ready'
                              ? 'Ready for Web'
                              : 'Capture Mode'}
                          </span>
                          {vehicle.lastDmsExportAt && (
                            <span className="text-[7px] text-neutral-500 font-mono" title={vehicle.lastDmsExportAt}>
                              Exported {new Date(vehicle.lastDmsExportAt).toLocaleDateString()}
                            </span>
                          )}
                          <span
                            className="text-[7px] font-bold px-1.5 py-0.5 rounded border"
                            style={{ color: readiness.color, borderColor: readiness.color + '40', background: readiness.color + '14' }}
                            title={readiness.reasons.join(' · ') || readiness.label}
                          >
                            {readiness.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete action */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove ${vehicle.year} ${vehicle.make} from Catalogue inventory?`)) {
                          onDeleteVehicle(vehicle.id);
                        }
                      }}
                      className="p-1 text-neutral-600 hover:text-red-400 rounded hover:bg-neutral-900 cursor-pointer"
                      title="Delete Listing"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Progress Indicators */}
                  <div className="mt-1 pt-2 border-t border-neutral-900 flex flex-col gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[12px] text-neutral-400 mb-1 font-mono">
                        <span>Required Guide Completion:</span>
                        <span className="font-bold text-neutral-200">
                          {requiredTaken} of {totalRequired} ({Math.round((requiredTaken / totalRequired) * 100)}%)
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

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(vehicle)}
                        className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 text-[13px] font-semibold  tracking-wide text-[#E8EAE6] tl-btn-3d bg-indigo-600 hover:bg-indigo-500 cursor-pointer whitespace-nowrap px-2 py-2 rounded-lg border border-indigo-400/40 transition-colors shadow-sm"
                        title="Open camera guide and take pictures"
                      >
                        <Camera size={12} /> Take pictures
                      </button>

                      {takenCount > 0 && (
                        <button
                          onClick={(e) => handleExportClick(e, vehicle)}
                          disabled={exportingId === vehicle.id || !onExportToDms}
                          title={`Push ${takenCount} photos to TruFlow DMS (match by stock #)`}
                          className="flex items-center gap-1 text-[13px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer whitespace-nowrap bg-emerald-500/10 px-2 py-1.5 rounded border border-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          {exportingId === vehicle.id ? (
                            <>
                              <RefreshCw size={10} className="animate-spin" /> Exporting…
                            </>
                          ) : (
                            <>
                              Export to DMS <Download size={10} />
                            </>
                          )}
                        </button>
                      )}

                      {takenCount > 0 && onViewReport && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewReport(vehicle);
                          }}
                          title="Open inspection report with score, findings & damage photos"
                          className="flex items-center justify-center gap-1 text-[13px] font-bold text-[#E8EAE6] cursor-pointer whitespace-nowrap px-2 py-1.5 rounded transition-colors shadow-sm"
                          style={{ background: 'linear-gradient(120deg, #4FE3DC, #4FE3DC)' }}
                        >
                          Report <FileText size={10} />
                        </button>
                      )}

                      {onUpdateVehicle && isStructurallyWebReady(vehicle) && (
                        <button
                          type="button"
                          disabled={publishingId === vehicle.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setPublishingId(vehicle.id);
                            const nextShow = !vehicle.showOnWebsite;
                            const saved = await onUpdateVehicle(vehicle, {
                              showOnWebsite: nextShow,
                              status: nextShow && vehicle.status === 'In-Progress' ? 'Ready' : vehicle.status,
                              dealerName: dealershipName,
                              dealerWhatsApp: dealerWhatsApp || vehicle.dealerWhatsApp,
                            });
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
                              : 'One-tap publish to dealer website stock feed'
                          }
                          className={`flex items-center gap-1 text-[13px] font-bold cursor-pointer whitespace-nowrap px-2 py-1.5 rounded border transition-colors disabled:opacity-50 ${
                            vehicle.showOnWebsite
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25'
                              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25 hover:bg-cyan-500/20'
                          }`}
                        >
                          {publishingId === vehicle.id ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <ExternalLink size={10} />
                          )}
                          {vehicle.showOnWebsite ? 'On web · Unpublish' : 'Publish to web'}
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
                <div className="flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-indigo-400" />
                  <span className="text-xs font-bold text-neutral-200 tracking-normal">Inventory Dashboard</span>
                </div>
                <p className="text-[12px] text-neutral-500 mt-0.5">Real-time photography & readiness audit</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[13px] font-bold text-emerald-400">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'Ready' ? v.price : 0), 0).toLocaleString()} Ready
                </span>
                <span className="text-[12px] text-neutral-500">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'In-Progress' ? v.price : 0), 0).toLocaleString()} Pending
                </span>
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[7px] text-neutral-500  font-bold">Catalogue</span>
                <span className="text-sm font-semibold text-[#E8EAE6]">{vehicles.length}</span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[7px] text-emerald-500  font-bold">Ready</span>
                <span className="text-sm font-semibold text-emerald-400">{vehicles.filter(v => v.status === 'Ready').length}</span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[7px] text-amber-500  font-bold">Pending</span>
                <span className="text-sm font-semibold text-amber-400">{vehicles.filter(v => v.status === 'In-Progress').length}</span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-neutral-850 flex flex-col justify-between h-16">
                <span className="text-[7px] text-indigo-500  font-bold">Capture Rate</span>
                <span className="text-sm font-semibold text-indigo-400">
                  {Math.round((vehicles.reduce((acc, v) => acc + Object.keys(v.photos || {}).length, 0) / (vehicles.length * PHOTO_SLOTS.length || 1)) * 100)}%
                </span>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-2 gap-2">
              {/* Readiness Distribution */}
              <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[12px] font-bold text-neutral-400  mb-2">Readiness Distribution</span>
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
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', fontSize: '9px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[12px] text-neutral-500 font-bold ">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Ready</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"/> Pending</span>
                </div>
              </div>

              {/* Weekly Capture Volume */}
              <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[12px] font-bold text-neutral-400  mb-2">Weekly Activity</span>
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
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 7, fill: '#737373' }} />
                      <YAxis hide />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', fontSize: '9px' }}
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
                <span className="text-[12px] font-bold text-neutral-400 ">Attention Required</span>
                <span className="text-[12px] text-amber-500 font-bold">Action Needed</span>
              </div>
              <div className="space-y-1.5">
                {vehicles.filter(v => v.status === 'In-Progress').length === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-[12px] text-neutral-500 font-medium">All clear! Your inventory is fully documented.</p>
                  </div>
                ) : (
                  vehicles.filter(v => v.status === 'In-Progress').slice(0, 3).map(v => {
                    const missingCount = PHOTO_SLOTS.filter(s => s.required && !(v.photos || {})[s.id]).length;
                    return (
                      <div key={v.id} className="flex items-center justify-between p-2 bg-neutral-900/40 rounded-lg border border-neutral-850/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-amber-500/10 flex items-center justify-center">
                            <Car size={12} className="text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-neutral-200">{v.year} {v.make}</p>
                            <p className="text-[12px] text-neutral-500">Missing {missingCount} required shots</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onSelectVehicle(v)}
                          className="text-[12px] font-bold text-indigo-400 hover:text-indigo-300"
                        >
                          Complete →
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Operational Efficiency Card */}
            <div className="bg-indigo-950/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Lightbulb size={14} />
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-[12px] font-semibold text-indigo-300  tracking-tighter">Business Intelligence</span>
                <p className="text-[13px] text-indigo-200 leading-tight">
                  Vehicles with <strong>360° Walkarounds</strong> and <strong>complete interior sets</strong> sell 18% faster on average. You currently have {vehicles.filter(v => (v.photos || {})['video_360']).length} walkarounds active.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-6 animate-in slide-in-from-right-4 duration-500">
            {/* Settings Heading */}
            <div className="flex items-center gap-1.5">
              <Sliders size={15} className="text-indigo-400" />
              <span className="text-xs font-bold text-neutral-200 tracking-normal">Dealership Settings</span>
            </div>

            {/* Profile Section */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40">
                <span className="text-[13px] font-bold text-neutral-400 ">Dealership Profile</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] text-neutral-500  font-bold">Dealership Name</label>
                  <input 
                    type="text" 
                    value={dealershipName}
                    onChange={(e) => setDealershipName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#E8EAE6] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] text-neutral-500  font-bold">Active Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#E8EAE6] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] text-neutral-500  font-bold">Dealership (DMS tagging)</label>
                  <select
                    value={dealerSlug}
                    onChange={(e) => setDealerSlug(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#E8EAE6] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="mkr-autosales">MKR Auto Sales</option>
                    <option value="cars-on-caledon">Cars on Caledon</option>
                  </select>
                  <p className="text-[12px] text-neutral-600 leading-relaxed">
                    This phone's captures export to the DMS tagged to this dealer — keeps every dealer's stock on their own website only.
                  </p>
                </div>
              </div>
            </div>

            {/* DMS Integration — Premium or Lite */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-neutral-850 bg-neutral-900/40 flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-400 ">TruFlow DMS Export Target</span>
                <ExternalLink size={12} className="text-indigo-400" />
              </div>
              <div className="p-4 space-y-3">
                <p className="text-[12px] text-neutral-500 leading-relaxed">
                  <strong className="text-neutral-300">Export to DMS</strong> pushes photos via{' '}
                  <span className="font-mono text-neutral-400">/api/sync/push-photos</span>.
                  Match by stock number; missing stock is created automatically.
                </p>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyDmsPreset('premium')}
                    className={`py-2 px-1 rounded-lg text-[12px] font-bold border cursor-pointer ${
                      dmsPreset === 'premium'
                        ? 'bg-indigo-600 border-indigo-500 text-[#E8EAE6]'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-[#E8EAE6]'
                    }`}
                  >
                    Premium
                    <span className="block text-[7px] font-mono opacity-70 mt-0.5">:3001</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDmsPreset('lite')}
                    className={`py-2 px-1 rounded-lg text-[12px] font-bold border cursor-pointer ${
                      dmsPreset === 'lite'
                        ? 'bg-emerald-600 border-emerald-500 text-[#E8EAE6]'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-[#E8EAE6]'
                    }`}
                  >
                    Lite
                    <span className="block text-[7px] font-mono opacity-70 mt-0.5">:3002</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDmsPreset('custom')}
                    className={`py-2 px-1 rounded-lg text-[12px] font-bold border cursor-pointer ${
                      dmsPreset === 'custom'
                        ? 'bg-neutral-700 border-neutral-600 text-[#E8EAE6]'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-[#E8EAE6]'
                    }`}
                  >
                    Custom
                    <span className="block text-[7px] font-mono opacity-70 mt-0.5">URL</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] text-neutral-500  font-bold">DMS Base URL</label>
                  <input
                    type="url"
                    value={dmsUrl}
                    onChange={(e) => {
                      setDmsUrl(e.target.value);
                      setDmsPreset('custom');
                    }}
                    placeholder="http://localhost:3002"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#E8EAE6] font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveDmsUrl}
                    className="flex-1 py-2 tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] rounded-lg text-[13px] font-bold cursor-pointer"
                  >
                    {dmsUrlSaved ? 'Saved ✓' : 'Save DMS target'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(dmsUrl || DEFAULT_DMS_URL, '_blank')}
                    className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-[13px] font-bold cursor-pointer"
                    title="Open DMS in browser"
                  >
                    Open
                  </button>
                </div>
                <p className="text-[12px] text-neutral-600 leading-relaxed">
                  Ports: TruLens <span className="text-neutral-400">3000</span> · Premium{' '}
                  <span className="text-neutral-400">3001</span> · Lite{' '}
                  <span className="text-neutral-400">3002</span>
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
                    <p className="text-xs font-bold text-neutral-200">Currency Preference</p>
                    <p className="text-[12px] text-neutral-500">Global display currency for valuations</p>
                  </div>
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-[#E8EAE6]"
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
                    <p className="text-xs font-bold text-neutral-200">AI Quality Threshold</p>
                    <span className="text-xs font-mono text-indigo-400 font-bold">{aiThreshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="98" 
                    value={aiThreshold}
                    onChange={(e) => setAiThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[12px] text-neutral-500 leading-relaxed italic">
                    Images scoring below this threshold will be flagged for immediate re-capture. Higher thresholds ensure "Perfect" listings but may require more capture attempts.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Management */}
            <div className="pt-2 space-y-2">
              <label className="block space-y-1">
                <span className="text-[12px] tracking-normal text-neutral-500 font-bold">WhatsApp sales number</span>
                <input
                  value={dealerWhatsApp}
                  onChange={(e) => setDealerWhatsApp(e.target.value)}
                  placeholder="+27 …"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-[#E8EAE6]"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('trulens_dealer_name', dealershipName);
                  localStorage.setItem('trulens_dealer_branch', branch);
                  localStorage.setItem('trulens_dealer_slug', dealerSlug);
                  localStorage.setItem('trulens_dealer_wa', dealerWhatsApp);
                  localStorage.setItem('trulens_currency', currency);
                  localStorage.setItem('trulens_ai_threshold', String(aiThreshold));
                  localStorage.setItem('trulens_dms_url', dmsUrl);
                  setDmsUrlSaved(true);
                  setExportToast({ type: 'ok', text: 'Settings saved on this device (used in VIR & WhatsApp)' });
                  setTimeout(() => setExportToast(null), 2800);
                  setTimeout(() => setDmsUrlSaved(false), 1600);
                }}
                className="w-full tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#E8EAE6] font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                Save Configuration
              </button>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                <div className="text-[12px] tracking-normal text-red-300/80 font-bold">Session</div>
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold tracking-normal text-red-200 bg-red-500/15 border border-red-500/35 hover:bg-red-500/25 transition-all disabled:opacity-50"
                >
                  <LogOut size={14} />
                  {loggingOut ? 'Signing out…' : 'Log out'}
                </button>
              </div>
            </div>

            <div className="pt-8 pb-4 flex flex-col items-center opacity-40">
              <span className="text-[12px] text-neutral-500  tracking-[0.2em] font-bold">Powered by TruSaas</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
