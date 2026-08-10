import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { CommissionReport, RentRollReport, ArrearsReport, SalesPipeline } from '../lib/types';
import { fmtDate, fmtZAR, titleCase } from '../lib/format';
import { Badge, Button, Card, CardHeader, Empty, Input, Spinner } from '../components/ui';

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function Reports() {
  const [month, setMonth] = useState(currentMonth());
  const [rentRoll, setRentRoll] = useState<RentRollReport | null>(null);
  const [arrears, setArrears] = useState<ArrearsReport | null>(null);
  const [pipeline, setPipeline] = useState<SalesPipeline | null>(null);
  const [commission, setCommission] = useState<CommissionReport | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [r, a, p, c] = await Promise.all([
        apiGet<RentRollReport>(`/api/reports/rent-roll?month=${month}`),
        apiGet<ArrearsReport>(`/api/reports/arrears?month=${month}`),
        apiGet<SalesPipeline>('/api/reports/sales-pipeline'),
        apiGet<CommissionReport>(`/api/reports/commission?month=${month}`),
      ]);
      setRentRoll(r);
      setArrears(a);
      setPipeline(p);
      setCommission(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.');
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Empty title="Could not load reports" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!rentRoll || !pipeline || !commission) return <Spinner />;

  const rows = (r: RentRollRowLike[] | undefined) => r ?? [];

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-center gap-2.5">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
        <p className="text-[13px] text-muted">Refreshes when the month changes.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card>
          <CardHeader title={`Rent roll · ${month}`} sub={`${rows(rentRoll.rows).length} active leases`} />
          <div className="grid grid-cols-3 gap-3 px-5 pb-3">
            <div className="bg-paper rounded-[12px] px-3 py-2.5">
              <p className="text-[11px] text-muted uppercase tracking-tight font-medium">Due</p>
              <p className="text-[16px] font-semibold mono text-ink">{fmtZAR(rentRoll.totalDueZAR)}</p>
            </div>
            <div className="bg-paper rounded-[12px] px-3 py-2.5">
              <p className="text-[11px] text-muted uppercase tracking-tight font-medium">Paid</p>
              <p className="text-[16px] font-semibold mono text-accent">{fmtZAR(rentRoll.totalPaidZAR)}</p>
            </div>
            <div className="bg-paper rounded-[12px] px-3 py-2.5">
              <p className="text-[11px] text-muted uppercase tracking-tight font-medium">Outstanding</p>
              <p className={`text-[16px] font-semibold mono ${rentRoll.totalOutstandingZAR > 0 ? 'text-danger' : 'text-ink'}`}>
                {fmtZAR(rentRoll.totalOutstandingZAR)}
              </p>
            </div>
          </div>
          <div className="px-3 pb-4 space-y-1 max-h-[320px] overflow-y-auto">
            {rows(rentRoll.rows).map((r) => (
              <div key={r.propertyId} className="flex items-center gap-3 px-2.5 py-2 rounded-[10px] hover:bg-paper">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink truncate leading-snug">{r.address}</p>
                  <p className="text-[11.5px] text-muted truncate">{r.tenantName || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold mono text-ink">{fmtZAR(r.monthlyRentZAR)}</p>
                  <p className={`text-[11.5px] mono ${r.balanceZAR > 0 ? 'text-danger' : 'text-accent'}`}>
                    {r.balanceZAR > 0 ? `${fmtZAR(r.balanceZAR)} due` : 'settled'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={`Arrears · ${month}`} sub={`${arrears.count} leases behind`} />
          {rows(arrears.rows).length === 0 ? (
            <p className="px-5 pb-6 text-[13px] text-muted">Nobody behind this month — clean roll.</p>
          ) : (
            <div className="px-3 pb-4 space-y-1 max-h-[320px] overflow-y-auto">
              {rows(arrears.rows).map((r, idx) => (
                <div key={`${r.propertyId}-${idx}`} className="flex items-center gap-3 px-2.5 py-2 rounded-[10px] hover:bg-paper">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink truncate leading-snug">{r.address}</p>
                    <p className="text-[11.5px] text-muted truncate">{r.tenantName}{r.phone ? ` · ${r.phone}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold mono text-danger">{fmtZAR(r.outstandingZAR)}</p>
                    <p className="text-[11.5px] text-faint mono">of {fmtZAR(r.monthlyRentZAR)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Sales pipeline" sub="All sales listings, all time" />
          <div className="px-5 pb-3 grid grid-cols-4 gap-2.5">
            {([
              ['Available', pipeline.summary.available, 'teal'],
              ['Under offer', pipeline.summary.underOffer, 'amber'],
              ['Sold', pipeline.summary.sold, 'ink'],
              ['Withdrawn', pipeline.summary.withdrawn, 'neutral'],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="bg-paper rounded-[12px] px-3 py-2.5">
                <p className="text-[11px] text-muted uppercase tracking-tight font-medium">{label}</p>
                <p className="text-[16px] font-semibold mono text-ink">{value}</p>
              </div>
            ))}
          </div>
          <p className="px-5 pb-2 text-[12px] text-muted">
            Portfolio value: <span className="mono font-semibold text-ink">{fmtZAR(pipeline.summary.totalListingValueZAR)}</span>
          </p>
          <div className="px-3 pb-4 space-y-1 max-h-[260px] overflow-y-auto">
            {(['available', 'under-offer', 'sold'] as const).flatMap((st) => pipeline.pipeline[st] ?? []).map((r) => (
              <div key={r.propertyId} className="flex items-center gap-3 px-2.5 py-2 rounded-[10px] hover:bg-paper">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink truncate leading-snug">{r.address}</p>
                  <p className="text-[11.5px] text-muted">{r.suburb} · {r.daysOnMarket} days on market</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.pendingOffers > 0 && <Badge tone="amber">{r.pendingOffers} offers</Badge>}
                  {r.activeMandates > 0 && <Badge tone="teal">{r.activeMandates} mandates</Badge>}
                  <p className="text-[13px] font-semibold mono text-ink">{fmtZAR(r.askingPriceZAR)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={`Commission · ${month}`} sub={`${fmtZAR(commission.grandTotalZAR)} across rental and sales`} />
          <div className="px-5 pb-3 grid grid-cols-2 gap-3">
            <div className="bg-paper rounded-[12px] px-3 py-2.5">
              <p className="text-[11px] text-muted uppercase tracking-tight font-medium">Rental management</p>
              <p className="text-[16px] font-semibold mono text-accent">{fmtZAR(commission.rental.totalCommissionZAR)}</p>
            </div>
            <div className="bg-paper rounded-[12px] px-3 py-2.5">
              <p className="text-[11px] text-muted uppercase tracking-tight font-medium">Sales</p>
              <p className="text-[16px] font-semibold mono text-ink">{fmtZAR(commission.sales.totalCommissionZAR)}</p>
            </div>
          </div>
          <div className="px-3 pb-4 space-y-1 max-h-[260px] overflow-y-auto">
            {[...commission.rental.rows, ...commission.sales.rows].map((r, idx) => (
              <div key={`${r.propertyId}-${idx}`} className="flex items-center gap-3 px-2.5 py-2 rounded-[10px] hover:bg-paper">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink truncate leading-snug">{r.address}</p>
                  <p className="text-[11.5px] text-muted truncate">{r.ownerName || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold mono text-ink">{fmtZAR(r.commissionZAR)}</p>
                  <p className="text-[11.5px] text-faint mono">
                    {r.rentCollectedZAR != null ? `${r.commissionPercent}% of ${fmtZAR(r.rentCollectedZAR)}` : r.commissionPaid ? 'paid' : titleCase('pending')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

interface RentRollRowLike {
  propertyId: string;
  address: string;
  tenantName: string;
  monthlyRentZAR: number;
  paidZAR?: number;
  balanceZAR: number;
  phone?: string;
  leaseEnd?: string;
}