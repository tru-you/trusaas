import React from 'react';
import { Plus, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Vehicle } from '../types';
import { computeInspectionReadiness } from '../lib/readiness';
import { DEFAULT_TEMPLATE } from '../templates';
import { useMoney } from '../contexts/MarketContext';
import type { SetupStatus } from '../lib/setupStatus';
import { SetupChecklistCard } from './SetupPrompt';

interface Props {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onAddVehicle: () => void;
  /** First-run dealership setup checklist (server-derived). Rendered as a
   *  quiet card above the stats while required items are missing. */
  setupStatus?: SetupStatus | null;
  onSetUp?: () => void;
  onSnooze?: () => void;
}

export default function DesktopDashboard({ vehicles, onSelectVehicle, onAddVehicle, setupStatus, onSetUp, onSnooze }: Props) {
  const money = useMoney();
  const totalRequired = DEFAULT_TEMPLATE.slots.filter((s) => s.required).length;
  const taken = (v: Vehicle) => DEFAULT_TEMPLATE.slots.filter((s) => s.required && v.photos?.[s.id]).length;

  const ready = vehicles.filter((v) => taken(v) === totalRequired);
  const inProgress = vehicles.filter((v) => taken(v) > 0 && taken(v) < totalRequired);
  const notStarted = vehicles.filter((v) => taken(v) === 0);
  const withDamage = vehicles.filter((v) => (v.damageFindings ? Object.values(v.damageFindings).flat() : []).length > 0);

  const stats = [
    { label: 'Total Vehicles', value: vehicles.length },
    { label: 'Ready', value: ready.length, accent: true },
    { label: 'In Progress', value: inProgress.length },
    { label: 'Not Started', value: notStarted.length },
    { label: 'With Damage', value: withDamage.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold" style={{ color: 'var(--white)', letterSpacing: 'var(--track-h2)' }}>Manager Dashboard</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>Review, edit and send — field workers capture on their phones.</p>
          </div>
          <button
            onClick={onAddVehicle}
            className="btn-primary on-fill flex items-center gap-2 px-4 text-[14px] cursor-pointer"
            style={{ minHeight: 42 }}
          >
            <Plus size={16} /> Add Vehicle
          </button>
        </div>

        {/* Dealership setup reminder — quiet card while required identity
            fields are missing from this instance's per-slug record. */}
        {setupStatus && (
          <SetupChecklistCard status={setupStatus} onSetUp={onSetUp} onSnooze={onSnooze} />
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="ti-stat">
              <p className="ti-stat-label">{s.label}</p>
              <p className="ti-stat-value" style={s.accent ? { color: 'var(--cyan)' } : undefined}>{s.value}</p>
            </div>
          ))}
        </div>

        {vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Camera size={48} style={{ color: 'var(--faint)' }} className="mb-4" />
            <p className="text-[15px] mb-1" style={{ color: 'var(--white-dim)' }}>No vehicles in your catalogue yet</p>
            <p className="text-[13px] mb-6" style={{ color: 'var(--muted)' }}>Add a vehicle to start — your field workers capture photos on their phones.</p>
            <button onClick={onAddVehicle} className="btn-primary on-fill px-6 text-[14px] cursor-pointer" style={{ minHeight: 44 }}>
              Add First Vehicle
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-[13px] font-semibold" style={{ color: 'var(--white-dim)' }}>Vehicles — done on mobile &amp; what's still needed</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {vehicles.map((vehicle) => {
                const readiness = computeInspectionReadiness(vehicle);
                const requiredTaken = taken(vehicle);
                const pct = Math.round((requiredTaken / totalRequired) * 100);
                const damageCount = vehicle.damageFindings ? Object.values(vehicle.damageFindings).flat().length : 0;
                const inspected = vehicle.inspectionPoints && Object.keys(vehicle.inspectionPoints).length > 0;

                // What the field worker has done vs. what the manager still needs
                const done: string[] = [];
                const needed: string[] = [];
                (requiredTaken > 0 ? done : needed).push(requiredTaken === totalRequired ? 'All photos' : `Photos ${requiredTaken}/${totalRequired}`);
                if (inspected) done.push('Inspected'); else needed.push('Inspection');
                if (damageCount > 0) done.push(`${damageCount} damage tag${damageCount > 1 ? 's' : ''}`);
                if (vehicle.tradeInData) done.push('Trade-in');
                if (!vehicle.price) needed.push('Price');
                if (!vehicle.extras) needed.push('Extras');

                return (
                  <button
                    key={vehicle.id}
                    onClick={() => onSelectVehicle(vehicle)}
                    className="ti-card text-left p-4 cursor-pointer transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold truncate" style={{ color: 'var(--white)' }}>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {vehicle.trim || 'Standard'} · {vehicle.price ? money(vehicle.price) : 'No price set'}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: readiness.color }}>{readiness.label}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(232,234,230,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: requiredTaken === totalRequired ? 'var(--cyan)' : '#6366F1' }} />
                      </div>
                      <span className="text-[11px] shrink-0" style={{ color: 'var(--muted)' }}>{pct}%</span>
                    </div>

                    {/* Done — what the field worker captured on mobile */}
                    {done.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {done.map((d) => (
                          <span key={d} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--cyan-faint)', color: 'var(--cyan)' }}>
                            <CheckCircle2 size={9} /> {d}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Needed — what the manager must still add */}
                    {needed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {needed.map((n) => (
                          <span key={n} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,234,230,0.06)', color: 'var(--muted)' }}>
                            <AlertTriangle size={9} /> {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
