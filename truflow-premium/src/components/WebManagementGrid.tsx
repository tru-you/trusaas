import React, { useState, useMemo, useRef } from "react";
import { Vehicle } from "../types";
import { Search, ArrowUpDown, Globe, Check, X } from "lucide-react";
import { useMoney, useMarket } from "../contexts/MarketContext";
import { formatDistance } from "./market";

interface Props {
  vehicles: Vehicle[];
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  role?: 'salesperson' | 'manager' | 'owner';
}

type SortKey = "stockNumber" | "make" | "year" | "mileage" | "retailPrice" | "costPrice" | "daysInInventory";
type SortDir = "asc" | "desc";

export default function WebManagementGrid({ vehicles, onUpdateVehicle, role }: Props) {
  const money = useMoney();
  const market = useMarket();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "INVENTORY" | "SOLD">("all");
  const [webFilter, setWebFilter] = useState<"all" | "online" | "offline">("all");
  const [sortKey, setSortKey] = useState<SortKey>("stockNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    let list = [...vehicles];
    if (statusFilter !== "all") list = list.filter(v => v.status === statusFilter);
    if (webFilter === "online") list = list.filter(v => v.showOnWebsite);
    if (webFilter === "offline") list = list.filter(v => !v.showOnWebsite);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        `${v.stockNumber} ${v.make} ${v.model} ${v.year} ${v.vin || ""} ${v.registrationNumber || ""}`.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [vehicles, search, statusFilter, webFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const startEdit = (id: string, field: string, currentValue: any) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue ?? ""));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const numFields = ["retailPrice", "costPrice", "mileage", "year", "minimumPrice", "truPrice"];
    const value = numFields.includes(field) ? Number(editValue) || 0 : editValue;
    onUpdateVehicle(id, { [field]: value } as any);
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const onlineCount = vehicles.filter(v => v.showOnWebsite).length;
  const totalFloor = vehicles.filter(v => v.status !== "SOLD").reduce((s, v) => s + v.costPrice, 0);

  const allColumns: { key: string; label: string; sortable?: SortKey; editable?: boolean; width: string; align?: "right" | "center" }[] = [
    { key: "stockNumber", label: "Stock #", sortable: "stockNumber", editable: true, width: "w-[90px]" },
    { key: "make", label: "Make", sortable: "make", editable: true, width: "w-[110px]" },
    { key: "model", label: "Model", editable: true, width: "w-[120px]" },
    { key: "year", label: "Year", sortable: "year", editable: true, width: "w-[65px]", align: "center" },
    { key: "variant", label: "Variant", editable: true, width: "w-[140px]" },
    { key: "mileage", label: "Mileage", sortable: "mileage", editable: true, width: "w-[90px]", align: "right" },
    { key: "retailPrice", label: "Retail", sortable: "retailPrice", editable: true, width: "w-[110px]", align: "right" },
    { key: "costPrice", label: "Cost", sortable: "costPrice", editable: true, width: "w-[110px]", align: "right" },
    { key: "color", label: "Colour", editable: true, width: "w-[90px]" },
    { key: "transmission", label: "Trans", editable: false, width: "w-[70px]" },
    { key: "fuelType", label: "Fuel", editable: false, width: "w-[70px]" },
    { key: "showOnWebsite", label: "Online", width: "w-[65px]", align: "center" },
    { key: "category", label: "Category", editable: true, width: "w-[100px]" },
  ];
  const columns = allColumns.filter(c => role === 'salesperson' ? c.key !== 'costPrice' : true);

  const renderCell = (v: Vehicle, col: typeof columns[0]) => {
    const val = (v as any)[col.key];
    const isEditing = editingCell?.id === v.id && editingCell?.field === col.key;

    if (col.key === "showOnWebsite") {
      return (
        <button
          onClick={() => onUpdateVehicle(v.id, { showOnWebsite: !v.showOnWebsite })}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition cursor-pointer ${
            v.showOnWebsite ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-[rgba(232,234,230,0.3)]"
          }`}
        >
          {v.showOnWebsite ? <Check size={12} /> : <X size={12} />}
        </button>
      );
    }

    if (col.key === "category") {
      return (
        <select
          value={v.category || "used"}
          onChange={e => onUpdateVehicle(v.id, { category: e.target.value as any })}
          className="bg-transparent text-[12px] text-[color:var(--white)] border border-white/10 rounded px-1 py-0.5 cursor-pointer focus:border-[color:var(--cyan)] outline-none"
        >
          <option value="used">Used</option>
          <option value="select">Select</option>
          <option value="performance">Performance</option>
        </select>
      );
    }

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
          className={`w-full bg-black/30 border border-[color:var(--cyan)]/50 rounded px-1.5 py-0.5 text-[12px] text-[color:var(--white)] outline-none font-mono ${col.align === "right" ? "text-right" : ""}`}
        />
      );
    }

    if (col.editable) {
      const display = ["retailPrice", "costPrice"].includes(col.key) && typeof val === "number"
        ? money(val)
        : col.key === "mileage" && typeof val === "number"
        ? formatDistance(val, market.distanceUnit, market.locale)
        : val ?? "—";
      return (
        <span
          onClick={() => startEdit(v.id, col.key, val)}
          className={`cursor-pointer hover:text-[color:var(--cyan)] transition border-b border-dashed border-transparent hover:border-[color:var(--cyan)]/30 ${
            col.align === "right" ? "font-mono" : ""
          }`}
        >
          {display}
        </span>
      );
    }

    return <span>{val ?? "—"}</span>;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--white)]">Web Management</h2>
          <p className="text-[12px] text-[color:var(--muted)]">Click any cell to edit inline · changes save automatically</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[color:var(--glass)] border border-white/10 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Total Stock</span>
          <span className="text-xl font-mono font-semibold text-[color:var(--white)]">{vehicles.length}</span>
        </div>
        <div className="bg-[color:var(--glass)] border border-white/10 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Online</span>
          <span className="text-xl font-mono font-semibold text-emerald-400">{onlineCount}</span>
        </div>
        <div className="bg-[color:var(--glass)] border border-white/10 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Offline</span>
          <span className="text-xl font-mono font-semibold text-amber-400">{vehicles.length - onlineCount}</span>
        </div>
        <div className="bg-[color:var(--glass)] border border-white/10 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Floor Value</span>
          <span className="text-xl font-mono font-semibold text-[color:var(--white)]">{money(totalFloor)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,234,230,0.4)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stock #, make, model, VIN..."
            className="w-full pl-9 pr-3 py-2 bg-[color:var(--glass)] border border-white/10 rounded-lg text-[13px] text-[color:var(--white)] placeholder:text-[rgba(232,234,230,0.3)] outline-none focus:border-[color:var(--cyan)]/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="INVENTORY">In Stock</option>
          <option value="SOLD">Sold</option>
        </select>
        <select
          value={webFilter}
          onChange={e => setWebFilter(e.target.value as any)}
          className="bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none cursor-pointer"
        >
          <option value="all">All Visibility</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.72)]">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`sticky top-0 z-10 bg-[color:var(--ink-2)] border-b border-white/10 px-3 py-2.5 ${col.width} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.sortable ? "cursor-pointer hover:text-[color:var(--white)] select-none" : ""}`}
                  onClick={() => col.sortable && toggleSort(col.sortable)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.sortable && <ArrowUpDown size={10} className="text-[color:var(--cyan)]" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-[rgba(232,234,230,0.45)]">No vehicles match your filters.</td></tr>
            ) : filtered.map((v, i) => (
              <tr key={v.id} className={`${i % 2 ? "bg-[rgba(255,255,255,0.02)]" : ""} hover:bg-[rgba(255,255,255,0.06)] transition-colors`}>
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${col.width} text-[color:var(--white)] ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}
                  >
                    {renderCell(v, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-[color:var(--muted)] text-right">{filtered.length} of {vehicles.length} vehicles</div>
    </div>
  );
}
