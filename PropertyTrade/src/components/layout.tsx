import React, { useCallback, useEffect, useState } from 'react';
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
  CalendarDays,
  Bell,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import { fmtDate, initials } from '../lib/format';
import { AgentBrief } from '../lib/types';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
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

interface NotificationItem {
  id: string;
  title: string;
  sub: string;
  date: string;
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
  const [notif, setNotif] = useState<{ open: boolean; items: NotificationItem[] }>({ open: false, items: [] });

  const loadNotifs = useCallback(async () => {
    try {
      const data = await apiGet<{ items: NotificationItem[] }>('/api/notifications');
      setNotif((n) => ({ ...n, items: data.items }));
    } catch {
      /* keep the last list */
    }
  }, []);

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 60000);
    return () => clearInterval(t);
  }, [loadNotifs]);
  return (
    <div className="min-h-screen flex">
      <aside className="fixed inset-y-0 left-0 w-[236px] bg-card border-r border-line flex flex-col">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line/60">
          <Logo />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-ink">Flow Prop</p>
            <p className="text-[10.5px] font-medium tracking-[0.12em] text-muted uppercase">
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
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotif((n) => ({ ...n, open: !n.open }))}
                title="Notifications"
                aria-label="Notifications"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-muted hover:text-ink hover:bg-slate-soft transition-colors"
              >
                <Bell size={17} />
                {notif.items.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                    {notif.items.length}
                  </span>
                )}
              </button>
              {notif.open && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotif((n) => ({ ...n, open: false }))}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-[320px] bg-card rounded-[var(--r-card)] border border-line shadow-3 overflow-hidden animate-rise">
                    <p className="px-4 pt-3.5 pb-2 text-[13px] font-semibold text-ink">Notifications</p>
                    <div className="max-h-[320px] overflow-y-auto">
                      {notif.items.length === 0 && (
                        <p className="px-4 py-6 text-[12.5px] text-muted text-center">You're all caught up.</p>
                      )}
                      {notif.items.slice(0, 20).map((it) => (
                        <div key={it.id} className="px-4 py-2.5 border-t border-line/60 hover:bg-paper">
                          <p className="text-[13px] font-semibold text-ink leading-snug">{it.title}</p>
                          <p className="text-[12px] text-muted truncate">{it.sub}</p>
                          <p className="text-[11px] text-faint mt-0.5">{fmtDate(it.date)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <p className="text-[12.5px] text-muted">{agent?.agencyName || ''}</p>
          </div>
        </div>
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}