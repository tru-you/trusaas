import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";

/*  Cascading vehicle selector — hybrid static + live Imagin8.
    
    Makes load from the static /catalogue/index.json (fast, cached).
    Models/variants/years load from the live Imagin8 API first
    (/api/imagin8/models, flat-fee unlimited calls), and fall back
    to the static /catalogue/<file>.json if the API is unconfigured
    or unreachable.  */

type CatalogueVariant = { c: string; y: number[] };
type CatalogueModel = Record<string, CatalogueVariant>;
type CatalogueMake = Record<string, CatalogueModel>;
type MakeIndexEntry = { name: string; file: string };

let makeIndexCache: MakeIndexEntry[] | null = null;
let makeIndexPromise: Promise<MakeIndexEntry[]> | null = null;
const makeDataCache = new Map<string, CatalogueMake>();
const makeDataPromises = new Map<string, Promise<CatalogueMake>>();

function loadMakeIndex(): Promise<MakeIndexEntry[]> {
  if (makeIndexCache) return Promise.resolve(makeIndexCache);
  if (makeIndexPromise) return makeIndexPromise;
  makeIndexPromise = fetch("/catalogue/index.json")
    .then((r) => r.json())
    .then((d: MakeIndexEntry[]) => { makeIndexCache = d; return d; });
  return makeIndexPromise;
}

/** Transform live Imagin8 getModels response into the CatalogueMake shape. */
function liveToCatalogue(variants: any[]): CatalogueMake {
  const out: CatalogueMake = {};
  for (const v of variants) {
    const mmCode = v.mmCode || v.mvCode || "";
    const fullModel = v.model || v.mmModel || v.mvModel || "";
    if (!mmCode || !fullModel) continue;
    // Heuristic: first word = model, rest = variant
    const words = fullModel.trim().split(/\s+/);
    const modelKey = words[0] || fullModel;
    const variantKey = words.slice(1).join(" ") || fullModel;
    // Build year list from introDate / disconDate
    const years: number[] = [];
    const intro = v.introDate || v.IntroYear;
    const discon = v.disconDate || v.DisconYear;
    const startYear = intro ? parseInt(String(intro).slice(0, 4), 10) : new Date().getFullYear() - 10;
    const endYear = discon ? parseInt(String(discon).slice(0, 4), 10) : new Date().getFullYear() + 1;
    if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
      for (let y = startYear; y <= endYear; y++) years.push(y);
    }
    if (!out[modelKey]) out[modelKey] = {};
    out[modelKey][variantKey] = { c: mmCode, y: years.length ? years : [new Date().getFullYear()] };
  }
  return out;
}

