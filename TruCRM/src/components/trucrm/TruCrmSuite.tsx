import React, { useState, useMemo } from 'react';
import {
  Car,
  Plus,
  Search,
  Zap,
  Timer,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  Flame,
  LayoutGrid,
  ListChecks,
  Table as TableIcon,
  X,
  Phone,
  MessageCircle,
  RotateCcw,
} from 'lucide-react';
import { useTruCrm, totalGross, daysSinceContact, speedToLeadMins, localDay } from '../../context/TruCrmContext';
import { Lead, LEAD_STAGES, LeadStageId, OPEN_STAGES } from '../../types/trucrm';
import { LeadDrawer } from './LeadDrawer';
import { NewLeadModal } from './NewLeadModal';
import { PerformanceView } from './PerformanceView';
import { money, ago, StageChip, TempChip, FinanceChip } from './shared';

type View = 'queue' | 'board' | 'list' | 'performance';

const BOARD_STAGES = LEAD_STAGES.filter((s) => OPEN_STAGES.includes(s.id));

const Kpi: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: 'good' | 'bad' | 'warn' | 'neutral';
}> = ({ label, value, sub, icon: Icon, tone = 'neutral' }) => {
  // Good reads cyan, bad reads the one dusty red, and a warning simply stops
  // being emphasised. No yellow, no green, no third and fourth hue.
  const toneClass =
    tone === 'good'
      ? 'text-[color:var(--cyan)]'
      : tone === 'bad'
      ? 'text-[color:var(--danger)]'
      : tone === 'warn'
      ? 'text-[color:var(--muted)]'
      : 'text-[color:var(--white)]';
  return (
    <div className="tru-card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[length:var(--t-micro)] text-[color:var(--muted)]">{label}</span>
        <Icon className="w-3.5 h-3.5 text-[color:var(--faint)]" />
      </div>
      <p className={`text-[28px] leading-none font-semibold tracking-[-0.015em] tru-mono ${toneClass}`}>
        {value}
      </p>
      {sub && <p className="text-[length:var(--t-micro)] text-[color:var(--faint)] mt-2">{sub}</p>}
    </div>
  );
};

