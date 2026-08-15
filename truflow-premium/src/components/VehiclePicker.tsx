import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";

/*  Cascading vehicle selector backed by the TransUnion M&M code catalogue.
    Shape: { [make]: { [model]: { [variant]: { c: mmCode, y: [years] } } } }
    The JSON lives in /vehicle-catalogue.json (~1.7 MB, ~260 KB gzipped).       */

type CatalogueVariant = { c: string; y: number[] };
type CatalogueModel = Record<string, CatalogueVariant>;
type CatalogueMake = Record<string, CatalogueModel>;
type Catalogue = Record<string, CatalogueMake>;

let catalogueCache: Catalogue | null = null;
let cataloguePromise: Promise<Catalogue> | null = null;

function loadCatalogue(): Promise<Catalogue> {
  if (catalogueCache) return Promise.resolve(catalogueCache);
  if (cataloguePromise) return cataloguePromise;
  cataloguePromise = fetch("/vehicle-catalogue.json")
    .then((r) => r.json())
    .then((d: Catalogue) => { catalogueCache = d; return d; });
  return cataloguePromise;
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
  useEffect(() => {
    if (!open || !btnRef.current) return;
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
    setQuery("");
    inputRef.current?.focus();
  }, [open]);

  // A fixed-position menu goes stale the moment the page scrolls or resizes;
  // closing it is simpler and less jarring than chasing the trigger.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

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

export default function VehiclePicker({ initial, onSelect, theme = "flow" }: Props) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(catalogueCache);
  const [make, setMake] = useState(initial?.make || "");
  const [model, setModel] = useState(initial?.model || "");
  const [variant, setVariant] = useState(initial?.variant || "");
  const [year, setYear] = useState(initial?.year || 0);

  useEffect(() => { loadCatalogue().then(setCatalogue); }, []);

  const makes = useMemo(() => (catalogue ? Object.keys(catalogue).sort() : []), [catalogue]);

  const models = useMemo(
    () => (catalogue && make && catalogue[make] ? Object.keys(catalogue[make]).sort() : []),
    [catalogue, make]
  );

  const variants = useMemo(
    () =>
      catalogue && make && model && catalogue[make]?.[model]
        ? Object.keys(catalogue[make][model]).sort()
        : [],
    [catalogue, make, model]
  );

  const years = useMemo(() => {
    const v = catalogue?.[make]?.[model]?.[variant];
    return v ? v.y : [];
  }, [catalogue, make, model, variant]);

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
      const entry = catalogue?.[make]?.[model]?.[variant];
      if (entry) {
        onSelect({ make, model, variant, year: y, mmCode: entry.c });
      }
    },
    [catalogue, make, model, variant, onSelect]
  );

  if (!catalogue) {
    return <div className="text-[13px] text-white/40 py-2">Loading vehicle catalogue…</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
      <SearchSelect theme={theme} label="Make" options={makes} value={make} onChange={handleMake} placeholder="Select make" />
      <SearchSelect theme={theme} label="Model" options={models} value={model} onChange={handleModel} placeholder="Select model" disabled={!make} />
      <div className="col-span-2"><SearchSelect theme={theme} label="Variant" options={variants} value={variant} onChange={handleVariant} placeholder="Select variant" disabled={!model} /></div>
      <SearchSelect theme={theme} label="Year" options={years.map(String)} value={year ? String(year) : ""} onChange={handleYear} placeholder="Year" disabled={!variant} />
    </div>
  );
}
