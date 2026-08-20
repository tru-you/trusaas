import React from 'react';
import { Plus, Camera, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Vehicle } from '../types';
import { computeInspectionReadiness } from '../lib/readiness';
import { DEFAULT_TEMPLATE } from '../templates';

interface Props {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onAddVehicle: () => void;
}

export default function DesktopDashboard({ vehicles, onSelectVehicle, onAddVehicle }: Props) {
  const totalRequired = DEFAULT_TEMPLATE.slots.filter((s) => s.required).length;

  const ready = vehicles.filter((v) => {
    const taken = DEFAULT_TEMPLATE.slots.filter((s) => s.required && v.photos?.[s.id]).length;
    return taken === totalRequired;
  });
  const inProgress = vehicles.filter((v) => {
    const taken = DEFAULT_TEMPLATE.slots.filter((s) => s.required && v.photos?.[s.id]).length;
    return taken > 0 && taken < totalRequired;
  });
  const notStarted = vehicles.filter((v) => {
    const taken = DEFAULT_TEMPLATE.slots.filter((s) => s.required && v.photos?.[s.id]).length;
    return taken === 0;
  });
  const withDamage = vehicles.filter((v) => {
    const findings = v.damageFindings ? Object.values(v.damageFindings).flat() : [];
    return findings.length > 0;
  });

  const stats = [
    { label: 'Total Vehicles', value: vehicles.length, color: 'text-[#E8EAE6]' },
    { label: 'Ready', value: ready.length, color: 'text-emerald-400' },
    { label: 'In Progress', value: inProgress.length, color: 'text-indigo-400' },
    { label: 'Not Started', value: notStarted.length, color: 'text-neutral-500' },
    { label: 'With Damage', value: withDamage.length, color: 'text-amber-400' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold text-[#E8EAE6]">Inspection Dashboard</h1>
          <button
            onClick={onAddVehicle}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#06080D] text-[13px] font-semibold transition"
          >
            <Plus size={15} />
            Add Vehicle
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
              <p className="text-[11px] text-neutral-500 uppercase tracking-wider">{s.label}</p>
              <p className={`text-[24px] font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Camera size={48} className="text-neutral-700 mb-4" />
            <p className="text-[15px] text-neutral-400 mb-2">No vehicles in your catalogue yet</p>
            <p className="text-[13px] text-neutral-600 mb-6">Add a vehicle to start inspecting — your field workers capture photos on their phones.</p>
            <button
              onClick={onAddVehicle}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#06080D] text-[13px] font-semibold"
            >
              Add First Vehicle
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-[14px] font-semibold text-neutral-400">Recent Vehicles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {vehicles.slice(0, 12).map((vehicle) => {
                const readiness = computeInspectionReadiness(vehicle, DEFAULT_TEMPLATE);
                const requiredSlots = DEFAULT_TEMPLATE.slots.filter((s) => s.required);
                const requiredTaken = requiredSlots.filter((s) => vehicle.photos?.[s.id]).length;
                const pct = Math.round((requiredTaken / totalRequired) * 100);
                const damageCount = vehicle.damageFindings ? Object.values(vehicle.damageFindings).flat().length : 0;

                return (
                  <button
                    key={vehicle.id}
                    onClick={() => onSelectVehicle(vehicle)}
                    className="text-left rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:bg-neutral-800/60 hover:border-neutral-700 transition group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold text-[#E8EAE6] truncate">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-[12px] text-neutral-500 mt-0.5">
                          {vehicle.trim || 'Standard'} · R {(vehicle.price || 0).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: readiness.color }}>
                        {readiness.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex-1">
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${requiredTaken === totalRequired ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-neutral-500 shrink-0">{pct}%</span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-600">
                      <span className="flex items-center gap-1">
                        <Camera size={11} /> {requiredTaken}/{totalRequired}
                      </span>
                      {damageCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-500/70">
                          <AlertTriangle size={11} /> {damageCount} damage
                        </span>
                      )}
                      {vehicle.inspectionPoints && Object.keys(vehicle.inspectionPoints).length > 0 && (
                        <span className="flex items-center gap-1 text-emerald-500/70">
                          <CheckCircle2 size={11} /> Inspected
                        </span>
                      )}
                    </div>
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
