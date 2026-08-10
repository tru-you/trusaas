import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';
import {
  Buyer, Interest, Mandate, Offer, Property, Sale, Viewing,
} from '../lib/types';
import { daysAgo, daysLeft, fmtDate, fmtZAR, titleCase } from '../lib/format';
import { Badge, BadgeTone, Button, Empty, Spinner } from '../components/ui';

type DealItem = {
  kind: 'lead' | 'viewing' | 'offer' | 'won';
  id: string;
  propertyId: string;
  buyerId: string;
  status: string;
  amount?: number;
  createdAt?: string;
  scheduledDate?: string;
};

export default function Deals() {
  const [data, setData] = useState<{
    props: Property[]; buyers: Buyer[]; interests: Interest[];
    viewings: Viewing[]; offers: Offer[]; sales: Sale[]; mandates: Mandate[];
  } | null>(null);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'all' | 'sale' | 'rental'>('all');

  const load = useCallback(async () => {
    setError('');
    try {
      const [props, buyers, interests, viewings, offers, sales, mandates] = await Promise.all([
        apiGet<Property[]>('/api/properties'),
        apiGet<Buyer[]>('/api/buyers'),
        apiGet<Interest[]>('/api/interests'),
        apiGet<Viewing[]>('/api/viewings'),
        apiGet<Offer[]>('/api/offers'),
        apiGet<Sale[]>('/api/sales'),
        apiGet<Mandate[]>('/api/mandates'),
      ]);
      setData({ props, buyers, interests, viewings, offers, sales, mandates });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the pipeline.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    if (!data) return [];
    const list: DealItem[] = [];
    const scopeOk = (p?: Property) =>
      scope === 'all' || !p || p.purpose === scope || p.purpose === 'both';
    const prop = (id: string) => data.props.find((p) => p.id === id);

    for (const i of data.interests) {
      if (i.status === 'won' || i.status === 'lost') continue;
      if (!scopeOk(prop(i.propertyId))) continue;
      list.push({ kind: 'lead', id: i.id, propertyId: i.propertyId, buyerId: i.buyerId, status: i.status, createdAt: i.createdAt });
    }
    for (const v of data.viewings) {
      if (v.status !== 'scheduled') continue;
      if (!scopeOk(prop(v.propertyId))) continue;
      list.push({ kind: 'viewing', id: v.id, propertyId: v.propertyId, buyerId: v.buyerId, status: v.status, scheduledDate: v.scheduledDate, createdAt: v.createdAt });
    }
    for (const o of data.offers) {
      if (o.status !== 'submitted' && o.status !== 'countered') continue;
      if (!scopeOk(prop(o.propertyId))) continue;
      list.push({ kind: 'offer', id: o.id, propertyId: o.propertyId, buyerId: o.buyerId, status: o.status, amount: o.offerAmountZAR, createdAt: o.createdAt });
    }
    for (const s of data.sales) {
      if (!scopeOk(prop(s.propertyId))) continue;
      list.push({ kind: 'won', id: s.id, propertyId: s.propertyId, buyerId: s.buyerId, status: s.status, amount: s.saleAmountZAR, createdAt: s.createdAt });
    }
    for (const i of data.interests) {
      if (i.status !== 'won') continue;
      if (!scopeOk(prop(i.propertyId))) continue;
      list.push({ kind: 'won', id: i.id, propertyId: i.propertyId, buyerId: i.buyerId, status: 'won', createdAt: i.createdAt });
    }
    return list;
  }, [data, scope]);

  if (error) {
    return (
      <Empty
        title="Could not load the pipeline"
        hint={error}
        action={<Button onClick={load}>Retry</Button>}
      />
    );
  }
  if (!data) return <Spinner />;

  const propById = new Map(data.props.map((p) => [p.id, p]));
  const buyerById = new Map(data.buyers.map((b) => [b.id, b]));
  const shortAddr = (id: string) => propById.get(id)?.address?.split(',')[0] || '—';
  const buyerName = (id: string) => {
    const b = buyerById.get(id);
    return b ? `${b.firstName} ${b.lastName}` : '—';
  };

  const columns: { key: string; label: string; of: (i: DealItem) => boolean; tone: BadgeTone }[] = [
    { key: 'lead', label: 'Prospecting', of: (i) => i.kind === 'lead', tone: 'slate' },
    { key: 'viewing', label: 'Viewings', of: (i) => i.kind === 'viewing', tone: 'amber' },
    { key: 'offer', label: 'Offers', of: (i) => i.kind === 'offer', tone: 'teal' },
    { key: 'won', label: 'Won', of: (i) => i.kind === 'won', tone: 'ink' },
  ];

  const filters = [
    { key: 'all' as const, label: 'All' },
    { key: 'sale' as const, label: 'Sales' },
    { key: 'rental' as const, label: 'Lettings' },
  ];

  return (
    <div className="animate-fade">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setScope(f.key)}
              className={`px-3.5 h-8 rounded-[var(--r-pill)] text-[13px] font-medium tracking-tight transition-colors ${
                scope === f.key ? 'bg-ink text-paper' : 'bg-card text-muted border border-line hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted">{items.length} deals moving</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start overflow-x-auto">
        {columns.map((col) => {
          const colItems = items.filter(col.of);
          return (
            <div key={col.key} className="bg-card/60 rounded-[var(--r-card)] p-2.5 min-w-[240px]">
              <div className="flex items-center justify-between px-2 pb-2.5 pt-1">
                <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  {col.label}
                </p>
                <span className="text-[12px] font-semibold text-ink-dim mono">{colItems.length}</span>
              </div>
              <div className="space-y-2">
                {colItems.length === 0 && (
                  <p className="text-[12px] text-faint text-center py-6">Nothing here</p>
                )}
                {colItems.map((i) => {
                  const d = i.scheduledDate ? daysLeft(i.scheduledDate) : null;
                  return (
                    <div key={i.id} className="bg-card rounded-[14px] border border-line/70 shadow-1 p-3 hover:border-accent/40 hover:shadow-2 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={i.kind === 'lead' ? 'slate' : i.kind === 'viewing' ? 'amber' : i.kind === 'offer' ? 'teal' : 'ink'}>
                          {titleCase(i.status)}
                        </Badge>
                        {i.kind === 'viewing' && d !== null && (
                          <span className={`text-[11px] font-semibold mono ${d <= 1 ? 'text-danger' : 'text-muted'}`}>
                            {d < 0 ? `${-d}d overdue` : d === 0 ? 'today' : `in ${d}d`}
                          </span>
                        )}
                        {i.kind !== 'viewing' && i.createdAt && (
                          <span className="text-[11px] text-faint">{daysAgo(i.createdAt)}</span>
                        )}
                      </div>
                      <p className="mt-2 text-[14px] font-semibold text-ink tracking-tight truncate">
                        {shortAddr(i.propertyId)}
                      </p>
                      <p className="text-[12.5px] text-muted truncate">{buyerName(i.buyerId)}</p>
                      {i.kind === 'viewing' && i.scheduledDate && (
                        <p className="mt-1 text-[12px] text-ink-dim mono">{fmtDate(i.scheduledDate)}</p>
                      )}
                      {i.amount != null && (
                        <p className="mt-2 text-[14px] font-semibold mono text-accent">{fmtZAR(i.amount)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}