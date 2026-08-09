import React from 'react';
import {
  Building2, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  Trash2, Cloud, Sparkles, FolderOpen, Image as ImageIcon, ArrowRight, Download,
  BarChart3, Palette, Copy, Check, Award, Lightbulb, Sliders,
  FileText, Settings, Camera, LogOut, Loader2, Pencil, X, ChevronDown
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Property } from '../types';
import { DEFAULT_TEMPLATE, SLOT_LIBRARY, getDefaultSlotIds } from '../templates';
import { resolveSlots } from '../lib/usePropertySlots';
import InstallAppButton from './InstallAppButton';
import { computeInspectionReadiness } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';

interface InventoryListProps {
  vehicles: Property[];
  onSelectProperty: (vehicle: Property) => void;
  onViewReport?: (vehicle: Property) => void;
  onAddProperty: (newProperty: Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => void;
  onDeleteProperty: (id: string) => void;
  onUpdateProperty?: (vehicle: Property, patch: Partial<Property>) => Promise<Property | null>;
  syncStatus: 'synced' | 'syncing' | 'error';
  onForceSync: () => void;
}


export default function InventoryList({
  vehicles,
  onSelectProperty,
  onViewReport,
  onAddProperty,
  onDeleteProperty,
  onUpdateProperty,
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
  /* Progressive disclosure for the add/edit form — the fields typed at the car
     stay visible, the rest sit behind this toggle. Values live in component
     state, so collapsing never loses what was typed. */
  const [showAllFields, setShowAllFields] = React.useState(false);
  const [editingProperty, setEditingProperty] = React.useState<Property | null>(null);
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
      (v) => (v.listingRef || '').toLowerCase() === highlightStock.toLowerCase()
    );
    if (!match) {
      setDeepLinkBanner(`${highlightStock} · not in this catalogue yet`);
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
    if (fleet.total === 0) return { head: 'No properties yet', body: 'Add one to start an inspection.' };
    if (fleet.needPhotos.length > 0) {
      const n = fleet.needPhotos[0];
      const missing = n.r.missingRequired;
      const name = `${n.v.propertyType} — ${n.v.suburb}`.trim();
      return {
        head: `${fleet.needPhotos.length} ${fleet.needPhotos.length === 1 ? 'inspection is' : 'inspections are'} short of photos`,
        body: `Closest: ${name} — ${missing.length === 1 ? missing[0] : `${missing.length} shots, starting with ${missing[0]}`}.`,
      };
    }
    if (fleet.needChecklist.length > 0) {
      const name = `${fleet.needChecklist[0].v.propertyType} — ${fleet.needChecklist[0].v.suburb}`.trim();
      return {
        head: `${fleet.needChecklist.length} awaiting the checklist`,
        body: `Photos are done. Next: ${name}.`,
      };
    }
    if (fleet.needSignoff.length > 0) {
      const name = `${fleet.needSignoff[0].v.propertyType} — ${fleet.needSignoff[0].v.suburb}`.trim();
      return {
        head: `${fleet.needSignoff.length} unsigned`,
        body: `The report prints a blank signature block until an inspector is named. Next: ${name}.`,
      };
    }
    return { head: 'All inspections complete', body: `${fleet.total} signed off and ready to issue.` };
  }, [fleet]);

  // Settings state (persisted for VIR / share branding)
  const [dealershipName, setDealershipName] = React.useState(
    () => localStorage.getItem('truestate_agency_name') || ''
  );
  const [branch, setBranch] = React.useState(
    () => localStorage.getItem('truestate_agency_branch') || ''
  );
  const [dealerWhatsApp, setDealerWhatsApp] = React.useState(
    () => localStorage.getItem('truestate_agency_wa') || ''
  );
  const [currency, setCurrency] = React.useState(
    () => localStorage.getItem('truestate_currency') || 'ZAR'
  );
  const [aiThreshold, setAiThreshold] = React.useState(() => {
    const n = Number(localStorage.getItem('truestate_ai_threshold'));
    return Number.isFinite(n) && n >= 50 ? n : 85;
  });
  const [propertyType, setPropertyType] = React.useState('House');
  const [suburb, setSuburb] = React.useState('');
  const [yearBuilt, setYearBuilt] = React.useState(new Date().getFullYear());
  const [erfNumber, setErfNumber] = React.useState('');
  const [listingRef, setListingRef] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [bedrooms, setBedrooms] = React.useState(3);
  const [bathrooms, setBathrooms] = React.useState(2);
  const [parking, setParking] = React.useState(1);
  const [listPrice, setListPrice] = React.useState(0);
  const [status, setStatus] = React.useState<'In-Progress' | 'Ready'>('In-Progress');
  const [inspectionPurpose, setInspectionPurpose] = React.useState<'sale' | 'rental' | 'new_build'>('sale');
  const [activeSlotIds, setActiveSlotIds] = React.useState<string[]>(() => getDefaultSlotIds('House'));
  const [showSlotPicker, setShowSlotPicker] = React.useState(false);

