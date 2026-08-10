import { useCallback, useEffect, useState } from 'react';
import { Building2, Wallet, UserRound, Wrench, Tag, FileText, CalendarClock } from 'lucide-react';
import { apiGet } from '../lib/api';
import { DashboardStats, Property } from '../lib/types';
import { fmtZAR, fmtDate, daysLeft } from '../lib/format';
import { Badge, Card, CardHeader, Empty, Spinner, StatCard } from '../components/ui';

const BAD_MONTH = (m?: string) => (m ? m.replace('-', ' ') : '');

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [props, setProps] = useState<Property[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, p] = await Promise.all([
        apiGet<DashboardStats>('/api/dashboard'),
        apiGet<Property[]>('/api/properties'),
      ]);
      setStats(s);
      setProps(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Empty title="Could not load the dashboard" hint={error} action={<button onClick={load}>Retry</button>} />;
  if (!stats) return <Spinner />;

  const propById = new Map(props.map((p) => [p.id, p]));
  const byId = (id?: string) => propById.get(id ?? '')?.address?.split(',')[0] || '—';
  const collectedPct = stats.rentDueThisMonthZAR > 0
    ? Math.round((stats.rentCollectedThisMonthZAR / stats.rentDueThisMonthZAR) * 100)
    : 0;

  return (
    <div className="space-y-5 animate-fade">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Properties" value={stats.totalProperties}
          sub={`${stats.occupiedCount} occupied · ${stats.vacantCount} vacant`}
          icon={<Building2 size={18} />} tone="ink" />
        <StatCard label="Occupancy" value={`${stats.occupancyRate}%`} tone="teal"
          sub={`${stats.activeListings} active listings`} icon={<CalendarClock size={18} />} />
        <StatCard label="Rent this month" value={fmtZAR(stats.rentCollectedThisMonthZAR)} tone="teal"
          sub={`${stats.rentOutstandingZAR > 0 ? fmtZAR(stats.rentOutstandingZAR) + ' outstanding' : 'fully collected'}`}
          icon={<Wallet size={18} />} />
        <StatCard label="Arrears" value={stats.arrearsCount} tone={stats.arrearsCount > 0 ? 'red' : 'teal'}
          sub={`${stats.maintenanceOpen} maintenance open · ${stats.maintenanceUrgent} urgent`}
          icon={<Wrench size={18} />} />
        <StatCard label="Active leads" value={stats.activeLeads} tone="slate"
          sub={`${stats.viewingsThisWeek} viewings this week`} icon={<UserRound size={18} />} />
        <StatCard label="Pending offers" value={stats.pendingOffers} tone="slate"
          sub="submitted or countered" icon={<FileText size={18} />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Collections" sub={`For ${BAD_MONTH(stats.month)} — rents received vs due`} />
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[12px] text-muted uppercase tracking-tight font-medium">Received</p>
                <p className="text-[24px] font-semibold tracking-tight mono text-accent">
                  {fmtZAR(stats.rentCollectedThisMonthZAR)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-muted uppercase tracking-tight font-medium">Due</p>
                <p className="text-[24px] font-semibold tracking-tight mono text-ink">
                  {fmtZAR(stats.rentDueThisMonthZAR)}
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-slate-soft overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.min(collectedPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2.5 text-[12.5px]">
              <span className="text-muted">{collectedPct}% of due</span>
              <span className={stats.rentOutstandingZAR > 0 ? 'text-danger font-medium' : 'text-accent font-medium'}>
                {stats.rentOutstandingZAR > 0 ? `${fmtZAR(stats.rentOutstandingZAR)} outstanding` : 'All collected'}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Alerts"
            sub={`${stats.expiringLeases.length} leases expiring within 60 days · ${stats.depositAlerts.length} deposits overdue`}
          />
          <div className="px-5 pb-5 space-y-2.5">
            {stats.expiringLeases.length === 0 && stats.depositAlerts.length === 0 && (
              <p className="text-[13px] text-muted py-4 text-center">All quiet — nothing to chase.</p>
            )}
            {stats.expiringLeases.map((l) => {
              const d = daysLeft(l.endDate);
              const soon = d !== null && d <= 30;
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 bg-paper rounded-[12px] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink truncate">{byId(l.propertyId)}</p>
                    <p className="text-[12px] text-muted">Lease ends {fmtDate(l.endDate)} · {fmtZAR(l.monthlyRentZAR)}/mo</p>
                  </div>
                  <Badge tone={soon ? 'red' : 'amber'}>{d !== null ? `${d}d left` : '—'}</Badge>
                </div>
              );
            })}
            {stats.depositAlerts.map((a) => (
              <div key={a.leaseId} className="flex items-center justify-between gap-3 bg-paper rounded-[12px] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink truncate">{byId(a.propertyId)}</p>
                  <p className="text-[12px] text-muted">Deposit receipt receipt overdue</p>
                </div>
                <Badge tone="red">FICA</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}