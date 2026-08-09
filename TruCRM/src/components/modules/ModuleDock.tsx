import React, { useState, useEffect } from 'react';
import { Puzzle, Plus, X, Check, Home, Car, Building2, Store, Wrench, Truck, Package, Cloud, Download, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type InstalledModule = {
  id: string;
  name: string;
  description: string;
  icon: string;
  installed: boolean;
  view?: string;
  addedAt?: string;
};

const STORAGE_KEY = 'trusaas_modules_v1';

const MODULE_CATALOG: Omit<InstalledModule, 'installed' | 'addedAt'>[] = [
  {
    id: 'truproperty',
    name: 'TruProperty',
    description: 'Property portfolio — listings, tenants, leases and maintenance.',
    icon: 'Home',
    view: 'truproperty',
  },
  {
    id: 'trudealer',
    name: 'TruDealer',
    description: 'Dealership operations — stock, F&I, workshop and showroom.',
    icon: 'Car',
    view: 'trudealer',
  },
  {
    id: 'truservice',
    name: 'TruService',
    description: 'Field service — jobs, technicians, parts and dispatch.',
    icon: 'Wrench',
    view: 'truservice',
  },
  {
    id: 'trulogistics',
    name: 'TruLogistics',
    description: 'Fleet and delivery — vehicles, routes and consignments.',
    icon: 'Truck',
    view: 'trulogistics',
  },
  {
    id: 'trumarket',
    name: 'TruMarket',
    description: 'Classifieds and marketplaces — listings across channels.',
    icon: 'Store',
    view: 'trumarket',
  },
];

const ICONS: Record<string, React.ElementType> = {
  Home,
  Car,
  Building2,
  Wrench,
  Truck,
  Store,
  Package,
  Cloud,
};

const loadModules = (): InstalledModule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as InstalledModule[];
  } catch {
    // ignore corrupt storage
  }
  return [];
};