  /* Licence-disc scan — same component and parser as TruLens. An inspector
     standing at the windscreen has the disc in front of them; typing a 17-char
     VIN off it by hand is the slowest and most error-prone part of starting an
     inspection, and a wrong VIN is on the report for good. */
  // Generate mock listing ref
  const handleAutoGenerateData = () => {
    const mockRef = 'TS-' + Math.floor(100000 + Math.random() * 900000);
    setListingRef(mockRef);
  };

  const startEditing = (v: Property) => {
    setEditingProperty(v);
    setPropertyType(v.propertyType || 'House');
    setSuburb(v.suburb || '');
    setYearBuilt(v.yearBuilt || new Date().getFullYear());
    setErfNumber(v.erfNumber || '');
    setListingRef(v.listingRef || '');
    setAddress(v.address || '');
    setBedrooms(v.bedrooms ?? 3);
    setBathrooms(v.bathrooms ?? 2);
    setParking(v.parking ?? 1);
    setListPrice(v.listPrice || 0);
    setStatus(v.status === 'Listed' ? 'Ready' : v.status);
    setInspectionPurpose(v.inspectionPurpose || 'sale');
    setActiveSlotIds(v.activeSlotIds || getDefaultSlotIds(v.propertyType || 'House'));
    setShowSlotPicker(false);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyType || !suburb) return;

    const formData = {
      propertyType,
      suburb,
      yearBuilt: Number(yearBuilt),
      erfNumber: erfNumber.trim(),
      listingRef: listingRef.trim() || 'TS-' + Math.floor(100000 + Math.random() * 900000),
      address: address.trim(),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      parking: Number(parking),
      listPrice: Number(listPrice),
      status,
      inspectionPurpose,
      activeSlotIds,
    };

    if (editingProperty && onUpdateProperty) {
      onUpdateProperty(editingProperty, formData);
    } else {
      onAddProperty(formData);
    }

