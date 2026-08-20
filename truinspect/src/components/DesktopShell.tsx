import React from 'react';
import { Search, Check, Copy, RefreshCw, Plus, LogOut, Car, Users } from 'lucide-react';
import { Vehicle } from '../types';
import { computeInspectionReadiness } from '../lib/readiness';
import { DEFAULT_TEMPLATE } from '../templates';

interface DesktopShellProps {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  onSelectVehicle: (vehicle: Vehicle) => void;
  activeView: string;
  syncStatus: 'synced' | 'syncing' | 'error';
  onForceSync: () => void;
  children: React.ReactNode;
  onAddVehicle?: () => void;
  onSignOut?: () => void;
  dealerName?: string;
  section?: 'vehicles' | 'buyers';
  onSectionChange?: (s: 'vehicles' | 'buyers') => void;
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
  syncStatus,
  onForceSync,
  onAddVehicle,
  onSignOut,
  dealerName,
  section = 'vehicles',
  onSectionChange,
  children,
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
      <aside
        className="ti-sidebar w-[340px] shrink-0 flex flex-col"
        style={{ background: 'var(--ink)', borderRight: '1px solid var(--glass-line)' }}
      >
        {/* Section nav */}
        {onSectionChange && (
          <div className="px-4 pt-4">
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
              {([['vehicles', 'Vehicles', Car], ['buyers', 'Buyers', Users]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => onSectionChange(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-md cursor-pointer transition-colors"
                  style={{
                    minHeight: 32,
                    background: section === key ? 'var(--cyan)' : 'transparent',
                    color: section === key ? 'var(--tru-ink-900, #06080D)' : 'var(--muted)',
                  }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + add (vehicles only) */}
        {section === 'vehicles' && (
        <div className="px-4 py-4 space-y-3" style={{ borderBottom: '1px solid var(--glass-line)' }}>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vehicles…"
              className="ti-input pl-10"
              style={{ fontFamily: 'var(--mono)' }}
            />
          </div>
          {onAddVehicle && (
            <button
              onClick={onAddVehicle}
              className="btn-primary on-fill w-full flex items-center justify-center gap-2 text-[13px] cursor-pointer"
              style={{ minHeight: 40 }}
            >
              <Plus size={15} /> Add Vehicle
            </button>
          )}
          <div className="flex items-center justify-between text-[12px] px-0.5" style={{ color: 'var(--muted)' }}>
            <span>{filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}</span>
            <button
              onClick={onForceSync}
              className="flex items-center gap-1.5 cursor-pointer transition-colors hover:text-[var(--white-dim)]"
            >
              <RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync error' : 'Synced'}
            </button>
          </div>
        </div>
        )}

        {/* Vehicle list (vehicles only) */}
        {section === 'vehicles' && (
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              {searchTerm ? 'No vehicles match your search.' : 'No vehicles in catalogue.'}
            </div>
          ) : (
            filtered.map((vehicle) => {
              const isActive = vehicle.id === activeVehicleId;
              const requiredTaken = DEFAULT_TEMPLATE.slots.filter((s) => s.required && vehicle.photos?.[s.id]).length;
              const readiness = computeInspectionReadiness(vehicle, DEFAULT_TEMPLATE);
              const pct = Math.round((requiredTaken / totalRequired) * 100);

              return (
                <div
                  key={vehicle.id}
                  onClick={() => onSelectVehicle(vehicle)}
                  className="px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid var(--glass-line)',
                    borderLeft: isActive ? '2px solid var(--cyan)' : '2px solid transparent',
                    background: isActive ? 'var(--cyan-faint)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(232,234,230,0.03)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-semibold leading-tight truncate" style={{ color: isActive ? 'var(--white)' : 'var(--white-dim)' }}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h4>
                      <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                        {vehicle.trim || 'Standard'} · R {(vehicle.price || 0).toLocaleString('en-ZA')}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold shrink-0 mt-0.5" style={{ color: readiness.color }}>
                      {readiness.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {vehicle.stockNumber && (
                      <button
                        onClick={(e) => { e.stopPropagation(); copyStockNumber(vehicle.stockNumber!, vehicle.id); }}
                        className="text-[11px] flex items-center gap-1 transition-colors hover:text-[var(--white-dim)]"
                        style={{ fontFamily: 'var(--mono)', color: 'var(--faint)' }}
                      >
                        {vehicle.stockNumber}
                        {copiedStockId === vehicle.id ? <Check size={10} style={{ color: 'var(--cyan)' }} /> : <Copy size={10} />}
                      </button>
                    )}
                    <div className="flex-1" />
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{pct}%</span>
                    <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(232,234,230,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: requiredTaken === totalRequired ? 'var(--cyan)' : '#6366F1' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}

        {section === 'buyers' && <div className="flex-1" />}

        {/* Footer: signed-in dealer + sign out */}
        {onSignOut && (
          <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--glass-line)' }}>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--white-dim)' }}>{dealerName || 'Signed in'}</p>
              <p className="text-[11px]" style={{ color: 'var(--faint)' }}>Manager</p>
            </div>
            <button
              onClick={onSignOut}
              className="tru-btn-ghost flex items-center gap-1.5 px-2.5 text-[12px] cursor-pointer shrink-0"
              style={{ minHeight: 34 }}
              title="Sign out of this device"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content area ─────────────────────────────────── */}
      <main className="ti-main flex-1 min-w-0 overflow-hidden flex flex-col" style={{ background: 'var(--ink)' }}>
        {children}
      </main>
    </div>
  );
}
