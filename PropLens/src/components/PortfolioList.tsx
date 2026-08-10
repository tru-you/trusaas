import React from 'react';
import {
  Home, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  Trash2, Cloud, Sparkles, FolderOpen, Image as ImageIcon, ArrowRight, Download,
  BarChart3, Palette, Copy, Check, Award, Lightbulb, BookOpen, Sliders, ExternalLink,
  FileText, Settings, Camera, LogOut, ScanLine, Loader2, Pencil, X, ChevronDown} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { Property } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { computeWebReadiness, isStructurallyWebReady } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';

interface PortfolioListProps {
  properties: Property[];
  onSelectVehicle: (property: Property) => void;
  onViewReport?: (property: Property) => void;
  onAddVehicle: (newVehicle: Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => void;
  onDeleteVehicle: (id: string) => void;
  onExportToDms?: (property: Property) => Promise<any>;
  onUpdateVehicle?: (property: Property, patch: Partial<Property>) => Promise<Property | null>;
  syncStatus: 'synced' | 'syncing' | 'error';
  onForceSync: () => void;
}

// The FlowPMS target is fixed for every device and controlled server-side
// (TRUFLOW_PMS_URL). Phones no longer carry their own base URL  —  a stale
// localhost left in one phone's storage used to break its exports silently.
// This constant is only used to open the FlowPMS in a browser tab from the header,
// and to show the agency where their listing lands. It read lens.tru-saas.com  — 
// TruLens's own address  —  so "Open TruFlow FlowPMS" reopened TruLens, and Settings
// told the agency their homes went to the wrong place. flow. is canonical.
const PMS_URL = 'https://flow.tru-saas.com';

export default function PortfolioList({
  properties,
  onSelectVehicle,
  onViewReport,
  onAddVehicle,
  onDeleteVehicle,
  onExportToDms,
  onUpdateVehicle,
  syncStatus,
  onForceSync
}: PortfolioListProps) {
  const { signOut, user, isDemo } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  /* The input types straight into its own state; the actual filter term only
     updates 300ms after typing stops, so re-filtering the whole portfolio no
     longer runs on every keystroke. */
  const [searchInput, setSearchInput] = React.useState('');
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Listing # from Flow deep-link (?listing=)  —  highlight + search */
  const [highlightStock, setHighlightStock] = React.useState<string | null>(null);
  const [deepLinkBanner, setDeepLinkBanner] = React.useState<string | null>(null);
  const [copiedStockId, setCopiedStockId] = React.useState<string | null>(null);
  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [activeFilter, setActiveFilter] = React.useState<'All' | 'In-Progress' | 'Ready' | 'Listed'>('All');
  /** Extra filter: web readiness for floor managers */
  const [readinessFilter, setReadinessFilter] = React.useState<'ALL' | 'NEEDS' | 'READY'>('ALL');
  const [showAddForm, setShowAddForm] = React.useState(false);
  /* Progressive disclosure for the add/edit form: the three (now four) fields
     someone types at the homes stay visible; the rest sit behind this toggle.
     The field values live in component state, not the inputs, so collapsing the
     block never loses what was typed. */
  const [showAllFields, setShowAllFields] = React.useState(false);
  const [editingVehicle, setEditingVehicle] = React.useState<Property | null>(null);
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

  // Export system → PropLens deep-link: /?listing=STK-123
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const listing = (params.get('listing') || params.get('stk') || '').trim();
      if (!listing) return;
      setSearchTerm(listing);
      setHighlightStock(listing);
      setDeepLinkBanner(listing);
      setCurrentTab('catalog');
      setActiveFilter('All');
      setReadinessFilter('ALL');
      // Clean URL after read so refresh doesn't re-flash forever
      const url = new URL(window.location.href);
      url.searchParams.delete('listing');
      url.searchParams.delete('stk');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
  }, []);

  /* searchTerm can change from outside the input (deep-link, clear filters) —
     mirror those into the input box, and drop any in-flight debounce. */
  React.useEffect(() => {
    setSearchInput(searchTerm);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, [searchTerm]);

  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Scroll highlighted unit into view once portfolio is present
  React.useEffect(() => {
    if (!highlightStock || !properties.length) return;
    const match = properties.find(
      (v) => (v.listingRef || '').toLowerCase() === highlightStock.toLowerCase()
    );
    if (!match) {
      setDeepLinkBanner(`${highlightStock} · not in this catalogue yet  —  add or sync from export system`);
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
  }, [highlightStock, properties]);

  /* The cursor-tracking card glow (.tl-card-lift) is retired  —  depth lives on
     the controls now, not the cards  —  so the pointermove listener that drove it
     is gone with it. */

  /**
   * What the site should do next, derived from the actual property collection.
   *
   * This replaced a hardcoded line claiming properties with 360 walkarounds
   * "sell 18% faster on average"  —  a figure with no source, in an app that
   * holds no sales data, shown to an agency who would repeat it to a customer.
   * Everything below is computed from photos actually captured.
   */
  const fleet = React.useMemo(() => {
    const rows = properties.map(v => ({ v, r: computeWebReadiness(v) }));
    // Listing-readiness is the 10-shot CORE set now. Every slot is optional, so
    // the old missingRequired[] was always empty and read every homes as "done".
    const shortOfPublish = rows
      .filter(({ r }) => !r.listingReady)
      .sort((a, b) => a.r.missingCore.length - b.r.missingCore.length);
    const readyToExport = rows.filter(({ v, r }) => r.listingReady && !v.lastPmsExportAt);
    const done = rows.filter(({ r }) => r.listingReady).length;
    return { rows, shortOfPublish, readyToExport, done, total: rows.length };
  }, [properties]);

  /** One sentence, the most useful thing true right now. */
  const nextAction = React.useMemo(() => {
    if (fleet.total === 0) {
      return { head: 'No properties yet', body: 'Add one to start capturing.' };
    }
    if (fleet.shortOfPublish.length > 0) {
      const nearest = fleet.shortOfPublish[0];
      const missing = nearest.r.missingCore;
      const name = `${nearest.v.address} ${nearest.v.suburb}`.trim();
      return {
        head: `${fleet.shortOfPublish.length} ${fleet.shortOfPublish.length === 1 ? 'property is' : 'properties are'} short of publishing`,
        body: `Closest: ${name}  —  ${missing.length === 1 ? missing[0] : `${missing.length} shots, starting with ${missing[0]}`}.`,
      };
    }
    if (fleet.readyToExport.length > 0) {
      return {
        head: `${fleet.readyToExport.length} ready to export`,
        body: 'Every core shot is captured. Export to publish them.',
      };
    }
    return { head: 'Everything captured', body: `All ${fleet.total} properties are listing-ready.` };
  }, [fleet]);

  // Settings state (persisted for inspection report / share branding)
  const [agencyName, setAgencyName] = React.useState(
    () => localStorage.getItem('proplens_agency_name') || ''
  );
  const [branch, setBranch] = React.useState(
    () => localStorage.getItem('proplens_agency_branch') || ''
  );
  /** Which agency newly-exported properties get tagged to in the system  — 
      must match a slug the system's public website feed knows how to isolate.
      A phone used on a site should be set to the correct agency slug so
      captures never default to (and leak onto) another agency's site. */
  /* Read-only now: the access code sets this, not the phone. */
  const dealerSlug = localStorage.getItem('proplens_agency_slug') || '';
  /** True when the access code itself carried the agency, in which case the
      server enforces it and nothing on this phone can override it. */
  const dealerPinned = localStorage.getItem('proplens_agency_pinned') === '1';
  /** Name for the current slug. Starts from the list the picker cached, then
      asks the server if that misses  —  a phone pinned by a per-agency code
      never runs the picker, so the cache may not be warm yet and this rendered
      the raw slug where the agency's name belongs. State, not useMemo: the
      cache is written asynchronously and a memo keyed on the slug would never
      recompute when it landed. */
  const nameFromCache = React.useCallback((slug: string): string => {
    try {
      const cached = JSON.parse(localStorage.getItem('proplens_agencies_v1') || '[]');
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
    fetch('/api/agencies', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        localStorage.setItem('proplens_agencies_v1', JSON.stringify(list));
        const hit = list.find((d: any) => d?.slug === dealerSlug);
        if (hit?.name) setDealerDisplayName(hit.name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dealerSlug, nameFromCache]);
  const [agencyWhatsApp, setDealerWhatsApp] = React.useState(
    () => localStorage.getItem('proplens_agency_wa') || ''
  );
  const [currency, setCurrency] = React.useState(
    () => localStorage.getItem('proplens_currency') || 'ZAR'
  );
  const [aiThreshold, setAiThreshold] = React.useState(() => {
    const n = Number(localStorage.getItem('proplens_ai_threshold'));
    return Number.isFinite(n) && n >= 50 ? n : 85;
  });
  // Clear any per-device export URL a phone still has from the old settings  — 
  // it's now server-controlled, and a leftover localhost would be ignored but
  // is best not lingering in storage.
  React.useEffect(() => {
    if (localStorage.getItem('proplens_export_url')) {
      localStorage.removeItem('proplens_export_url');
    }
  }, []);
  const [address, setAddress] = React.useState('');
  const [suburb, setSuburb] = React.useState('');
  const [city, setCity] = React.useState('');
  const [bedrooms, setBedrooms] = React.useState('');
  const [bathrooms, setBathrooms] = React.useState('');
  const [parking, setParking] = React.useState('');
  const [erfRef, setErfRef] = React.useState('');
  const [erfSize, setErfSize] = React.useState('');
  const [floorSize, setFloorSize] = React.useState('');
  const [listingRef, setListingRef] = React.useState('');
  const [price, setPrice] = React.useState(2499500);
  const [propertyType, setPropertyType] = React.useState<'House' | 'Townhouse' | 'Flat' | 'Duplex' | 'Estate' | 'Plot' | 'Commercial' | 'Farm'>('House');
  const [status, setStatus] = React.useState<'In-Progress' | 'Ready'>('In-Progress');
  const [features, setFeatures] = React.useState<string[]>([]);
  const [extrasOpen, setExtrasOpen] = React.useState(false);
  const [scanningDisc, setScanningDisc] = React.useState(false);
  const [scanNote, setScanNote] = React.useState<string | null>(null);

  // Fill the form from a scanned licence deed  —  everything stays editable.
  const applyDeedScan = (d: any) => {
    setScanningDisc(false);
    const titleCase = (v) => v.toLowerCase().split(' ').map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    if (d.address) setAddress(titleCase(d.address));
    if (d.suburb) setSuburb(titleCase(d.suburb));
    if (d.erfRef) setErfRef(d.erfRef);
    if (d.propertyType) setPropertyType(d.propertyType);
    const got = ['address', 'suburb', 'erfRef'].filter((k) => (d as any)[k]).length;
    setScanNote(
      got === 0
        ? "Couldn't read that deed  —  try again, or type the details in."
        : `Filled ${got} field${got > 1 ? 's' : ''} from the deed  —  check and adjust.`,
    );
    setTimeout(() => setScanNote(null), 5000);
  };

  const startEditing = (v: Property) => {
    setEditingVehicle(v);
    setAddress(v.address || '');
    setSuburb(v.suburb || '');
    setCity(v.city || '');
    setBedrooms(v.bedrooms != null ? String(v.bedrooms) : '');
    setBathrooms(v.bathrooms != null ? String(v.bathrooms) : '');
    setParking(v.parkingSpaces != null ? String(v.parkingSpaces) : '');
    setErfRef(v.erfRef || '');
    setErfSize(v.erfSize != null ? String(v.erfSize) : '');
    setFloorSize(v.floorSize != null ? String(v.floorSize) : '');
    setListingRef(v.listingRef || '');
    setPrice(v.price || 2499500);
    setPropertyType(v.propertyType || 'House');
    setStatus(v.status === 'Listed' ? 'Ready' : v.status);
    setFeatures(v.features || []);
    setExtrasOpen(false);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    /* Address is required. It could have been optional and
       carried through as "unknown", but that means three systems each deciding
       how to render a missing string, and the FlowPMS schema has address as a
       plain string with no null. The erf no. is in front of whoever is
       standing at the property, so ask once here and the rest of the chain can
       trust it. */
    if (!address.trim() || !suburb.trim()) return;

    if (editingVehicle && onUpdateVehicle) {
      onUpdateVehicle(editingVehicle, {
        address: address.trim(),
        suburb: suburb.trim(),
        city: city.trim(),
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        parkingSpaces: parking ? Number(parking) : undefined,
        erfRef: erfRef.trim(),
        erfSize: erfSize ? Number(erfSize) : undefined,
        floorSize: floorSize ? Number(floorSize) : undefined,
        listingRef: listingRef.trim(),
        price: Number(price),
        propertyType,
        status,
        features,
      });
    } else {
      onAddVehicle({
        address: address.trim(),
        suburb: suburb.trim(),
        city: city.trim(),
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        parkingSpaces: parking ? Number(parking) : undefined,
        erfRef: erfRef.trim(),
        erfSize: erfSize ? Number(erfSize) : undefined,
        floorSize: floorSize ? Number(floorSize) : undefined,
        listingRef: listingRef.trim(),
        price: Number(price),
        propertyType,
        status,
        features,
      });
    }

    // Reset form
    setEditingVehicle(null);
    setAddress('');
    setSuburb('');
    setCity('');
    setBedrooms('');
    setBathrooms('');
    setParking('');
    setErfRef('');
    setErfSize('');
    setFloorSize('');
    setListingRef('');
    setPrice(2499500);
    setPropertyType('House');
    setStatus('In-Progress');
    setFeatures([]);
    setExtrasOpen(false);
    setShowAddForm(false);
  };

  // Filter and search logic
  const filteredVehicles = properties.filter(v => {
    const address = (v.address || '').toLowerCase();
    const suburb = (v.suburb || '').toLowerCase();
    const erfRef = (v.erfRef || '').toLowerCase();
    const listing = (v.listingRef || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      address.includes(q) || suburb.includes(q) || erfRef.includes(q) || listing.includes(q);
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

  const copyListingRef = async (listing: string, id: string) => {
    try {
      await navigator.clipboard.writeText(listing);
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

  const handleExportClick = async (e: React.MouseEvent, property: Property) => {
    e.stopPropagation();
    if (!onExportToDms) {
      setExportToast({ type: 'err', text: 'Export handler not available' });
      return;
    }
    const takenCount = Object.keys(property.photos || {}).length;
    if (takenCount === 0) {
      setExportToast({ type: 'err', text: 'No photos to export' });
      return;
    }

    setExportingId(property.id);
    setExportToast(null);
    try {
      const result = await onExportToDms(property);
      if (result.success) {
        const b = result.breakdown;
        /* 360 views are called out on their own  —  their ABSENCE
           is stated rather than left blank. Every other entry here is
           omitted when zero, which is right for photo categories, but a
           missing 360 is the one thing worth saying out loud. Reads
           result.truOrbit (set by handleExportToDms after awaiting the
           360 autoexport). The old breakdown.walkaround check was for
           the retired video-slot field, which never populates  —  so the
           toast always said "no 360" regardless of actual state. */
        const parts = b
          ? [
              b.mainImages ? `${b.mainImages} main` : null,
              b.extras ? `${b.extras} extras` : null,
              b.damage ? `${b.damage} damage` : null,
              b.erfRef ? `${b.erfRef} Erf no.` : null,
              b.serviceBook ? `${b.serviceBook} service` : null,
              result.truOrbit ? '360 ✓' : 'no 360',
            ].filter(Boolean).join(', ')
          : `${takenCount} photos`;
        setExportToast({
          type: 'ok',
          text: result.created
            ? `Created + exported (${parts})`
            : `Exported successfully (${parts})`,
        });
      } else {
        setExportToast({
          type: 'err',
          text: result.error || result.message || 'FlowPMS export failed',
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
    <div id="portfolio-list-container" className="flex flex-col h-full bg-[#F5F4F1] text-[#0A1420] overflow-hidden">
      
      {/* App header  —  the app bar is retired (62px of chrome that said what
          one line of type says better: whose properties this is, how much is left).
          A plain page title, a count, and three quiet ghost actions. */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 shrink-0 bg-[#0A1420]/90 backdrop-blur-xl border-b border-white/[0.06] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#4FE3DC]/40 to-transparent" />
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-[8px] bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
            <img src="/icons/tp-appicon.svg" alt="" className="h-5 w-5 brightness-0 invert" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold text-white truncate leading-tight">{agencyName}</h1>
            <p className="text-[13px] text-white/50 leading-tight truncate mt-0.5">
              {fleet.total === 0
                ? 'No properties yet'
                : fleet.shortOfPublish.length > 0
                  ? `${fleet.done}/${fleet.total} complete · ${fleet.shortOfPublish.length} need photos`
                  : `${fleet.done}/${fleet.total} complete`}
            </p>
          </div>
        </div>
        {/* Three quiet ghosts  —  no borders, no boxes, no three-decisions read.
            Sync keeps its colour because that one is state, not decoration. */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => window.open(PMS_URL, '_blank')}
            className="flex items-center justify-center h-10 w-10 rounded-[10px] text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label={`Open export system (${PMS_URL})`}
            title={`Open export system (${PMS_URL})`}
          >
            <ExternalLink size={18} />
          </button>
          <button
            onClick={onForceSync}
            className="flex items-center justify-center h-10 w-10 rounded-[10px] text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label={
              syncStatus === 'syncing' ? 'Syncing now'
                : syncStatus === 'error' ? 'Last sync failed  —  tap to retry'
                : 'Refresh from the server'
            }
            title={
              syncStatus === 'syncing' ? 'Syncing now'
                : syncStatus === 'error' ? 'Last sync failed  —  tap to retry'
                : 'Refresh from the server'
            }
          >
            {getSyncIcon()}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center h-10 w-10 rounded-[10px] text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-50"
            aria-label={user?.email ? `Sign out (${user.email})` : 'Sign out'}
            title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
          >
            {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={18} />}
          </button>
        </div>
      </div>

      {/* The tab switcher used to sit here and the three-up stat grid under it.
          Between them they took 162px off the top of a 844px phone, and on a
          360x640 Android  —  which is most phones out there  —  73% of the screen was
          chrome before the first property appeared.

          The stats are gone: Total / Shooting / Ready restated what the header
          line above already says, in bigger boxes. The tabs moved to the bottom
          of the screen, where the thumb of the hand holding the phone actually
          reaches. See the nav below the scroll area. */}

      {/* Main Panel Content */}
      <div id="portfolio-scroll-container" className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {currentTab === 'catalog' ? (
          <>
            {/* Search & Add New Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(10,20,32,0.55)]" size={16} />
            <input
              type="text"
              placeholder="Search Erf no., listing, make…"
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                searchTimerRef.current = setTimeout(() => setSearchTerm(value), 300);
              }}
              className="w-full h-11 bg-[rgba(10,20,32,0.04)] text-[15px] text-[#0A1420] pl-10 pr-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] focus:border-[#0E9D98] outline-none placeholder-[rgba(10,20,32,0.40)] font-mono transition-colors"
            />
          </div>
          <button
            onClick={() => { setEditingVehicle(null); setShowAddForm(!showAddForm); }}
            className="bg-tru-cyan on-fill h-11 w-11 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Add property"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Add property Form Box */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-2xl p-4 space-y-4 shadow-xl animate-in fade-in duration-200">
            {/* Header  —  a real title, a one-line subtitle, and a ghost close. */}
            <div className="flex items-start justify-between border-b border-[rgba(10,20,32,0.08)] pb-3">
              <div>
                <h3 className="text-[20px] font-semibold text-[#0A1420] leading-tight">
                  {editingVehicle ? 'Edit property' : 'New property'}
                </h3>
                <p className="text-[13px] text-[rgba(10,20,32,0.55)] mt-0.5">
                  {editingVehicle ? 'Update this property details.' : 'Enter the property details, or scan a document.'}
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

            {/* Scan is optional: it may fill fields from a document photo. */}
            <button
              type="button"
              onClick={() => setScanningDisc(true)}
              className="btn-primary on-fill w-full min-h-[52px] flex items-center justify-center gap-2 text-[16px] cursor-pointer"
            >
              <ScanLine size={18} /> Scan document
            </button>

            {scanNote && (
              <p className="text-[13px] text-[rgba(10,20,32,0.72)]">{scanNote}</p>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[rgba(10,20,32,0.08)]" />
              <span className="text-[12px] text-[rgba(10,20,32,0.55)]">or enter by hand</span>
              <div className="flex-1 h-px bg-[rgba(10,20,32,0.08)]" />
            </div>

            {/* The fields someone actually types at the property. Address and
                suburb stay separate. Everything is 48px, 12px radius, recessed,
                16px text. */}
            <div className="space-y-3">
              <div>
                <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 12 Oak Avenue"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Suburb</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Rosebank"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g., Johannesburg"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Floor size (m²)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={floorSize}
                  onChange={(e) => setFloorSize(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="e.g. 185"
                  className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Price (R)</label>
                <input
                  type="number"
                  placeholder="2500000"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                />
              </div>
            </div>

            {/* Everything else behind one disclosure. Values live in component
                state, so collapsing this never loses what was typed, and the
                submit payload is unchanged. */}
            <button
              type="button"
              onClick={() => setShowAllFields((v) => !v)}
              className="tru-btn-ghost w-full min-h-[44px] flex items-center justify-between px-3 text-[13px] cursor-pointer"
            >
              <span>{showAllFields ? 'Fewer details' : 'Bedrooms, bathrooms, parking, Erf no., listing #  —  more details'}</span>
              <ChevronDown size={16} className={`transition-transform ${showAllFields ? 'rotate-180' : ''}`} />
            </button>

            {showAllFields && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Bedrooms</label>
                  <input
                    type="number"
                    placeholder="3"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Bathrooms</label>
                  <input
                    type="number"
                    placeholder="2"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Parking spaces</label>
                  <input
                    type="number"
                    placeholder="2"
                    value={parking}
                    onChange={(e) => setParking(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Erf size (m²)</label>
                  <input
                    type="number"
                    placeholder="720"
                    value={erfSize}
                    onChange={(e) => setErfSize(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Erf no.</label>
                  <input
                    type="text"
                    placeholder="e.g. 1258 JHB"
                    value={erfRef}
                    onChange={(e) => setErfRef(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Listing #</label>
                  <input
                    type="text"
                    placeholder="LST-0124"
                    value={listingRef}
                    onChange={(e) => setListingRef(e.target.value)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] placeholder-[rgba(10,20,32,0.32)] outline-none focus:border-[#0E9D98] transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Property type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as 'House' | 'Townhouse' | 'Flat' | 'Duplex' | 'Estate' | 'Plot' | 'Commercial' | 'Farm')}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] outline-none focus:border-[#0E9D98] transition-colors"
                  >
                    <option value="House">House</option>
                    <option value="Townhouse">Townhouse</option>
                    <option value="Flat">Flat</option>
                    <option value="Duplex">Duplex</option>
                    <option value="Estate">Estate</option>
                    <option value="Plot">Plot</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Farm">Farm</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'In-Progress' | 'Ready')}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-[#0A1420] outline-none focus:border-[#0E9D98] transition-colors"
                  >
                    <option value="In-Progress">In-Progress</option>
                    <option value="Ready">Ready</option>
                  </select>
                </div>

                {/* Features  —  full-width multi-select checklist */}
                <div className="col-span-2 relative">
                  <label className="text-[13px] font-medium text-[rgba(10,20,32,0.72)] block mb-1">Features</label>
                  <button
                    type="button"
                    onClick={() => setExtrasOpen((v) => !v)}
                    className="w-full min-h-[48px] bg-[rgba(10,20,32,0.04)] px-3 rounded-[12px] border border-[rgba(10,20,32,0.10)] shadow-[inset_0_2px_4px_rgba(10,20,32,0.08)] text-[16px] text-left flex items-center justify-between outline-none focus:border-[#0E9D98] transition-colors cursor-pointer"
                  >
                    <span className={features.length ? 'text-[#0A1420]' : 'text-[rgba(10,20,32,0.32)]'}>
                      {features.length ? `${features.length} selected` : 'Select features…'}
                    </span>
                    <ChevronDown size={16} className={`text-[rgba(10,20,32,0.45)] transition-transform ${extrasOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {extrasOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-[12px] shadow-2xl max-h-[320px] overflow-y-auto p-2 space-y-3 animate-in fade-in duration-100">
                      {([
                        ['Energy', ['Solar', 'Geyser', 'Heat Pump', 'Backup Power', 'Prepaid Electricity']],
                        ['Comfort', ['Air Conditioning', 'Gas Stove / Hob', 'Fireplace', 'Study / Office', 'Fibre']],
                        ['Outdoor', ['Pool', 'Jacuzzi / Hot Tub', 'Braai / BBQ', 'Garden', 'Borehole / Water Tank']],
                        ['Security', ['Security Alarm', 'Electric Gate', 'CCTV', 'Pet Friendly']],
                        ['Extras', ['Staff Quarters', 'Granny Flat / Flatlet', 'Complex / Estate', 'Income Generating']],
                      ] as [string, string[]][]).map(([group, items]) => (
                        <div key={group}>
                          <p className="text-[11px] font-semibold text-[rgba(10,20,32,0.4)] uppercase tracking-wider px-1 mb-1">{group}</p>
                          {items.map((item) => {
                            const on = features.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setFeatures((prev) => on ? prev.filter((x) => x !== item) : [...prev, item])}
                                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-[rgba(10,20,32,0.06)] transition-colors cursor-pointer"
                              >
                                <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-[#0E9D98] border-[#0E9D98]' : 'border-[rgba(10,20,32,0.18)] bg-transparent'}`}>
                                  {on && <Check size={12} className="text-white" strokeWidth={3} />}
                                </span>
                                <span className={`text-[14px] ${on ? 'text-[#0A1420]' : 'text-[rgba(10,20,32,0.6)]'}`}>{item}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {features.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 bg-[rgba(14,157,152,0.10)] text-[#0E9D98] text-[12px] font-medium px-2 py-0.5 rounded-full"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => setFeatures((prev) => prev.filter((x) => x !== item))}
                            className="hover:text-[#0A1420] transition-colors cursor-pointer"
                          ><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ranked, not 50/50: the action on top, the way out below. */}
            <div className="pt-1 border-t border-[rgba(10,20,32,0.08)] space-y-2">
              <button
                type="submit"
                className="btn-primary on-fill w-full min-h-[48px] flex items-center justify-center gap-2 text-[15px] cursor-pointer"
              >
                {editingVehicle ? <><Pencil size={15} /> Save changes</> : <><Plus size={15} /> Add property</>}
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
          <div className="flex items-start justify-between gap-2 rounded-xl border border-[#0E9D98]/30 bg-[#0E9D98]/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-normal text-[#0E9D98]">Opened from export system</p>
              <p className="text-[13px] text-[#0A1420] mt-0.5 font-mono truncate">{deepLinkBanner}</p>
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

        {/* Filters Panel */}
        {/* Filters  —  one scrolling row instead of two stacked ones.
            Two full-width rows of chips cost 109px and pushed the first property
            below the fold. They are also two halves of the same question, so
            they read better side by side than stacked.

            Each chip carries its own count: the number is the reason you would
            tap it, and it is what the deleted stat grid was there to tell you. */}
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
          {/* Underlined tab row, not filled pills  —  a row of five cyan pills read
              as five buttons and competed with the real action. The active tab
              carries the cyan underline; the count is the reason you'd tap it. */}
          <div className="flex items-center gap-4 w-max border-b border-[rgba(10,20,32,0.08)]">
            {([
              { id: 'All' as const, label: 'All' },
              { id: 'In-Progress' as const, label: 'In progress' },
              { id: 'Ready' as const, label: 'Ready' },
              { id: 'Listed' as const, label: 'Listed' },
            ]).map((f) => {
              const count = f.id === 'All'
                ? properties.length
                : properties.filter((v) => v.status === f.id).length;
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
                  <span className={`font-mono text-[12px] ${on ? 'text-[#0E9D98]' : 'text-[rgba(10,20,32,0.45)]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <span className="w-px h-4 bg-[rgba(10,20,32,0.06)] mx-1 shrink-0 self-center" aria-hidden="true" />

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
                    on ? 'text-[#0A1420] border-[#0E9D98]' : 'text-[rgba(10,20,32,0.55)] border-transparent hover:text-[#0A1420]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Vehicles Portfolio List */}
        <div className="space-y-3 pb-4">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-10 bg-gradient-to-b from-[#F5F4F1]/80 to-white/40 rounded-xl border border-dashed border-indigo-500/20 flex flex-col items-center justify-center p-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                <Camera size={22} className="text-indigo-400" />
              </div>
              <p className="text-[16px] text-[#0A1420] font-bold">
                {searchTerm || readinessFilter !== 'ALL' || activeFilter !== 'All' ? 'No matches' : 'No properties yet'}
              </p>
              <p className="text-[13px] text-[rgba(10,20,32,0.55)] mt-2 max-w-[220px] leading-relaxed">
                {searchTerm
                  ? `Nothing matched "${searchTerm}". Clear search or add the property.`
                  : 'Add a property, then take the guided shots. Export when ready.'}
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
                className="mt-4 px-4 py-2 rounded-xl tl-btn-3d bg-indigo-600 hover:bg-indigo-500 text-[#0A1420] text-[13px] font-semibold tracking-normal flex items-center gap-2"
              >
                <Plus size={12} />{' '}
                {searchTerm || readinessFilter !== 'ALL' || activeFilter !== 'All' ? 'Clear filters' : 'Add first property'}
              </button>
            </div>
          ) : (
            filteredVehicles.map(property => {
              // Count completed photos (always use safe photos map)
              const photos = property.photos || {};
              const takenCount = Object.keys(photos).length;
              const totalCount = DEFAULT_TEMPLATE.slots.length;
              const coreTaken = DEFAULT_TEMPLATE.slots.filter(s => s.tier === 'core' && !!photos[s.id]).length;
              const totalCore = DEFAULT_TEMPLATE.slots.filter(s => s.tier === 'core').length;
              const readiness = computeWebReadiness(property);
              /* Photos are files now, so the hero is usually "/media/<hash>.jpg"
                 rather than a data URI. Testing only for data: left every
                 migrated property with a blank thumbnail. */
              const thumb =
                typeof photos.front_bumper === 'string' &&
                (photos.front_bumper.startsWith('data:') ||
                  photos.front_bumper.startsWith('/media/') ||
                  photos.front_bumper.startsWith('http'))
                  ? photos.front_bumper
                  : null;
              const priceLabel = Number(property.price || 0).toLocaleString();
              const isHighlighted =
                !!highlightStock &&
                (property.listingRef || '').toLowerCase() === highlightStock.toLowerCase();

              return (
                <div 
                  key={property.id}
                  ref={(el) => { cardRefs.current[property.id] = el; }}
                  data-listing={property.listingRef}
                  className={`bg-[#F5F4F1] rounded-2xl border border-[rgba(10,20,32,0.10)]/80 p-3 hover:border-[rgba(10,20,32,0.16)] hover:bg-white flex flex-col gap-2 relative ${
                    isHighlighted ? 'tl-listing-highlight' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {/* Photo Preview Miniature Thumbnail or fallback icon */}
                      <div className="w-12 h-12 bg-white rounded-lg border border-[rgba(10,20,32,0.10)] flex items-center justify-center overflow-hidden shrink-0 relative">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt="Property photo"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Camera size={20} className="text-[rgba(10,20,32,0.45)]" />
                        )}
                        <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[13px] font-mono font-bold text-[rgba(10,20,32,0.72)]">
                          {takenCount}/{totalCount}
                        </span>
                      </div>

                      {/* Details */}
                      <div>
                        {/* The one thing scanned for on this screen, so it takes
                            the top of the scale. Everything else on the card was
                            the same 13px, which is why the list read as a wall. */}
                        <h3 className="text-[17px] font-semibold text-[#0A1420] leading-tight tracking-[-0.01em] flex items-center gap-2">
                          {property.address}
                          {isHighlighted && (
                            <span className="text-[13px] font-semibold tracking-normal text-[#0E9D98] bg-[#0E9D98]/15 border border-[#0E9D98]/30 px-2 py-0.5 rounded">
                              From Flow
                            </span>
                          )}
                        </h3>
                        <p className="text-[13px] text-[rgba(10,20,32,0.55)] font-medium mt-0.5">
                          {property.propertyType || 'House'} • <span className="text-[rgba(10,20,32,0.72)]">R {priceLabel}</span>
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (property.listingRef) copyListingRef(property.listingRef, property.id);
                            }}
                            className="text-[12px] font-mono text-[rgba(10,20,32,0.42)] hover:text-[rgba(10,20,32,0.72)] flex items-center gap-1"
                            title="Copy listing number"
                          >
                            {property.listingRef}
                            {copiedStockId === property.id ? <Check size={9} className="text-[#0E9D98]" /> : <Copy size={9} />}
                          </button>
                          {/* The property.status chip stood here. It is a field somebody
                              sets by hand, while the chip beside it is derived from the
                              photos, score, checklist and signature actually on the
                              record  —  so the two drifted apart and read "Capturing" next
                              to "Capture in progress", which is the same sentence twice.

                              status still drives the filter row above, where it is the
                              user's own label and belongs. On the card, the derived
                              stage is the one that cannot be wrong. */}
                          {property.lastPmsExportAt && (
                            <span className="text-[12px] text-[rgba(10,20,32,0.55)] font-mono" title={property.lastPmsExportAt}>
                              Exported {new Date(property.lastPmsExportAt).toLocaleDateString()}
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
                          startEditing(property);
                          document.getElementById('portfolio-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center justify-center h-9 w-9 rounded-[12px] text-[rgba(10,20,32,0.55)] hover:text-[#0A1420] hover:bg-[rgba(10,20,32,0.06)] cursor-pointer transition-colors"
                        title="Edit property details"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${property.address} from the catalogue?`)) {
                            onDeleteVehicle(property.id);
                          }
                        }}
                        className="flex items-center justify-center h-9 w-9 rounded-[12px] text-[rgba(10,20,32,0.55)] hover:text-[#C07676] hover:bg-[rgba(184,106,106,0.14)] cursor-pointer transition-colors"
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
                        {/* The chip above keeps the raw count; this line is the
                            percentage the bar draws  —  CORE shots, not the old
                            all-optional "required" set that always read 100%. */}
                        <span>Core photos</span>
                        <span className="font-bold text-[#0A1420]">
                          {totalCore > 0 ? Math.round((coreTaken / totalCore) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-[rgba(10,20,32,0.06)] h-[3px] rounded-full overflow-hidden relative">
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
                        onClick={() => onSelectVehicle(property)}
                        className="btn-primary on-fill flex items-center justify-center gap-2 text-[15px] cursor-pointer whitespace-nowrap w-full min-h-[44px] px-2 py-2"
                        title="Open camera guide and take pictures"
                      >
                        <Camera size={15} /> Take pictures
                      </button>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={(e) => handleExportClick(e, property)}
                          disabled={takenCount === 0 || exportingId === property.id || !onExportToDms}
                          title={takenCount > 0 ? `Export ${takenCount} photos` : 'Take photos first'}
                          className="tru-btn-ghost flex items-center justify-center gap-1.5 text-[13px] cursor-pointer min-h-[44px] px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {exportingId === property.id ? (
                            <><RefreshCw size={13} className="animate-spin" /> Syncing</>
                          ) : (
                            <><Download size={13} /> Export</>
                          )}
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); onViewReport?.(property); }}
                          disabled={takenCount === 0}
                          title={takenCount > 0 ? 'View capture report' : 'Take photos first'}
                          className="tru-btn-ghost flex items-center justify-center gap-1.5 text-[13px] cursor-pointer min-h-[44px] px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FileText size={13} /> Report
                        </button>

                        {/* Publish: a secondary when the homes is web-ready, a disabled
                            control when it isn't  —  never a coloured button that
                            refuses. No blue anywhere. */}
                        <button
                          type="button"
                          disabled={!onUpdateVehicle || !isStructurallyWebReady(property) || publishingId === property.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!onUpdateVehicle) return;
                            setPublishingId(property.id);
                            const nextShow = !property.showOnWebsite;
                            const saved = await onUpdateVehicle(property, {
                              showOnWebsite: nextShow,
                              status: nextShow && property.status === 'In-Progress' ? 'Ready' : property.status,
                              agencyName: agencyName,
                              agencyWhatsApp: agencyWhatsApp || property.agencyWhatsApp,
                            });
                            if (saved && onExportToDms) {
                              await onExportToDms(saved).catch(() => {});
                            }
                            setPublishingId(null);
                            if (saved) {
                              setExportToast({
                                type: 'ok',
                                text: nextShow
                                  ? `${property.listingRef} published to website feed`
                                  : `${property.listingRef} removed from website feed`,
                              });
                              setTimeout(() => setExportToast(null), 3200);
                            } else {
                              setExportToast({ type: 'err', text: 'Could not update publish status' });
                              setTimeout(() => setExportToast(null), 3200);
                            }
                          }}
                          title={
                            property.showOnWebsite
                              ? 'Remove from public website listing'
                              : 'Publish to public website listing'
                          }
                          className={`flex items-center justify-center gap-1.5 text-[13px] cursor-pointer min-h-[44px] px-2 rounded-[12px] transition-colors disabled:cursor-not-allowed ${
                            isStructurallyWebReady(property)
                              ? 'tru-btn-secondary'
                              : 'text-[rgba(10,20,32,0.30)]'
                          }`}
                        >
                          {publishingId === property.id ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <ExternalLink size={13} />
                          )}
                          {property.showOnWebsite ? 'Unpublish' : 'Publish'}
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
            {/* Dashboard heading & revenue overview */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-[#0E9D98]" />
                  <span className="text-[13px] font-semibold text-[#0A1420]">Dashboard</span>
                </div>
                <p className="text-[12px] text-[rgba(10,20,32,0.55)] mt-0.5">Photography & readiness audit</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[13px] font-semibold text-[#0E9D98]">
                  R {properties.reduce((acc, v) => acc + (v.status === 'Ready' ? v.price : 0), 0).toLocaleString()} ready
                </span>
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]">
                  R {properties.reduce((acc, v) => acc + (v.status === 'In-Progress' ? v.price : 0), 0).toLocaleString()} pending
                </span>
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#F5F4F1] p-2.5 rounded-xl border border-[rgba(10,20,32,0.10)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]">Properties</span>
                <span className="text-[16px] font-semibold text-[#0A1420]">{properties.length}</span>
              </div>
              <div className="bg-[#F5F4F1] p-2.5 rounded-xl border border-[rgba(10,20,32,0.10)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]">Ready</span>
                <span className="text-[16px] font-semibold text-[#0E9D98]">{properties.filter(v => v.status === 'Ready').length}</span>
              </div>
              <div className="bg-[#F5F4F1] p-2.5 rounded-xl border border-[rgba(10,20,32,0.10)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]">Pending</span>
                <span className="text-[16px] font-semibold text-[#0A1420]">{properties.filter(v => v.status === 'In-Progress').length}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#F5F4F1] p-2.5 rounded-xl border border-[rgba(10,20,32,0.10)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]">Capture rate</span>
                <span className="text-[16px] font-semibold text-[#0E9D98]">
                  {Math.round((properties.reduce((acc, v) => acc + Object.keys(v.photos || {}).length, 0) / (properties.length * DEFAULT_TEMPLATE.slots.length || 1)) * 100)}%
                </span>
              </div>
              <div className="bg-[#F5F4F1] p-2.5 rounded-xl border border-[rgba(10,20,32,0.10)] flex flex-col justify-between h-16">
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]">Photos</span>
                <span className="text-[16px] font-semibold text-[#0E9D98]">
                  {properties.reduce((acc, v) => acc + Object.keys(v.photos || {}).length, 0)}
                </span>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-2 gap-2">
              {/* Readiness */}
              <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.08)] rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]  mb-2">Readiness</span>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Ready', value: properties.filter(v => v.status === 'Ready').length },
                          { name: 'In-Progress', value: properties.filter(v => v.status === 'In-Progress').length }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#0E9D98" />
                        <Cell fill="#8B8D89" />
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(10,20,32,0.10)', fontSize: '13px', borderRadius: '8px' }}
                        itemStyle={{ color: '#0A1420' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-[12px] text-[rgba(10,20,32,0.55)]">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#0E9D98]"/> Ready</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#8B8D89]"/> Pending</span>
                </div>
              </div>

              {/* Weekly Capture Volume */}
              <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.08)] rounded-xl p-3 h-48 flex flex-col">
                <span className="text-[12px] text-[rgba(10,20,32,0.55)]  mb-2">Weekly activity</span>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(10,20,32,0.08)" />
                      {/* Was fontSize 7 on #737373  —  the day labels under this chart
                          were the smallest type in the app by a wide margin, well
                          under the 12px floor brand.css sets, and the grey sat
                          around 3.5:1 on the panel. Recharts writes these as inline
                          SVG attributes, so no stylesheet rule reaches them. */}
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'rgba(10,20,32,0.55)' }} />
                      <YAxis hide />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(10,20,32,0.04)' }}
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(10,20,32,0.10)', fontSize: '13px', borderRadius: '8px' }}
                      />
                      <Bar dataKey="photos" fill="#0E9D98" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Critical Action Items */}
            <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.08)] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                {/* "Attention Required" and "Action Needed" side by side said the
                    same thing twice and neither said what to do. The heading now
                    names the work; the count is the urgency. */}
                <span className="text-[13px] font-semibold text-[#0A1420]">Still to shoot</span>
                <span className="text-[13px] text-[rgba(10,20,32,0.55)] font-medium">
                  {properties.filter(v => v.status === 'In-Progress').length}
                </span>
              </div>
              <div className="space-y-2">
                {properties.filter(v => v.status === 'In-Progress').length === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-[13px] text-[rgba(10,20,32,0.55)]">All properties shot.</p>
                  </div>
                ) : (
                  properties.filter(v => v.status === 'In-Progress').slice(0, 3).map(v => {
                    const missingCount = DEFAULT_TEMPLATE.slots.filter(s => s.required && !(v.photos || {})[s.id]).length;
                    return (
                      <div key={v.id} className="flex items-center justify-between p-2 bg-[#EFEDE8] rounded-lg border border-[rgba(10,20,32,0.06)]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[rgba(10,20,32,0.05)] flex items-center justify-center">
                            <Camera size={12} className="text-[rgba(10,20,32,0.55)]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#0A1420]">{v.address}</p>
                            <p className="text-[13px] text-[rgba(10,20,32,0.55)]">Missing {missingCount} required shots</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onSelectVehicle(v)}
                          className="text-[13px] font-medium text-[#0E9D98] hover:text-[#0E9D98]/80"
                        >
                          Complete →
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Next action  —  computed from the fleet, not asserted. */}
            <div className="bg-[rgba(255,255,255,0.85)] border border-[rgba(10,20,32,0.10)] rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#0E9D98]/12 text-[#0E9D98] shrink-0">
                <Lightbulb size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-medium text-[rgba(10,20,32,0.55)]">Do next</span>
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
                        style={{ width: `${Math.round((fleet.done / fleet.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-mono text-[rgba(10,20,32,0.55)] shrink-0">
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
              <span className="text-[13px] font-bold text-[#0A1420] tracking-normal">Agency settings</span>
            </div>

            {/* Profile Section */}
            <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.08)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[rgba(10,20,32,0.08)] bg-white/40">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)] ">Agency profile</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[12px] text-[rgba(10,20,32,0.55)] font-semibold">Agency name</label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full bg-white border border-[rgba(10,20,32,0.10)] rounded-xl px-4 py-3 text-[13px] text-[#0A1420] focus:outline-none focus:border-[#0E9D98]/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] text-[rgba(10,20,32,0.55)] font-semibold">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-white border border-[rgba(10,20,32,0.10)] rounded-xl px-4 py-3 text-[13px] text-[#0A1420] focus:outline-none focus:border-[#0E9D98]/30"
                  />
                </div>
                {/* Not a choice any more.
                    This was a <select> carrying a hardcoded two-agency list, and
                    for a phone signed in with a per-agency code the server
                    takes the agency from the token and ignores whatever the
                    phone claims  —  so changing it did nothing while looking like
                    it did something. The code decides; this reports it. */}
                <div className="space-y-2">
                  <label className="text-[12px] text-[rgba(10,20,32,0.55)] font-semibold">Agency (Export tagging)</label>
                  <div className="w-full bg-white border border-[rgba(10,20,32,0.10)] rounded-lg px-3 py-3">
                    <div className="text-[15px] font-semibold text-[#0A1420]">
                      {dealerDisplayName || 'Not set'}
                    </div>
                    {dealerSlug && (
                      <div className="text-[13px] font-mono text-[#0E9D98] mt-0.5">{dealerSlug}</div>
                    )}
                  </div>
                  <p className="text-[13px] text-[rgba(10,20,32,0.45)] leading-relaxed">
                    {dealerPinned
                      ? "Set by the access code this phone signed in with, and enforced by the server — captures cannot file to another agency, whatever this phone sends. To change it, sign out and sign in with that agency’s code."
                      : "Chosen when this phone signed in. To change it, sign out and sign in again — or ask TruProperty for an agency code, which pins it server-side so a wrong pick cannot put properties in another agency’s listing."}
                  </p>
                </div>
              </div>
            </div>

            {/* Export target  —  fixed for every device, server-controlled */}
            <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.08)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[rgba(10,20,32,0.08)] bg-white/40 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)] ">Export System Target</span>
                <ExternalLink size={12} className="text-[#0E9D98]" />
              </div>
              <div className="p-4 space-y-3">
                <p className="text-[13px] text-[rgba(10,20,32,0.55)] leading-relaxed">
                  <strong className="text-[rgba(10,20,32,0.72)]">Export</strong> pushes photos via{' '}
                  <span className="font-mono text-[rgba(10,20,32,0.55)]">/api/sync/push-photos</span>.
                  Match by reference number; missing records are created automatically.
                </p>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-[rgba(10,20,32,0.10)] px-3 py-3">
                  <div className="min-w-0">
                    <div className="text-[12px] text-[rgba(10,20,32,0.55)]">Target</div>
                    <div className="text-[13px] font-mono text-[#0A1420] truncate">{PMS_URL}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(PMS_URL, '_blank')}
                    className="shrink-0 px-3 py-2 bg-[rgba(10,20,32,0.08)] hover:bg-[rgba(10,20,32,0.12)] border border-[rgba(10,20,32,0.12)] text-[#0A1420] rounded-lg text-[13px] font-bold cursor-pointer"
                    title="Open FlowPMS in browser"
                  >
                    Open
                  </button>
                </div>
                <p className="text-[13px] text-[rgba(10,20,32,0.45)] leading-relaxed">
                  The same export system for every device  —  set on the server, so a phone can't point exports
                  at the wrong place.
                </p>
              </div>
            </div>

            {/* Regional & Localization */}
            <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.08)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[rgba(10,20,32,0.08)] bg-white/40">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)] ">Regional & Localization</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-bold text-[#0A1420]">Currency</p>
                    <p className="text-[13px] text-[rgba(10,20,32,0.55)]">Global display currency for valuations</p>
                  </div>
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="bg-white border border-[rgba(10,20,32,0.10)] rounded px-2 py-1 text-[13px] text-[#0A1420]"
                  >
                    <option value="ZAR">South African Rand (R)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="GBP">British Pound (£)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AI Core Tuning */}
            <div className="bg-[#F5F4F1] border border-[rgba(10,20,32,0.08)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[rgba(10,20,32,0.08)] bg-white/40 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[rgba(10,20,32,0.55)] ">AI Capture Intelligence</span>
                <Sparkles size={11} className="text-indigo-400" />
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[13px] font-bold text-[#0A1420]">AI Quality Threshold</p>
                    <span className="text-[13px] font-mono text-indigo-400 font-bold">{aiThreshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="98" 
                    value={aiThreshold}
                    onChange={(e) => setAiThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-[rgba(10,20,32,0.08)] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[13px] text-[rgba(10,20,32,0.55)] leading-relaxed italic">
                    Images scoring below this threshold will be flagged for immediate re-capture. Higher thresholds ensure "Perfect" listings but may require more capture attempts.
                  </p>
                </div>
              </div>
            </div>

            {/* Valuation CarTrust  —  removed for property capture */}

            {/* Data Management */}
            <div className="pt-2 space-y-2">
              <label className="block space-y-1">
                <span className="text-[13px] tracking-normal text-[rgba(10,20,32,0.55)] font-bold">WhatsApp contact number</span>
                <input
                  value={agencyWhatsApp}
                  onChange={(e) => setDealerWhatsApp(e.target.value)}
                  placeholder="+27 …"
                  className="w-full bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-lg px-3 py-2 text-[13px] text-[#0A1420]"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('proplens_agency_name', agencyName);
                  localStorage.setItem('proplens_agency_branch', branch);
                  localStorage.setItem('proplens_agency_slug', dealerSlug);
                  if (dealerSlug) localStorage.setItem('proplens_agency_confirmed', '1');
                  localStorage.setItem('proplens_agency_wa', agencyWhatsApp);
                  localStorage.setItem('proplens_currency', currency);
                  localStorage.setItem('proplens_ai_threshold', String(aiThreshold));
                  setExportToast({ type: 'ok', text: 'Settings saved on this device (used in reports & WhatsApp)' });
                  setTimeout(() => setExportToast(null), 2800);
                }}
                className="w-full tl-btn-3d font-bold py-3 rounded-xl text-[15px] transition-all"
              >
                Save Configuration
              </button>

              <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                <div className="text-[13px] tracking-normal text-red-700 font-bold">Session</div>
                <p className="text-[13px] text-[rgba(10,20,32,0.55)] leading-relaxed">
                  {isDemo
                    ? 'Signed in as demo inspector (offline). Log out returns to the login screen.'
                    : localStorage.getItem('proplens_device_token')
                      ? `Signed in · ${localStorage.getItem('proplens_agency_slug') || 'agency device'}`
                      : user?.email
                        ? `Signed in as ${user.email}`
                        : 'Signed in'}
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tracking-normal text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50"
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
          and this is an app used one-handed while the other hand is on the homes.

          pb uses the safe-area inset so the labels clear the iOS home indicator
          rather than sitting under it. */}
      <nav
        className="tl-bottomnav shrink-0 flex items-stretch gap-1 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))]"
        aria-label="Sections"
      >
        {([
          { id: 'catalog' as const, label: 'Catalogue', Icon: FolderOpen, title: 'Property catalogue' },
          { id: 'dashboard' as const, label: 'Dashboard', Icon: BarChart3, title: 'Property dashboard' },
          { id: 'settings' as const, label: 'Settings', Icon: Settings, title: 'Agency & export settings' },
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
                on ? 'text-[#0E9D98] bg-[#0E9D98]/10' : 'text-[rgba(10,20,32,0.55)] hover:text-[rgba(10,20,32,0.72)]'
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
