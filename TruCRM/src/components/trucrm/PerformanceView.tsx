import React, { useMemo } from 'react';
import { TrendingUp, Users, Radio, AlertTriangle } from 'lucide-react';
import { useTruCrm, totalGross, speedToLeadMins } from '../../context/TruCrmContext';
import { Lead } from '../../types/trucrm';
import { money } from './shared';

interface Row {
  key: string;
  leads: number;
  delivered: number;
  lost: number;
  /** Closing rate over *closed* leads only — open leads haven't had their chance yet. */
  closingPct: number | null;
  gross: number;
  grossPerDelivered: number | null;
  medianResponse: number | null;
}

const median = (nums: number[]): number | null => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

const buildRows = (
  leads: Lead[],
  activities: Parameters<typeof speedToLeadMins>[1],
  keyOf: (l: Lead) => string
): Row[] => {
  const groups = new Map<string, Lead[]>();
  leads.forEach((l) => {
    const k = keyOf(l);
    groups.set(k, [...(groups.get(k) || []), l]);
  });

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const delivered = group.filter((l) => l.stage === 'delivered');
      const lost = group.filter((l) => l.stage === 'lost');
      const closed = delivered.length + lost.length;
      const gross = delivered.reduce((s, l) => s + totalGross(l.dealSheet, l.tradeIn.appraisedValue), 0);
      const responses = group
        .map((l) => speedToLeadMins(l, activities))
        .filter((v): v is number => v !== null);

      return {
        key,
        leads: group.length,
        delivered: delivered.length,
        lost: lost.length,
        closingPct: closed ? Math.round((delivered.length / closed) * 100) : null,
        gross,
        grossPerDelivered: delivered.length ? Math.round(gross / delivered.length) : null,
        medianResponse: median(responses),
      };
    })
    .sort((a, b) => b.gross - a.gross || b.leads - a.leads);
};

const Table: React.FC<{
  title: string;
  icon: React.ElementType;
  firstCol: string;
  rows: Row[];
  currency: string;
  targetMins: number;
}> = ({ title, icon: Icon, firstCol, rows, currency, targetMins }) => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-[18px] overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
      <Icon className="w-4 h-4 text-cyan-400" />
      <h3 className="text-sm font-medium text-white">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-950/80 text-[length:var(--t-micro)] font-medium text-slate-500 tracking-wider">
          <tr>
            <th className="px-5 py-2.5">{firstCol}</th>
            <th className="px-5 py-2.5 text-right">Leads</th>
            <th className="px-5 py-2.5 text-right">Sold</th>
            <th className="px-5 py-2.5 text-right">Closing</th>
            <th className="px-5 py-2.5 text-right">Response</th>
            <th className="px-5 py-2.5 text-right">Gross</th>
            <th className="px-5 py-2.5 text-right">Per Unit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-500">
                No data yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-slate-800/40">
              <td className="px-5 py-3 font-medium text-white text-xs">{r.key}</td>
              <td className="px-5 py-3 text-right text-slate-300 text-xs">{r.leads}</td>
              <td className="px-5 py-3 text-right text-slate-300 text-xs">{r.delivered}</td>
              <td className="px-5 py-3 text-right">
                {r.closingPct === null ? (
                  <span className="text-slate-600 text-xs">—</span>
                ) : (
                  <span
                    className={`text-xs font-medium ${
                      r.closingPct >= 50
                        ? 'text-emerald-400'
                        : r.closingPct >= 25
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {r.closingPct}%
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                {r.medianResponse === null ? (
                  <span className="text-rose-400 text-xs font-medium">none</span>
                ) : (
                  <span
                    className={`text-xs font-medium ${
                      r.medianResponse <= targetMins ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {r.medianResponse < 60
                      ? `${r.medianResponse}m`
                      : `${Math.round(r.medianResponse / 60)}h`}
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-right text-xs font-medium text-white">
                {money(r.gross, currency)}
              </td>
              <td className="px-5 py-3 text-right text-xs text-slate-400">
                {r.grossPerDelivered === null ? '—' : money(r.grossPerDelivered, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const PerformanceView: React.FC = () => {
  const { leads, activities, settings, salespersonName } = useTruCrm();
  const cur = settings.currency;

  const sourceRows = useMemo(
    () => buildRows(leads, activities, (l) => l.source),
    [leads, activities]
  );
  const repRows = useMemo(
    () => buildRows(leads, activities, (l) => salespersonName(l.salespersonId)),
    [leads, activities, salespersonName]
  );
  const lostRows = useMemo(() => {
    const counts = new Map<string, number>();
    leads
      .filter((l) => l.stage === 'lost')
      .forEach((l) => {
        const reason = l.lostReason || 'Not specified';
        counts.set(reason, (counts.get(reason) || 0) + 1);
      });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // The sources you are paying for but not answering fast enough.
  const weakSources = sourceRows.filter(
    (r) => r.medianResponse !== null && r.medianResponse > settings.speedToLeadTargetMins && r.leads > 0
  );

  return (
    <div className="space-y-6">
      {weakSources.length > 0 && (
        <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-[18px] flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-200">
              Slow response on {weakSources.length} source{weakSources.length > 1 ? 's' : ''}
            </p>
            <p className="text-[length:var(--t-micro)] text-amber-300/80 mt-0.5">
              {weakSources.map((s) => s.key).join(', ')} — median reply is past the{' '}
              {settings.speedToLeadTargetMins}-minute target. You are paying for these leads and answering them late.
            </p>
          </div>
        </div>
      )}

      <Table
        title="Lead source performance — where the money comes from"
        icon={Radio}
        firstCol="Source"
        rows={sourceRows}
        currency={cur}
        targetMins={settings.speedToLeadTargetMins}
      />

      <Table
        title="Salesperson performance"
        icon={Users}
        firstCol="Salesperson"
        rows={repRows}
        currency={cur}
        targetMins={settings.speedToLeadTargetMins}
      />

      <div className="bg-slate-900/80 border border-slate-800 rounded-[18px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-medium text-white">Why deals are being lost</h3>
        </div>
        <div className="p-5 space-y-2">
          {lostRows.length === 0 ? (
            <p className="text-xs text-slate-500">No lost deals recorded.</p>
          ) : (
            lostRows.map(([reason, count]) => {
              const max = lostRows[0][1];
              return (
                <div key={reason} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{reason}</span>
                    <span className="text-slate-400 font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500/70"
                      style={{ width: `${Math.round((count / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