/** Compact row used by every queue list. */
const LeadRow: React.FC<{ lead: Lead; onOpen: () => void; currency: string; accent?: string }> = ({
  lead,
  onOpen,
  currency,
  accent = 'border-[rgba(10,20,32,0.08)]',
}) => {
  const since = daysSinceContact(lead);
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left px-4 py-3.5 border-b border-[color:var(--glass-line)] hover:bg-[color:var(--glass)] transition-colors group ${accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <span className="text-[length:var(--t-body)] text-[color:var(--white)] truncate">
              {lead.customerName}
            </span>
            <TempChip temp={lead.temperature} />
            <StageChip stage={lead.stage} />
          </div>
          <p className="text-[length:var(--t-micro)] text-[color:var(--muted)] truncate">
            {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
            {lead.vehicle.stockNumber ? ` · ${lead.vehicle.stockNumber}` : ''}
          </p>
          {lead.nextFollowUpNote && (
            <p className="text-[length:var(--t-micro)] text-[color:var(--white-dim)] mt-1.5 truncate">
              {lead.nextFollowUpNote}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[length:var(--t-small)] text-[color:var(--white)] tru-mono">
            {money(lead.vehicle.askingPrice, currency)}
          </p>
          <p className="text-[length:var(--t-micro)] text-[color:var(--faint)] mt-1">
            {since === null ? 'never contacted' : `${since}d since contact`}
          </p>
        </div>
      </div>
    </button>
  );
};

const QueueSection: React.FC<{
  title: string;
  description: string;
  leads: Lead[];
  tone: string;
  icon: React.ElementType;
  currency: string;
  onOpen: (l: Lead) => void;
}> = ({ title, description, leads, tone, icon: Icon, currency, onOpen }) => (
  <section>
    <div className="flex items-baseline gap-2.5 mb-2 px-1">
      <Icon className={`w-3.5 h-3.5 self-center ${tone}`} />
      <h3 className="text-[length:var(--t-lead)] font-medium text-[color:var(--white)] tracking-[-0.01em]">
        {title}
      </h3>
      <span className="text-[length:var(--t-micro)] text-[color:var(--faint)] tru-mono">{leads.length}</span>
      <span className="text-[length:var(--t-micro)] text-[color:var(--faint)] hidden sm:inline">
        {description}
      </span>
    </div>
    {leads.length === 0 ? (
      <div className="tru-card px-4 py-5 text-[length:var(--t-small)] text-[color:var(--faint)]">
        Nothing here.
      </div>
    ) : (
      <div className="tru-card overflow-hidden [&>button:last-child]:border-b-0">
        {leads.map((l) => (
          <LeadRow key={l.id} lead={l} currency={currency} onOpen={() => onOpen(l)} />
        ))}
      </div>
    )}
  </section>
);

export const TruCrmSuite: React.FC = () => {
  const {
    leads,
    settings,
    salespeople,
    salespersonName,
    activities,
    dueToday,
    overdue,
    unworked,
    stale,
    metrics,
    moveLeadStage,
    resetTruCrm,
    appointments,
  } = useTruCrm();

  const [view, setView] = useState<View>('queue');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showNew, setShowNew] = useState(false);
  const cur = settings.currency;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      if (ownerFilter !== 'all' && l.salespersonId !== ownerFilter) return false;
      if (!q) return true;
      return (
        l.customerName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.reference.toLowerCase().includes(q) ||
        `${l.vehicle.make} ${l.vehicle.model}`.toLowerCase().includes(q) ||
        (l.vehicle.stockNumber || '').toLowerCase().includes(q)
      );
    });
  }, [leads, search, ownerFilter]);

  const byOwner = (list: Lead[]) =>
    ownerFilter === 'all' ? list : list.filter((l) => l.salespersonId === ownerFilter);

  const todaysAppointments = appointments
    .filter((a) => localDay(a.at) === localDay() && a.status !== 'Cancelled')
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));

  const openSelected = (l: Lead) => setSelected(l);

  return (
    <div className="relative p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="tru-wash" />

      {/* Header. The title carries the weight; the icon does not need to shout
          alongside it, so it sits quiet in logo blue. */}
      <header className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4 text-[color:var(--blue)]" />
            <span className="text-[length:var(--t-micro)] text-[color:var(--muted)]">
              {settings.dealershipName}
            </span>
          </div>
          <h1 className="text-[38px] leading-[1.1] font-semibold tracking-[-0.022em] text-[color:var(--white)]">
            Sales floor
          </h1>
          <p className="text-[length:var(--t-small)] text-[color:var(--muted)] mt-1.5 max-w-md">
            Your own leads, customers and deals. Competitor listings live in Market Intel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-transparent border border-[color:var(--glass-line)] rounded-[8px] px-3 py-2 text-[length:var(--t-small)] text-[color:var(--white-dim)] focus:outline-none focus:border-[color:var(--cyan-soft)]"
          >
            <option value="all">All salespeople</option>
            {salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNew(true)}
            className="on-fill px-4 py-2 rounded-[8px] text-[length:var(--t-small)] font-medium flex items-center gap-2 hover:brightness-110 transition-[filter]"
          >
            <Plus className="w-4 h-4" />
            New up
          </button>
          <button
            onClick={resetTruCrm}
            title="Restore demo data"
            className="p-2.5 border border-[color:var(--glass-line)] text-[color:var(--muted)] hover:text-[color:var(--white)] rounded-[8px] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi
          label="Speed to Lead"
          value={metrics.medianSpeedToLeadMins === null ? '—' : `${metrics.medianSpeedToLeadMins}m`}
          sub={
            metrics.withinSpeedTargetPct === null
              ? 'no responses yet'
              : `${metrics.withinSpeedTargetPct}% within ${settings.speedToLeadTargetMins}m`
          }
          icon={Timer}
          tone={
            metrics.medianSpeedToLeadMins === null
              ? 'neutral'
              : metrics.medianSpeedToLeadMins <= settings.speedToLeadTargetMins
              ? 'good'
              : 'bad'
          }
        />
        <Kpi label="Open Leads" value={String(metrics.openLeads)} sub="being worked" icon={Zap} />
        <Kpi
          label="Unworked"
          value={String(byOwner(unworked).length)}
          sub="never contacted"
          icon={AlertTriangle}
          tone={byOwner(unworked).length > 0 ? 'bad' : 'good'}
        />
        <Kpi label="Appts Today" value={String(metrics.appointmentsToday)} sub="booked" icon={CalendarClock} />
        <Kpi
          label="Delivered MTD"
          value={String(metrics.deliveredThisMonth)}
          sub={metrics.closingRatePct === null ? '' : `${metrics.closingRatePct}% closing rate`}
          icon={TrendingUp}
          tone="good"
        />
        <Kpi
          label="Gross MTD"
          value={money(metrics.grossThisMonth, cur)}
          sub="front + back"
          icon={Flame}
          tone={metrics.grossThisMonth >= 0 ? 'good' : 'bad'}
        />
      </div>

      {/* View switcher + search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="bg-[#FAFAF8] p-1 rounded-xl flex items-center gap-1 border border-[rgba(10,20,32,0.08)]">
          {([
            { id: 'queue', label: 'Work Queue', icon: ListChecks },
            { id: 'board', label: 'Pipeline', icon: LayoutGrid },
            { id: 'list', label: 'All Leads', icon: TableIcon },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view === id ? 'bg-white text-black' : 'text-[#6B7685] hover:text-[#1A2332]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#0E9D98]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, stock no., or vehicle…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] text-sm focus:outline-none focus:border-[#0E9D98]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgba(10,20,32,0.50)] hover:text-[#1A2332]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ---------------- WORK QUEUE ---------------- */}
      {view === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <QueueSection
              title="Unworked leads"
              description="never been contacted — do these first"
              leads={byOwner(unworked)}
              tone="text-[color:var(--danger)]"
              icon={AlertTriangle}
              currency={cur}
              onOpen={openSelected}
            />
            <QueueSection
              title="Overdue follow-ups"
              description="the promised date has passed"
              leads={byOwner(overdue)}
              tone="text-[color:var(--muted)]"
              icon={Timer}
              currency={cur}
              onOpen={openSelected}
            />
            <QueueSection
              title="Due today"
              description="scheduled for today"
              leads={byOwner(dueToday)}
              tone="text-[color:var(--cyan)]"
              icon={ListChecks}
              currency={cur}
              onOpen={openSelected}
            />
            <QueueSection
              title={`Going cold (${settings.staleAfterDays}+ days quiet)`}
              description="open but drifting"
              leads={byOwner(stale)}
              tone="text-[color:var(--faint)]"
              icon={Flame}
              currency={cur}
              onOpen={openSelected}
            />
          </div>

          {/* Today's diary */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#1A2332] flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-indigo-600" />
              Today's diary
            </h3>
            {todaysAppointments.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-[rgba(10,20,32,0.08)] rounded-xl text-center text-[length:var(--t-micro)] text-[rgba(10,20,32,0.40)]">
                No appointments booked today.
              </div>
            ) : (
              todaysAppointments.map((a) => {
                const lead = leads.find((l) => l.id === a.leadId);
                return (
                  <button
                    key={a.id}
                    onClick={() => lead && setSelected(lead)}
                    className="w-full text-left p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl hover:border-indigo-600 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#1A2332]">{a.type}</span>
                      <span className="text-[length:var(--t-micro)] font-mono text-indigo-600">
                        {new Date(a.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[length:var(--t-micro)] text-[#6B7685] mt-0.5">{lead?.customerName || 'Unknown'}</p>
                    {a.notes && <p className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)] mt-1">{a.notes}</p>}
                  </button>
                );
              })
            )}

            {/* Bank watchlist — deals waiting on a decision are the most perishable */}
            <h3 className="text-sm font-medium text-[#1A2332] flex items-center gap-2 pt-3">
              <Zap className="w-4 h-4 text-orange-400" />
              Waiting on the bank
            </h3>
            {byOwner(leads.filter((l) => l.finance.status === 'Submitted' || l.finance.status === 'Conditional'))
              .length === 0 ? (
              <div className="p-4 border-2 border-dashed border-[rgba(10,20,32,0.08)] rounded-xl text-center text-[length:var(--t-micro)] text-[rgba(10,20,32,0.40)]">
                No applications pending.
              </div>
            ) : (
              byOwner(
                leads.filter((l) => l.finance.status === 'Submitted' || l.finance.status === 'Conditional')
              ).map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="w-full text-left p-3.5 bg-orange-50 border border-orange-200 rounded-xl hover:border-orange-600 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#1A2332] truncate">{l.customerName}</span>
                    <FinanceChip status={l.finance.status} />
                  </div>
                  <p className="text-[length:var(--t-micro)] text-[#6B7685] mt-0.5">
                    {l.finance.bank || 'No bank'} · submitted {ago(l.finance.submittedAt)}
                  </p>
                  {l.finance.outstandingDocs && l.finance.outstandingDocs.length > 0 && (
                    <p className="text-[length:var(--t-micro)] text-amber-700 mt-1">
                      {l.finance.outstandingDocs.length} doc(s) outstanding
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------- PIPELINE BOARD ---------------- */}
      {view === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-3 pb-6">
          {BOARD_STAGES.map((stage) => {
            const stageLeads = filtered.filter((l) => l.stage === stage.id);
            const stageValue = stageLeads.reduce((s, l) => s + l.vehicle.askingPrice, 0);
            return (
              <div
                key={stage.id}
                className="bg-white/80 p-3 rounded-[18px] border border-[rgba(10,20,32,0.08)] flex flex-col min-h-[420px]"
              >
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[rgba(10,20,32,0.08)]">
                  <h3 className="text-[length:var(--t-micro)] font-medium text-[#334155]">{stage.short}</h3>
                  <span className="px-1.5 py-0.5 bg-[#FAFAF8] text-[#334155] rounded-full text-[length:var(--t-micro)] font-medium border border-[rgba(10,20,32,0.08)]">
                    {stageLeads.length}
                  </span>
                </div>
                <div className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)] mb-2.5">{money(stageValue, cur)}</div>

                <div className="flex-1 space-y-2">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="p-2.5 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)] hover:border-cyan-500/60 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="text-[length:var(--t-micro)] font-medium text-[#1A2332] group-hover:text-[#0E9D98] truncate">
                          {lead.customerName}
                        </span>
                        <TempChip temp={lead.temperature} />
                      </div>
                      <p className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)] truncate">
                        {lead.vehicle.make} {lead.vehicle.model}
                      </p>
                      <p className="text-[length:var(--t-micro)] font-medium text-[#1A2332] mt-1">
                        {money(lead.vehicle.askingPrice, cur)}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[rgba(10,20,32,0.06)]">
                        <span className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.40)]">{ago(lead.lastContactedAt)}</span>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`tel:${lead.phone.replace(/[^0-9+]/g, '')}`}
                            className="p-1 rounded bg-white text-[#0E9D98] hover:bg-[#F5F4F1]"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded bg-white text-emerald-400 hover:bg-[#F5F4F1]"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-[rgba(10,20,32,0.08)] rounded-xl flex items-center justify-center text-[length:var(--t-micro)] text-[rgba(10,20,32,0.40)]">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- ALL LEADS ---------------- */}
      {view === 'list' && (
        <div className="bg-white/80 rounded-[18px] border border-[rgba(10,20,32,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAFAF8]/80 border-b border-[rgba(10,20,32,0.08)] text-[length:var(--t-micro)] font-medium text-[rgba(10,20,32,0.50)] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">F&amp;I</th>
                  <th className="px-5 py-3">Salesperson</th>
                  <th className="px-5 py-3">Speed</th>
                  <th className="px-5 py-3 text-right">Price / Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(10,20,32,0.06)]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-[rgba(10,20,32,0.50)] text-xs">
                      No leads match your search.
                    </td>
                  </tr>
                )}
                {filtered.map((lead) => {
                  const stl = speedToLeadMins(lead, activities);
                  const gross = totalGross(lead.dealSheet, lead.tradeIn.appraisedValue);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="hover:bg-[#F5F4F1] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#1A2332]">{lead.customerName}</p>
                        <p className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)] font-mono">{lead.reference} · {lead.source}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[#1A2332] text-xs">
                          {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                        </p>
                        <p className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)]">{lead.vehicle.stockNumber || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <StageChip stage={lead.stage} />
                      </td>
                      <td className="px-5 py-3.5">
                        <FinanceChip status={lead.finance.status} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#334155]">
                        {salespersonName(lead.salespersonId)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-xs font-medium ${
                            stl === null
                              ? 'text-rose-400'
                              : stl <= settings.speedToLeadTargetMins
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {stl === null ? 'No reply' : stl < 60 ? `${stl}m` : `${Math.round(stl / 60)}h`}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="font-medium text-[#1A2332]">{money(lead.vehicle.askingPrice, cur)}</p>
                        <p className={`text-[length:var(--t-micro)] font-semibold ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {money(gross, cur)} gross
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'performance' && <PerformanceView />}

      {/* Keyed by lead so opening a different customer resets to the Timeline tab
          rather than dropping you into the previous lead's F&I screen. */}
      {selected && <LeadDrawer key={selected.id} lead={selected} onClose={() => setSelected(null)} />}
      {showNew && (
        <NewLeadModal onClose={() => setShowNew(false)} onCreated={(lead) => setSelected(lead)} />
      )}
    </div>
  );
};
