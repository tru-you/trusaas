import React from 'react';
import { Search, Car, Plus, Check, Copy, Trash2, Camera, BarChart3, FileText, Settings, Sliders, Pencil, ChevronDown, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { Vehicle } from '../types';
import { computeInspectionReadiness } from '../lib/readiness';
import { DEFAULT_TEMPLATE } from '../templates';

type DesktopView = 'dashboard' | 'settings' | 'vehicle-detail' | 'report' | 'trade-in-report' | 'valuation' | 'damage' | 'checklist';

interface DesktopShellProps {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  onSelectVehicle: (vehicle: Vehicle) => void;
  activeView: string;
  syncStatus: 'synced' | 'syncing' | 'error';
  onForceSync: () => void;
  /** The current view component to render in the main panel */
  children: React.ReactNode;
  /** Sidebar actions */
  onOpenReport?: (vehicle: Vehicle) => void;
  onOpenTradeInReport?: (vehicle: Vehicle) => void;
  onOpenTradeIn?: (vehicle: Vehicle) => void;
  onInspect?: (vehicle: Vehicle) => void;
  onDeleteVehicle?: (id: string) => void;
}

export default function DesktopShell({
  vehicles,
  activeVehicleId,
  onSelectVehicle,
  activeView,
  syncStatus,
  onForceSync,
  children,
  onOpenReport,
  onOpenTradeInReport,
  onOpenTradeIn,
  onInspect,
  onDeleteVehicle,
}: DesktopShellProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [copiedStockId, setCopiedStockId] = React.useState<string | null>(null);

  const copyStockNumber = (stockNumber: string, vehicleId: string) => {
    navigator.clipboard?.writeText(stockNumber);
    setCopiedStockId(vehicleId);
    setTimeout(() => setCopiedStockId(null), 1500);
  };

  const filtered = vehicles.filter((v) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      (v.stockNumber || '').toLowerCase().includes(q) ||
      (v.vin || '').toLowerCase().includes(q) ||
      String(v.year).includes(q)
    );
  });

  const totalRequired = DEFAULT_TEMPLATE.slots.filter((s) => s.required).length;

  return (
    <div className="ti-desktop-shell flex flex-1 min-h-0 overflow-hidden">
      {/* ── Sidebar: vehicle list ─────────────────────────────── */}
      <aside className="ti-sidebar w-[360px] shrink-0 flex flex-col border-r border-neutral-800 bg-neutral-950">
        {/* Search + sync */}
        <div className="px-3 py-3 border-b border-neutral-800 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vehicles…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] bg-neutral-900 border border-neutral-800 text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
            <span>{filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}</span>
            <button
              onClick={onForceSync}
              className="flex items-center gap-1 hover:text-neutral-300 transition-colors"
            >
              <RefreshCw size={11} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync error' : 'Synced'}
            </button>
          </div>
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-[13px]">
              {searchTerm ? 'No vehicles match your search.' : 'No vehicles in catalogue.'}
            </div>
          ) : (
            filtered.map((vehicle) => {
              const isActive = vehicle.id === activeVehicleId;
              const requiredSlots = DEFAULT_TEMPLATE.slots.filter((s) => s.required);
              const requiredTaken = requiredSlots.filter((s) => vehicle.photos?.[s.id]).length;
              const readiness = computeInspectionReadiness(vehicle, DEFAULT_TEMPLATE);
              const pct = Math.round((requiredTaken / totalRequired) * 100);

              return (
                <div
                  key={vehicle.id}
                  onClick={() => onSelectVehicle(vehicle)}
                  className={`px-3 py-3 border-b border-neutral-900 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                      : 'hover:bg-neutral-900/60 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-[14px] font-semibold leading-tight truncate ${
                        isActive ? 'text-[#E8EAE6]' : 'text-neutral-300'
                      }`}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h4>
                      <p className="text-[12px] text-neutral-500 mt-0.5 truncate">
                        {vehicle.trim || 'Standard'} · R {(vehicle.price || 0).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold shrink-0 mt-0.5"
                      style={{ color: readiness.color }}
                    >
                      {readiness.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {vehicle.stockNumber && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyStockNumber(vehicle.stockNumber!, vehicle.id);
                        }}
                        className="text-[11px] font-mono text-neutral-600 hover:text-neutral-400 flex items-center gap-1"
                      >
                        {vehicle.stockNumber}
                        {copiedStockId === vehicle.id ? <Check size={10} className="text-cyan-400" /> : <Copy size={10} />}
                      </button>
                    )}
                    <div className="flex-1" />
                    <span className="text-[11px] text-neutral-600">{pct}%</span>
                    <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${requiredTaken === totalRequired ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────── */}
      <main className="ti-main flex-1 min-w-0 overflow-hidden flex flex-col bg-neutral-950">
        {children}
      </main>
    </div>
  );
}