/** Fetch live model data from Imagin8 (flat-fee unlimited). */
async function loadLiveMakeData(make: string, getToken?: () => Promise<string | null>): Promise<CatalogueMake | null> {
  try {
    const token = getToken ? await getToken() : null;
    const qs = new URLSearchParams({ make }).toString();
    const res = await fetch(`/api/imagin8/models?${qs}`, {
      method: "GET",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const variants = Array.isArray(data.variants) ? data.variants : [];
    if (!variants.length) return null;
    return liveToCatalogue(variants);
  } catch {
    return null;
  }
}

function loadMakeData(make: string, getToken?: () => Promise<string | null>): Promise<CatalogueMake> {
  const cached = makeDataCache.get(make);
  if (cached) return Promise.resolve(cached);
  const pending = makeDataPromises.get(make);
  if (pending) return pending;
  const p = loadMakeIndex().then(async (idx) => {
    // Try live API first for fresher data
    const live = await loadLiveMakeData(make, getToken);
    if (live && Object.keys(live).length) {
      makeDataCache.set(make, live);
      return live;
    }
    // Fall back to static curated catalogue
    const entry = idx.find((e) => e.name === make);
    if (!entry) return {} as CatalogueMake;
    return fetch(`/catalogue/${entry.file}`)
      .then((r) => r.json())
      .then((d: CatalogueMake) => { makeDataCache.set(make, d); return d; });
  });
  makeDataPromises.set(make, p);
  return p;
}

export interface VehiclePickerValue {
  make: string;
  model: string;
  year: number;
  variant: string;
  mmCode: string;
}

interface Props {
  initial?: Partial<VehiclePickerValue>;
  onSelect: (v: VehiclePickerValue) => void;
  theme?: "flow" | "lens" | "inspect";
  getToken?: () => Promise<string | null>;
}

/* ── Searchable select ─────────────────────────────────── */

function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  theme,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  theme: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({ left: 0, width: 0, maxHeight: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !dropdownRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Measure the trigger and place the menu so it always stays on-screen:
  // flip up when it would run past the bottom, and clamp height + left/right
  // to the viewport so it can never be clipped by an ancestor or pushed off.
  const place = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const GAP = 4, MARGIN = 8, MAX = 288, MIN_W = 200;
    const below = window.innerHeight - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const flip = below < 200 && above > below;
    const width = Math.min(Math.max(r.width, MIN_W), window.innerWidth - MARGIN * 2);
    const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - width - MARGIN));
    setPos({
      top: flip ? undefined : r.bottom + GAP,
      bottom: flip ? window.innerHeight - r.top + GAP : undefined,
      left,
      width,
      maxHeight: Math.max(120, Math.min(MAX, flip ? above : below)),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    setQuery("");
    inputRef.current?.focus();
  }, [open, place]);

  // Reposition — never close — on scroll/resize. On a phone, auto-focusing the
  // search box opens the keyboard, which fires resize/scroll; scrolling the
  // option list fires scroll too. Closing on those made the menu pop straight
  // back shut the instant it opened. Only an outside tap closes it (handler
  // above). rAF-throttled so a scroll storm stays cheap.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onMove = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; place(); });
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, place]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const inputCls =
    theme === "flow"
      ? "w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
      : "w-full min-h-[48px] bg-[rgba(232,234,230,0.04)] px-3 rounded-[12px] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] text-[16px] text-[#E8EAE6] placeholder-[rgba(232,234,230,0.32)] outline-none focus:border-[#4FE3DC] transition-colors";

  const labelCls =
    theme === "flow"
      ? "text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]"
      : "text-[13px] font-medium text-[rgba(232,234,230,0.72)] block mb-1";

  return (
    <div ref={ref} className="relative flex flex-col">
      <label className={labelCls}>{label}</label>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={inputCls + " mt-0.5 flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"}
      >
        <span title={value || undefined} className={"truncate min-w-0 " + (value ? "" : "opacity-40")}>{value || placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, zIndex: 9999 }}
          className="rounded-xl border border-white/10 bg-[#1a1d21] shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
            <Search size={14} className="text-white/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder-white/30"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="cursor-pointer">
                <X size={12} className="text-white/40" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto overscroll-contain">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-[13px] text-white/40 text-center">No matches</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                title={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-[14px] leading-snug whitespace-normal break-words cursor-pointer hover:bg-white/5 transition-colors ${opt === value ? "text-[#4FE3DC] bg-white/5" : "text-white/80"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Main picker ───────────────────────────────────────── */

export default function VehiclePicker({ initial, onSelect, theme = "flow", getToken }: Props) {
  const [makeIndex, setMakeIndex] = useState<MakeIndexEntry[] | null>(makeIndexCache);
  const [make, setMake] = useState(initial?.make || "");
  const [model, setModel] = useState(initial?.model || "");
  const [variant, setVariant] = useState(initial?.variant || "");
  const [year, setYear] = useState(initial?.year || 0);
  const [makeData, setMakeData] = useState<CatalogueMake | null>(
    initial?.make ? makeDataCache.get(initial.make) || null : null
  );
  const [makeLoading, setMakeLoading] = useState(false);

  useEffect(() => { loadMakeIndex().then(setMakeIndex); }, []);

  // Load the selected make's subtree on demand.
  // Live API first (fresher data), static fallback.
  useEffect(() => {
    if (!make) { setMakeData(null); return; }
    const cached = makeDataCache.get(make);
    if (cached) { setMakeData(cached); return; }
    let alive = true;
    setMakeLoading(true);
    loadMakeData(make, getToken).then((d) => { if (alive) { setMakeData(d); setMakeLoading(false); } });
    return () => { alive = false; };
  }, [make, getToken]);

  const makes = useMemo(() => (makeIndex ? makeIndex.map((e) => e.name) : []), [makeIndex]);

  const models = useMemo(
    () => (makeData ? Object.keys(makeData).sort() : []),
    [makeData]
  );

  const variants = useMemo(
    () => (makeData && model && makeData[model] ? Object.keys(makeData[model]).sort() : []),
    [makeData, model]
  );

  const years = useMemo(() => {
    const v = makeData?.[model]?.[variant];
    return v ? v.y : [];
  }, [makeData, model, variant]);

  const handleMake = useCallback((v: string) => {
    setMake(v); setModel(""); setVariant(""); setYear(0);
  }, []);

  const handleModel = useCallback((v: string) => {
    setModel(v); setVariant(""); setYear(0);
  }, []);

  const handleVariant = useCallback((v: string) => {
    setVariant(v); setYear(0);
  }, []);

  const handleYear = useCallback(
    (v: string) => {
      const y = Number(v);
      setYear(y);
      const entry = makeData?.[model]?.[variant];
      if (entry) {
        onSelect({ make, model, variant, year: y, mmCode: entry.c });
      }
    },
    [makeData, make, model, variant, onSelect]
  );

  if (!makeIndex) {
    return <div className="text-[13px] text-white/40 py-2">Loading vehicle catalogue…</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3">
      <SearchSelect theme={theme} label="Make" options={makes} value={make} onChange={handleMake} placeholder="Select make" />
      <SearchSelect theme={theme} label="Model" options={models} value={model} onChange={handleModel} placeholder={makeLoading ? "Loading…" : "Select model"} disabled={!make || makeLoading} />
      <div className="sm:col-span-2"><SearchSelect theme={theme} label="Variant" options={variants} value={variant} onChange={handleVariant} placeholder="Select variant" disabled={!model} /></div>
      <SearchSelect theme={theme} label="Year" options={years.map(String)} value={year ? String(year) : ""} onChange={handleYear} placeholder="Year" disabled={!variant} />
    </div>
  );
}