    // Reset form
    setEditingProperty(null);
    setPropertyType('House');
    setSuburb('');
    setYearBuilt(new Date().getFullYear());
    setErfNumber('');
    setListingRef('');
    setAddress('');
    setBedrooms(3);
    setBathrooms(2);
    setParking(1);
    setListPrice(0);
    setStatus('In-Progress');
    setInspectionPurpose('sale');
    setActiveSlotIds(getDefaultSlotIds('House'));
    setShowSlotPicker(false);
    setShowAddForm(false);
  };

  // Filter and search logic
  const filteredProperties = vehicles.filter(v => {
    const type = (v.propertyType || '').toLowerCase();
    const sub = (v.suburb || '').toLowerCase();
    const erf = (v.erfNumber || '').toLowerCase();
    const ref = (v.listingRef || '').toLowerCase();
    const addr = (v.address || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      type.includes(q) || sub.includes(q) || erf.includes(q) || ref.includes(q) || addr.includes(q);
    if (!matchesSearch) return false;
    if (activeFilter !== 'All' && v.status !== activeFilter) return false;
    return true;
  });

  const copyListingRef = async (ref: string, id: string) => {
    try {
      await navigator.clipboard.writeText(ref);
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


  return (
    <div id="inventory-list-container" className="flex flex-col h-full bg-[#F5F4F1] text-[#0A1420] overflow-hidden">
      
      {/* App header — premium dark glassmorphic band */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 shrink-0 bg-[#0A1420]/90 backdrop-blur-xl border-b border-white/[0.06] relative overflow-hidden">
        {/* Subtle gradient accent line at top edge */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#4FE3DC]/40 to-transparent" />
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
            <img src="/icons/tp-appicon.svg" alt="PropInspect" className="h-5 w-5 brightness-0 invert" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold text-white truncate leading-tight tracking-[-0.01em]">{dealershipName}</h1>
            <p className="text-[13px] text-[rgba(255,255,255,0.45)] leading-tight truncate mt-0.5">
              {fleet.total === 0
                ? 'No properties yet'
                : fleet.needPhotos.length > 0
                  ? `${fleet.complete}/${fleet.total} signed off · ${fleet.needPhotos.length} need photos`
                  : fleet.needSignoff.length > 0
                    ? `${fleet.complete}/${fleet.total} signed off · ${fleet.needSignoff.length} unsigned`
                    : `${fleet.complete}/${fleet.total} signed off`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center justify-center h-10 w-10 rounded-[10px] shrink-0 text-[rgba(255,255,255,0.40)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors cursor-pointer disabled:opacity-50"
          aria-label={user?.email ? `Sign out (${user.email})` : 'Sign out'}
          title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
        >
          {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={18} />}
        </button>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(10,20,32,0.45)]" size={16} />
            <input
              type="text"
              placeholder="Search type, suburb, ref…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 bg-[rgba(10,20,32,0.04)] text-[15px] text-[rgba(10,20,32,0.85)] pl-10 pr-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] focus:border-[#0E9D98] outline-none placeholder-[rgba(10,20,32,0.35)] font-mono transition-colors"
            />
          </div>
          <button
            onClick={() => { setEditingProperty(null); setShowAddForm(!showAddForm); }}
            aria-label={showAddForm ? (editingProperty ? 'Close edit form' : 'Close new property form') : 'Add a property'}
            className="bg-tru-cyan on-fill h-11 w-11 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Add property Form Box */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-white border border-[rgba(10,20,32,0.10)] rounded-2xl p-4 space-y-4 shadow-xl animate-in fade-in duration-200">
            {/* Header — a real title, a one-line subtitle, and a ghost close. */}
            <div className="flex items-start justify-between border-b border-[rgba(10,20,32,0.06)] pb-3">
              <div>
                <h3 className="text-[20px] font-semibold text-[#0A1420] leading-tight">
                  {editingProperty ? "Edit property" : "New property"}
                </h3>
                <p className="text-[13px] text-[rgba(10,20,32,0.50)] mt-0.5">
                  {editingProperty ? "Update this property’s details." : "Enter the property details below."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingProperty(null); }}
                className="tru-btn-ghost h-9 w-9 flex items-center justify-center shrink-0 cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Property details */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Property type</label>
                  <select
                    required
                    value={propertyType}
                    onChange={(e) => {
                      setPropertyType(e.target.value);
                      if (!editingProperty) setActiveSlotIds(getDefaultSlotIds(e.target.value));
                    }}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] outline-none focus:border-[#0E9D98] transition-colors"
                  >
                    <option value="House">House</option>
                    <option value="Flat">Flat</option>
                    <option value="Townhouse">Townhouse</option>
                    <option value="Estate">Estate</option>
                    <option value="Farm">Farm</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Suburb</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Rondebosch"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Purpose</label>
                <div className="flex gap-1.5">
                  {([['sale', 'Sale'], ['rental', 'Rental'], ['new_build', 'New Build']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setInspectionPurpose(val)}
                      className={`flex-1 min-h-[44px] rounded-xl text-[13px] font-semibold border transition-colors cursor-pointer ${
                        inspectionPurpose === val
                          ? 'bg-[#0E9D98]/12 border-[#0E9D98]/25 text-[#0E9D98]'
                          : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.45)] hover:text-[rgba(10,20,32,0.72)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="e.g., 12 Main Road"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">List price (R)</label>
                <input
                  type="number"
                  placeholder="1500000"
                  value={listPrice}
                  onChange={(e) => setListPrice(Number(e.target.value))}
                  className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                />
              </div>
            </div>

            {/* Everything else behind one disclosure. Values persist while hidden;
                the submit payload is unchanged. */}
            <button
              type="button"
              onClick={() => setShowAllFields((v) => !v)}
              className="tru-btn-ghost w-full min-h-[44px] flex items-center justify-between px-3 text-[13px] cursor-pointer"
            >
              <span>{showAllFields ? 'Fewer details' : 'Bedrooms, parking, erf, listing ref — more details'}</span>
              <ChevronDown size={16} className={`transition-transform ${showAllFields ? 'rotate-180' : ''}`} />
            </button>

            {showAllFields && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Year built</label>
                  <input
                    type="number"
                    placeholder="2024"
                    value={yearBuilt}
                    onChange={(e) => setYearBuilt(Number(e.target.value))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Bedrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Bathrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Parking</label>
                  <input
                    type="number"
                    min="0"
                    value={parking}
                    onChange={(e) => setParking(Number(e.target.value))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Erf number</label>
                  <input
                    type="text"
                    placeholder="e.g., ERF-12345"
                    value={erfNumber}
                    onChange={(e) => setErfNumber(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Listing ref</label>
                  <input
                    type="text"
                    placeholder="TS-123456"
                    value={listingRef}
                    onChange={(e) => setListingRef(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.65)] block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'In-Progress' | 'Ready')}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_1px_2px_rgba(10,20,32,0.06)] text-[16px] text-[#0A1420] outline-none focus:border-[#0E9D98] transition-colors"
                  >
                    <option value="In-Progress">In-Progress</option>
                    <option value="Ready">Ready</option>
                  </select>
                </div>
              </div>
            )}

            {/* Slot picker — which rooms/areas to capture */}
            <button
              type="button"
              onClick={() => setShowSlotPicker((v) => !v)}
              className="tru-btn-ghost w-full min-h-[44px] flex items-center justify-between px-3 text-[13px] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Camera size={14} className="text-[#0E9D98]" />
                {showSlotPicker ? 'Hide capture slots' : `Capture slots — ${activeSlotIds.length} selected`}
              </span>
              <ChevronDown size={16} className={`transition-transform ${showSlotPicker ? 'rotate-180' : ''}`} />
            </button>

            {showSlotPicker && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-[rgba(10,20,32,0.50)]">
                    {activeSlotIds.length} of {SLOT_LIBRARY.length} slots active
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSlotIds(getDefaultSlotIds(propertyType))}
                    className="text-[12px] text-[#0E9D98] hover:text-[#0E9D98] cursor-pointer"
                  >
                    Reset to {propertyType} defaults
                  </button>
                </div>
                {['Exterior', 'Living Areas', 'Bedrooms & Bathrooms', 'Systems & Documents'].map(category => {
                  const categorySlots = SLOT_LIBRARY.filter(s => s.category === category);
                  const activeInCategory = categorySlots.filter(s => activeSlotIds.includes(s.id)).length;
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-[13px] font-medium text-[rgba(10,20,32,0.65)]">{category}</h4>
                        <span className="text-[11px] text-[rgba(10,20,32,0.40)]">{activeInCategory}/{categorySlots.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {categorySlots.map(slot => {
                          const isActive = activeSlotIds.includes(slot.id);
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => {
                                setActiveSlotIds(prev =>
                                  isActive ? prev.filter(id => id !== slot.id) : [...prev, slot.id]
                                );
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors cursor-pointer ${
                                isActive
                                  ? slot.required
                                    ? 'bg-[#0E9D98]/12 border-[#0E9D98]/25 text-[#0E9D98]'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                                  : 'bg-[#F0F4F8]/50 border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.45)] hover:text-[rgba(10,20,32,0.72)] hover:border-[rgba(10,20,32,0.15)]'
                              }`}
                              title={slot.description}
                            >
                              {isActive ? '' : '+ '}{slot.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ranked, not 50/50: the action on top, the way out below. */}
            <div className="pt-1 border-t border-[rgba(10,20,32,0.06)] space-y-2">
              <button
                type="submit"
                className="btn-primary on-fill w-full min-h-[48px] flex items-center justify-center gap-2 text-[15px] cursor-pointer"
              >
                {editingProperty ? <><Pencil size={15} /> Save changes</> : <><Plus size={15} /> Add property</>}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingProperty(null); }}
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
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                : 'bg-red-500/10 border-red-500/30 text-red-600'
            }`}
          >
            {exportToast.type === 'ok' ? <CheckCircle2 size={12} className="shrink-0 mt-0.5" /> : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
            <span className="leading-snug">{exportToast.text}</span>
          </div>
        )}

        {deepLinkBanner && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-[#0E9D98]/25 bg-[#0E9D98]/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-normal text-[#0E9D98]">Opened from Flow</p>
              <p className="text-[13px] text-[rgba(10,20,32,0.85)] mt-0.5 font-mono truncate">{deepLinkBanner}</p>
            </div>
            <button
              type="button"
              onClick={() => { setDeepLinkBanner(null); setHighlightStock(null); setSearchTerm(''); }}
              className="text-[13px] font-bold text-[#0E9D98] hover:text-[#0A1420] shrink-0"
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
          {/* Underlined tab row, not filled pills — the active tab carries the
              cyan underline; the count is the reason you'd tap it. */}
          <div className="flex items-center gap-4 w-max border-b border-[rgba(10,20,32,0.08)]">
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
                  className={`flex items-center gap-1.5 px-0.5 py-2 -mb-px border-b-2 text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    on ? 'text-[#0A1420] border-[#0E9D98]' : 'text-[rgba(10,20,32,0.55)] border-transparent hover:text-[#0A1420]'
                  }`}
                >
                  {f.label}
                  <span className={`font-mono text-[12px] ${on ? 'text-[#0E9D98]' : 'text-[rgba(10,20,32,0.35)]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Propertys Inventory List */}
        <div className="space-y-3 pb-4">
          {filteredProperties.length === 0 ? (
            <div className="text-center py-10 bg-gradient-to-b from-white/80 to-[#F0F4F8]/40 rounded-xl border border-dashed border-indigo-500/20 flex flex-col items-center justify-center p-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                <Camera size={22} className="text-indigo-400" />
              </div>
              <p className="text-[16px] text-[#0A1420] font-bold">
                {searchTerm || activeFilter !== 'All' ? 'No matches' : 'No properties yet'}
              </p>
              <p className="text-[13px] text-[rgba(10,20,32,0.45)] mt-2 max-w-[220px] leading-relaxed">
                {searchTerm
                  ? `Nothing matched “${searchTerm}”. Clear search or add the unit to inspect.`
                  : 'Add a property, take the guided shots, answer the checklist, then issue the report.'}
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
                className="mt-4 px-4 py-2 rounded-xl tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#0A1420] text-[13px] font-semibold tracking-normal flex items-center gap-2"
              >
                <Plus size={12} />{' '}
                {searchTerm || activeFilter !== 'All' ? 'Clear filters' : 'Add first property'}
              </button>
            </div>
          ) : (
            filteredProperties.map(vehicle => {
              // Count completed photos (always use safe photos map)
              const photos = vehicle.photos || {};
              const takenCount = Object.keys(photos).length;
              const vehicleSlots = resolveSlots(vehicle);
              const totalCount = vehicleSlots.length;
              const requiredTaken = vehicleSlots.filter(s => s.required && !!photos[s.id]).length;
              const totalRequired = vehicleSlots.filter(s => s.required).length;
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
              const priceLabel = Number(vehicle.listPrice || 0).toLocaleString();
              const isHighlighted =
                !!highlightStock &&
                (vehicle.listingRef || '').toLowerCase() === highlightStock.toLowerCase();

              const typeColor = (() => {
                const t = (vehicle.propertyType || '').toLowerCase();
                if (t.includes('house') || t.includes('home')) return '#0E9D98';
                if (t.includes('flat') || t.includes('apartment') || t.includes('unit')) return '#6366f1';
                if (t.includes('townhouse') || t.includes('duplex')) return '#8b5cf6';
                if (t.includes('commercial') || t.includes('office') || t.includes('shop')) return '#f59e0b';
                if (t.includes('farm') || t.includes('land') || t.includes('plot')) return '#22c55e';
                return '#5A7A94';
              })();

              return (
                <div
                  key={vehicle.id}
                  ref={(el) => { cardRefs.current[vehicle.id] = el; }}
                  data-stock={vehicle.listingRef}
                  className={`bg-white rounded-2xl border border-[rgba(10,20,32,0.06)] shadow-[0_1px_3px_rgba(10,20,32,0.05),0_4px_14px_rgba(10,20,32,0.04)] hover:shadow-[0_2px_8px_rgba(10,20,32,0.08),0_8px_24px_rgba(10,20,32,0.06)] hover:border-[rgba(10,20,32,0.10)] transition-all duration-200 flex overflow-hidden relative ${
                    isHighlighted ? 'tl-stock-highlight' : ''
                  }`}
                >
                  <div className="w-1 shrink-0" style={{ backgroundColor: typeColor }} />
                  <div className="flex-1 p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {/* Photo Preview Miniature Thumbnail or Property icon */}
                      <div className="w-14 h-14 rounded-xl border border-[rgba(10,20,32,0.06)] flex items-center justify-center overflow-hidden shrink-0 relative shadow-[0_1px_2px_rgba(10,20,32,0.06)]" style={{ backgroundColor: thumb ? '#F0F0ED' : `${typeColor}08` }}>
                        {thumb ? (
                          <img
                            src={thumb}
                            alt="Property photo"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Building2 size={22} style={{ color: typeColor, opacity: 0.5 }} />
                        )}
                        <span className="absolute bottom-0 right-0 bg-white/90 backdrop-blur-sm px-1.5 py-px text-[11px] font-mono font-bold text-[rgba(10,20,32,0.65)] rounded-tl-md">
                          {takenCount}/{totalCount}
                        </span>
                      </div>

                      {/* Details */}
                      <div>
                        {/* The one thing scanned for on this screen, so it takes
                            the top of the scale. Everything else on the card was
                            the same 13px, which is why the list read as a wall. */}
                        <h3 className="text-[17px] font-semibold text-[#0A1420] leading-tight tracking-[-0.01em] flex items-center gap-2">
                          {vehicle.propertyType} — {vehicle.suburb}
                          {isHighlighted && (
                            <span className="text-[13px] font-semibold tracking-normal text-[#0E9D98] bg-[#0E9D98]/10 border border-[#0E9D98]/25 px-2 py-0.5 rounded">
                              From Flow
                            </span>
                          )}
                        </h3>
                        <p className="text-[13px] text-[rgba(10,20,32,0.55)] font-medium mt-0.5">
                          {vehicle.bedrooms}BR, {vehicle.bathrooms}BA • <span className="text-[rgba(10,20,32,0.72)]">R {priceLabel}</span>
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (vehicle.listingRef) copyListingRef(vehicle.listingRef, vehicle.id);
                            }}
                            className="text-[12px] font-mono text-[rgba(10,20,32,0.40)] hover:text-[rgba(10,20,32,0.65)] flex items-center gap-1"
                            title="Copy listing ref"
                          >
                            {vehicle.listingRef}
                            {copiedStockId === vehicle.id ? <Check size={12} className="text-[#0E9D98]" /> : <Copy size={12} />}
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
                            <span className="text-[12px] font-medium text-[rgba(10,20,32,0.50)]">
                              Checklist {Object.keys(vehicle.inspectionChecklist).length}
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
                        className="flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 rounded-[12px] text-[rgba(10,20,32,0.50)] hover:text-[#0A1420] hover:bg-[rgba(10,20,32,0.05)] cursor-pointer transition-colors"
                        title="Edit property details"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${vehicle.propertyType} in ${vehicle.suburb} from the catalogue?`)) {
                            onDeleteProperty(vehicle.id);
                          }
                        }}
                        className="flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 rounded-[12px] text-[rgba(10,20,32,0.50)] hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Delete property"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Indicators */}
                  <div className="mt-1 pt-2 border-t border-[rgba(10,20,32,0.06)] flex flex-col gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[13px] text-[rgba(10,20,32,0.55)] mb-1 font-mono">
                        {/* Was "Required Guide Completion: 7 of 19 (37%)" directly
                            under a chip already reading "Photos 7/19" — the same
                            fact twice, once in product vocabulary and once in
                            plain numbers. The chip keeps the count; this line
                            keeps the percentage the bar is drawing. */}
                        <span>Required photos</span>
                        <span className="font-bold text-[rgba(10,20,32,0.85)]">
                          {Math.round((requiredTaken / totalRequired) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-[rgba(10,20,32,0.06)] h-[3px] rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                            requiredTaken === totalRequired ? 'bg-emerald-500' : 'bg-indigo-500'
                          } ${requiredTaken > 0 && requiredTaken < totalRequired ? 'tl-progress-sheen' : ''}`}
                          style={{ width: `${Math.round((requiredTaken / totalRequired) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Two buttons: Inspect opens the capture walk (photo capture
                        is the first step, not a separate button); Report opens
                        the condition report. The report button is always
                        present — it opens straight to the report's own
                        not-started state (same pattern already used at
                        0/23 photos) rather than appearing/disappearing as work
                        progresses. */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectProperty(vehicle)}
                        className="tru-btn-secondary flex items-center justify-center gap-2 text-[13px] cursor-pointer min-h-[44px] px-2"
                        title="Inspect — capture the shot list, then rate condition and check function"
                      >
                        <Camera size={13} /> Inspect
                      </button>

                      {onViewReport && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewReport(vehicle); }}
                          title="Property Inspection Report"
                          className="tru-btn-ghost flex items-center justify-center gap-1.5 text-[13px] cursor-pointer min-h-[44px] px-2"
                        >
                          <FileText size={13} /> Report
                        </button>
                      )}
                    </div>
                  </div>
                  </div>{/* close flex-1 content wrapper */}
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
                  <BarChart3 size={15} className="text-[#0E9D98]" />
                  <span className="text-[15px] font-bold text-[#0A1420] tracking-[-0.01em]">Dashboard</span>
                </div>
                <p className="text-[13px] text-[rgba(10,20,32,0.45)] mt-0.5">Photography & inspections</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[13px] font-bold text-emerald-400">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'Ready' || v.status === 'Listed' ? v.listPrice : 0), 0).toLocaleString()} Ready
                </span>
                <span className="text-[13px] text-[rgba(10,20,32,0.45)]">
                  R {vehicles.reduce((acc, v) => acc + (v.status === 'In-Progress' ? v.listPrice : 0), 0).toLocaleString()} Pending
                </span>
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white pl-0 rounded-xl border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] flex h-16 overflow-hidden">
                <div className="w-1 bg-[#0E9D98] rounded-l-xl shrink-0" />
                <div className="p-2 flex flex-col justify-between flex-1">
                  <span className="text-[13px] text-[rgba(10,20,32,0.45)] font-bold">Catalogue</span>
                  <span className="text-[16px] font-semibold text-[#0A1420]">{vehicles.length}</span>
                </div>
              </div>
              <div className="bg-white pl-0 rounded-xl border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] flex h-16 overflow-hidden">
                <div className="w-1 bg-emerald-500 rounded-l-xl shrink-0" />
                <div className="p-2 flex flex-col justify-between flex-1">
                  <span className="text-[13px] text-emerald-500 font-bold">Ready</span>
                  <span className="text-[16px] font-semibold text-emerald-400">{vehicles.filter(v => v.status === 'Ready' || v.status === 'Listed').length}</span>
                </div>
              </div>
              <div className="bg-white pl-0 rounded-xl border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] flex h-16 overflow-hidden">
                <div className="w-1 bg-amber-500 rounded-l-xl shrink-0" />
                <div className="p-2 flex flex-col justify-between flex-1">
                  <span className="text-[13px] text-amber-500 font-bold">Pending</span>
                  <span className="text-[16px] font-semibold text-amber-400">{vehicles.filter(v => v.status === 'In-Progress').length}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white pl-0 rounded-xl border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] flex h-16 overflow-hidden">
                <div className="w-1 bg-indigo-500 rounded-l-xl shrink-0" />
                <div className="p-2 flex flex-col justify-between flex-1">
                  <span className="text-[13px] text-indigo-500 font-bold">Capture rate</span>
                  <span className="text-[16px] font-semibold text-indigo-400">
                    {Math.round((vehicles.reduce((acc, v) => acc + Object.keys(v.photos || {}).length, 0) / (vehicles.reduce((acc, v) => acc + resolveSlots(v).length, 0) || 1)) * 100)}%
                  </span>
                </div>
              </div>
              <div className="bg-white pl-0 rounded-xl border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] flex h-16 overflow-hidden">
                <div className="w-1 bg-emerald-500 rounded-l-xl shrink-0" />
                <div className="p-2 flex flex-col justify-between flex-1">
                  <span className="text-[13px] text-emerald-500 font-bold">Reports</span>
                  <span className="text-[16px] font-semibold text-emerald-400">{vehicles.filter(v => v.inspectorName).length}</span>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-2 gap-2">
              {/* Readiness */}
              <div className="bg-white border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)]  mb-2">Readiness</span>
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
                        contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(10,20,32,0.10)', fontSize: '13px', borderRadius: '8px', color: '#0A1420' }}
                        itemStyle={{ color: '#0A1420' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[13px] text-[rgba(10,20,32,0.45)] font-bold ">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Ready</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"/> Pending</span>
                </div>
              </div>

              {/* Weekly Capture Volume */}
              <div className="bg-white border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)]  mb-2">Weekly activity</span>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(10,20,32,0.10)" />
                      {/* Was fontSize 7 on #737373 — the day labels under this chart
                          were the smallest type in the app by a wide margin, well
                          under the 12px floor brand.css sets, and the grey sat
                          around 3.5:1 on the panel. Recharts writes these as inline
                          SVG attributes, so no stylesheet rule reaches them. */}
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'rgba(10,20,32,0.50)' }} />
                      <YAxis hide />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(10,20,32,0.04)' }}
                        contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(10,20,32,0.10)', fontSize: '13px', borderRadius: '8px', color: '#0A1420' }}
                      />
                      <Bar dataKey="photos" fill="#0E9D98" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Critical Action Items */}
            <div className="bg-white border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] rounded-xl p-3">
              {/* "Attention Required" and "Action Needed" side by side said the
                  same thing twice and neither said what to do. The heading now
                  names the work; the count is the urgency. */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-[#0A1420]">Still to shoot</span>
                <span className="text-[13px] text-amber-400 font-semibold">
                  {vehicles.filter(v => v.status === 'In-Progress').length}
                </span>
              </div>
              <div className="space-y-2">
                {vehicles.filter(v => v.status === 'In-Progress').length === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-[13px] text-[rgba(10,20,32,0.45)] font-medium">All clear! Your inventory is fully documented.</p>
                  </div>
                ) : (
                  vehicles.filter(v => v.status === 'In-Progress').slice(0, 3).map(v => {
                    const missingCount = resolveSlots(v).filter(s => s.required && !(v.photos || {})[s.id]).length;
                    return (
                      <div key={v.id} className="flex items-center justify-between p-2 bg-[#F5F4F1]/40 rounded-lg border border-[rgba(10,20,32,0.06)]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-amber-500/10 flex items-center justify-center">
                            <Building2 size={12} className="text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-[rgba(10,20,32,0.85)]">{v.yearBuilt} {v.propertyType}</p>
                            <p className="text-[13px] text-[rgba(10,20,32,0.45)]">Missing {missingCount} required shots</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onSelectProperty(v)}
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
            <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#0E9D98]/12 text-[#0E9D98] shrink-0">
                <Lightbulb size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-medium text-[rgba(10,20,32,0.50)]">Do next</span>
                <p className="text-[16px] font-semibold text-[#0A1420] leading-snug mt-1">
                  {nextAction.head}
                </p>
                <p className="text-[13px] text-[rgba(10,20,32,0.72)] leading-snug mt-0.5">
                  {nextAction.body}
                </p>
                {fleet.total > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-[rgba(10,20,32,0.08)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0E9D98] transition-all duration-500"
                        style={{ width: `${Math.round((fleet.complete / fleet.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-mono text-[rgba(10,20,32,0.55)] shrink-0">
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
              <span className="text-[13px] font-bold text-[rgba(10,20,32,0.85)] tracking-normal">Organisation settings</span>
            </div>

            {/* Profile Section */}
            <div className="bg-white border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[rgba(10,20,32,0.06)] bg-[#F5F4F1]">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)] ">Organisation profile</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[13px] text-[rgba(10,20,32,0.45)]  font-bold">Organisation name</label>
                  <input 
                    type="text" 
                    value={dealershipName}
                    onChange={(e) => setDealershipName(e.target.value)}
                    className="w-full bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-lg px-3 py-2 text-[13px] text-[#0A1420] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] text-[rgba(10,20,32,0.45)]  font-bold">Branch</label>
                  <input 
                    type="text" 
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-lg px-3 py-2 text-[13px] text-[#0A1420] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Regional & Localization */}
            <div className="bg-white border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[rgba(10,20,32,0.06)] bg-[#F5F4F1]">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)] ">Regional & Localization</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-bold text-[rgba(10,20,32,0.85)]">Currency</p>
                    <p className="text-[13px] text-[rgba(10,20,32,0.45)]">Global display currency for valuations</p>
                  </div>
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded px-2 py-1 text-[13px] text-[#0A1420]"
                  >
                    <option value="ZAR">South African Rand (R)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="GBP">British Pound (£)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AI Core Tuning */}
            <div className="bg-white border border-[rgba(10,20,32,0.05)] shadow-[0_1px_3px_rgba(10,20,32,0.04),0_4px_12px_rgba(10,20,32,0.03)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[rgba(10,20,32,0.06)] bg-[#F5F4F1] flex items-center justify-between">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)] ">Capture quality</span>
                <Camera size={11} className="text-[#0E9D98]" />
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[13px] font-bold text-[rgba(10,20,32,0.85)]">Minimum photo quality</p>
                    <span className="text-[13px] font-mono text-[#0E9D98] font-bold">{aiThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="98"
                    value={aiThreshold}
                    onChange={(e) => setAiThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-[rgba(10,20,32,0.08)] rounded-lg appearance-none cursor-pointer accent-[#0E9D98]"
                  />
                  <p className="text-[13px] text-[rgba(10,20,32,0.45)] leading-relaxed italic">
                    Photos that come out too dark or blurry to below this level get flagged for a re-take, so every shot on the report is clear.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Management */}
            <div className="pt-2 space-y-2">
              <label className="block space-y-1">
                <span className="text-[13px] tracking-normal text-[rgba(10,20,32,0.45)] font-bold">WhatsApp sales number</span>
                <input
                  value={dealerWhatsApp}
                  onChange={(e) => setDealerWhatsApp(e.target.value)}
                  placeholder="+27 …"
                  className="w-full bg-white border border-[rgba(10,20,32,0.10)] rounded-lg px-3 py-2 text-[13px] text-[#0A1420]"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('truestate_agency_name', dealershipName);
                  localStorage.setItem('truestate_agency_branch', branch);
                  localStorage.setItem('truestate_agency_wa', dealerWhatsApp);
                  localStorage.setItem('truestate_currency', currency);
                  localStorage.setItem('truestate_ai_threshold', String(aiThreshold));
                  setExportToast({ type: 'ok', text: 'Settings saved on this device (used in VIR & WhatsApp)' });
                  setTimeout(() => setExportToast(null), 2800);
                }}
                className="w-full tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#0A1420] font-bold py-3 rounded-xl text-[13px] transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                Save Configuration
              </button>

              {/* The install banner is dismissible and only shows when the
                  browser volunteers the prompt, so this is the only reliable
                  way back to installing once it has been closed. */}
              <InstallAppButton />

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                <div className="text-[13px] tracking-normal text-red-500 font-bold">Session</div>
                <p className="text-[13px] text-[rgba(10,20,32,0.55)] leading-relaxed">
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
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tracking-normal text-red-600 bg-red-50 border border-red-500/35 hover:bg-red-500/25 transition-all disabled:opacity-50"
                >
                  <LogOut size={14} />
                  {loggingOut ? 'Signing out…' : 'Log out'}
                </button>
              </div>
            </div>

            <div className="pt-8 pb-4 flex flex-col items-center opacity-40">
              <span className="text-[13px] text-[rgba(10,20,32,0.32)]">Powered by TruProperty</span>
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
          { id: 'catalog' as const, label: 'Catalogue', Icon: FolderOpen, title: 'Property catalogue' },
          { id: 'dashboard' as const, label: 'Dashboard', Icon: BarChart3, title: 'Property dashboard' },
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
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 text-[12px] font-semibold tracking-normal transition-all cursor-pointer relative ${
                on ? 'text-[#0E9D98]' : 'text-[rgba(10,20,32,0.40)] hover:text-[rgba(10,20,32,0.65)]'
              }`}
              style={on ? { boxShadow: 'inset 0 2px 0 #0E9D98' } : undefined}
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