export const ModuleDock: React.FC = () => {
  const { setActiveView } = useApp();
  const [modules, setModules] = useState<InstalledModule[]>(loadModules);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customIcon, setCustomIcon] = useState('Package');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
    } catch {
      // storage may be unavailable
    }
  }, [modules]);

  const isInstalled = (id: string) => modules.some((m) => m.id === id && m.installed);

  const toggleInstall = (module: Omit<InstalledModule, 'installed' | 'addedAt'>) => {
    setModules((prev) => {
      const existing = prev.find((m) => m.id === module.id);
      if (existing) {
        return prev.map((m) =>
          m.id === module.id ? { ...m, installed: !m.installed, addedAt: m.installed ? m.addedAt : new Date().toISOString() } : m
        );
      }
      return [...prev, { ...module, installed: true, addedAt: new Date().toISOString() }];
    });
  };

  const addCustomModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const id = `custom-${Date.now()}`;
    setModules((prev) => [
      ...prev,
      {
        id,
        name: customName.trim(),
        description: customDesc.trim() || 'A custom module for your workspace.',
        icon: customIcon,
        installed: true,
        addedAt: new Date().toISOString(),
      },
    ]);
    setCustomName('');
    setCustomDesc('');
    setShowCustom(false);
  };

  const removeModule = (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  const installedList = modules.filter((m) => m.installed);
  const availableList = MODULE_CATALOG.filter((m) => !isInstalled(m.id));

  return (
    <div className="relative p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="tru-wash" />

      <header className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Puzzle className="w-4 h-4 text-[color:var(--blue)]" />
            <span className="text-[length:var(--t-micro)] text-[color:var(--muted)]">TruSaaS</span>
          </div>
          <h1 className="text-[38px] leading-[1.1] font-semibold tracking-[-0.022em] text-[color:var(--white)]">
            Modules
          </h1>
          <p className="text-[length:var(--t-small)] text-[color:var(--muted)] mt-1.5 max-w-md">
            Your workspace is built from modules. Install a product, or add a custom one for anything you run.
          </p>
        </div>

        <button
          onClick={() => setShowCustom(true)}
          className="on-fill px-4 py-2 rounded-[8px] text-[length:var(--t-small)] font-medium flex items-center gap-2 hover:brightness-110 transition-[filter]"
        >
          <Plus className="w-4 h-4" />
          Add custom module
        </button>
      </header>

      {/* Installed modules */}
      <section>
        <div className="flex items-baseline gap-2.5 mb-3 px-1">
          <Check className="w-3.5 h-3.5 self-center text-[color:var(--cyan)]" />
          <h2 className="text-[length:var(--t-lead)] font-medium text-[color:var(--white)] tracking-[-0.01em]">
            Installed
          </h2>
          <span className="text-[length:var(--t-micro)] text-[color:var(--faint)] tru-mono">{installedList.length}</span>
        </div>

        {installedList.length === 0 ? (
          <div className="tru-card px-6 py-10 text-center">
            <Package className="w-8 h-8 text-[color:var(--faint)] mx-auto mb-3" />
            <p className="text-[length:var(--t-small)] text-[color:var(--muted)]">No modules installed yet — pick one below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {installedList.map((m) => {
              const Icon = ICONS[m.icon] || Package;
              const active = m.view && m.view !== 'truproperty' && m.view !== 'trudealer';
              return (
                <div key={m.id} className="tru-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-[10px] bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] text-[color:var(--cyan)] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <button
                      onClick={() => removeModule(m.id)}
                      className="p-1.5 rounded-md text-[color:var(--faint)] hover:text-[color:var(--danger)] hover:bg-[rgba(184,106,106,0.08)] transition-colors"
                      title="Uninstall"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="text-[length:var(--t-body)] font-medium text-[color:var(--white)] mt-3">{m.name}</h3>
                  <p className="text-[length:var(--t-micro)] text-[color:var(--muted)] mt-1 leading-relaxed">{m.description}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[color:var(--glass-line)]">
                    <span className="px-2 py-0.5 rounded-md text-[length:var(--t-micro)] font-medium border bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)]">
                      Installed
                    </span>
                    {active && (
                      <button
                        onClick={() => setActiveView('modules')}
                        className="text-[length:var(--t-micro)] text-[color:var(--muted)] hover:text-[color:var(--cyan)]"
                      >
                        Not shipped yet
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Available modules */}
      <section>
        <div className="flex items-baseline gap-2.5 mb-3 px-1">
          <Download className="w-3.5 h-3.5 self-center text-[color:var(--faint)]" />
          <h2 className="text-[length:var(--t-lead)] font-medium text-[color:var(--white)] tracking-[-0.01em]">
            Available
          </h2>
          <span className="text-[length:var(--t-micro)] text-[color:var(--faint)] tru-mono">{availableList.length}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {availableList.map((m) => {
            const Icon = ICONS[m.icon] || Package;
            return (
              <div key={m.id} className="tru-card p-5 opacity-90">
                <div className="w-10 h-10 rounded-[10px] bg-[color:var(--glass)] border border-[color:var(--glass-line)] text-[color:var(--white-dim)] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-[length:var(--t-body)] font-medium text-[color:var(--white)] mt-3">{m.name}</h3>
                <p className="text-[length:var(--t-micro)] text-[color:var(--muted)] mt-1 leading-relaxed">{m.description}</p>
                <button
                  onClick={() => toggleInstall(m)}
                  className="mt-4 w-full py-2 rounded-[8px] text-[length:var(--t-small)] font-medium border border-[color:var(--glass-line)] text-[color:var(--white-dim)] hover:border-[color:var(--cyan-soft)] hover:text-[color:var(--cyan)] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Install
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom module modal */}
      {showCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <form
            onSubmit={addCustomModule}
            className="bg-slate-900 border border-slate-800 rounded-[18px] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)] w-full max-w-md p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                Add a module
              </h3>
              <button type="button" onClick={() => setShowCustom(false)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[length:var(--t-micro)] text-slate-400 block mb-1.5">Module name</label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[color:var(--ink)] border border-[color:var(--glass-line)] rounded-[8px] px-3 py-2 text-[length:var(--t-small)] text-[color:var(--white)] placeholder-[color:var(--faint)] focus:outline-none focus:border-[color:var(--cyan-soft)]"
                  placeholder="e.g. TruHoliday"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[length:var(--t-micro)] text-slate-400 block mb-1.5">Description</label>
                <textarea
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[color:var(--ink)] border border-[color:var(--glass-line)] rounded-[8px] px-3 py-2 text-[length:var(--t-small)] text-[color:var(--white)] placeholder-[color:var(--faint)] focus:outline-none focus:border-[color:var(--cyan-soft)]"
                  placeholder="What does this module do?"
                />
              </div>
              <div>
                <label className="text-[length:var(--t-micro)] text-slate-400 block mb-1.5">Icon</label>
                <select
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  className="w-full bg-[color:var(--ink)] border border-[color:var(--glass-line)] rounded-[8px] px-3 py-2 text-[length:var(--t-small)] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan-soft)]"
                >
                  {Object.keys(ICONS).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowCustom(false)} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium">
                Install module
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
