import React from 'react';
import {
  LayoutDashboard,
  SquareKanban,
  Building2,
  UserRound,
  KeyRound,
  Wallet,
  Wrench,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  Home,
  Crown,
} from 'lucide-react';
import { initials } from '../lib/format';
import { AgentBrief } from '../lib/types';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'deals', label: 'Deal pipeline', icon: SquareKanban },
  { key: 'properties', label: 'Listings', icon: Building2 },
  { key: 'tenants', label: 'Tenants', icon: UserRound },
  { key: 'leases', label: 'Leases', icon: KeyRound },
  { key: 'payments', label: 'Payments', icon: Wallet },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'team', label: 'Team', icon: UserCog },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'master', label: 'Master', icon: Crown },
];

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <div
      className="shrink-0 rounded-[13px] bg-accent flex items-center justify-center text-white shadow-1"
      style={{ width: size, height: size }}
    >
      <Home size={size * 0.52} strokeWidth={2.4} />
    </div>
  );
}

export function Shell({
  active,
  onNav,
  agent,
  onSignOut,
  children,
}: {
  active: string;
  onNav: (key: string) => void;
  agent: AgentBrief | null;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const isMaster = agent?.role === 'admin' && !agent?.agencyId;
  return (
    <div className="min-h-screen flex">
      <aside className="fixed inset-y-0 left-0 w-[236px] bg-card border-r border-line flex flex-col">
        <div className="flex items-center justify-center px-5 h-16 border-b border-line/60">
          <div className="text-center leading-tight">
            <p className="text-[16px] font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, var(--cyan-bright), var(--cyan))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
              Flow Prop
            </p>
            <p className="text-[9.5px] font-semibold tracking-[0.16em] text-muted/60 uppercase mt-0.5">
              Property agency
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map((item) => {
            if (item.key === 'master' && !isMaster) return null;
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 h-10 rounded-[10px] text-[13.5px] font-medium tracking-tight transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-dim hover:bg-slate-soft hover:text-ink'
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.3 : 1.9} className="shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-line/60">
          <div className="flex items-center gap-3 px-2 py-2 rounded-[10px]">
            <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center text-[12px] font-semibold shrink-0">
              {agent ? initials(agent.label.split(' ')[0], agent.label.split(' ')[1]) : '—'}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[13px] font-semibold text-ink truncate">{agent?.label || '…'}</p>
              <p className="text-[11.5px] text-muted truncate capitalize">{agent?.role || ''}</p>
            </div>
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-[236px] min-w-0">
        <div className="sticky top-0 z-40 h-16 border-b border-line bg-paper/85 backdrop-blur-md flex items-center justify-between px-8">
          <h1 className="text-[17px] font-semibold tracking-tight text-ink">
            {NAV.find((n) => n.key === active)?.label || ''}
          </h1>
          <p className="text-[12.5px] text-muted">{agent?.agencyName || ''}</p>
        </div>
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}