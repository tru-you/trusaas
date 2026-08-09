import React, { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  StickyNote,
  CalendarClock,
  Car,
  Banknote,
  Gauge,
  History,
  Repeat,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import { MarketPricing } from './MarketPricing';
import {
  Lead,
  LEAD_STAGES,
  LeadStageId,
  FinanceStatus,
  Bank,
  TradeInStatus,
} from '../../types/trucrm';
import {
  useTruCrm,
  frontGross,
  backGross,
  totalGross,
  balanceToFinance,
  speedToLeadMins,
  daysSinceContact,
  monthlyInstalment,
} from '../../context/TruCrmContext';
import { money, ago, when, StageChip, TempChip, FinanceChip, Field, inputClass, labelClass } from './shared';

const BANKS: Bank[] = ['WesBank', 'Absa', 'MFC (Nedbank)', 'Standard Bank', 'Investec', 'Other'];
const FINANCE_STATUSES: FinanceStatus[] = [
  'Not Started',
  'Docs Outstanding',
  'Submitted',
  'Approved',
  'Conditional',
  'Declined',
];
const TRADE_STATUSES: TradeInStatus[] = [
  'None',
  'Declared',
  'Appraisal Booked',
  'Appraised',
  'Accepted',
  'Declined',
];

type Tab = 'timeline' | 'deal' | 'trade' | 'finance' | 'market';

/** Secondary action: a hairline and muted text, lifting only on hover. */
const quietBtn =
  'py-2 rounded-[8px] border border-[color:var(--glass-line)] text-[color:var(--white-dim)] hover:text-[color:var(--white)] hover:border-[color:var(--cyan-soft)] text-[length:var(--t-micro)] font-medium flex items-center justify-center gap-1.5 transition-colors';

export const LeadDrawer: React.FC<{ lead: Lead; onClose: () => void }> = ({ lead: leadProp, onClose }) => {
  const {
    leads,
    settings,
    salespeople,
    salespersonName,
    activitiesFor,
    appointmentsFor,
    activities,
    logActivity,
    moveLeadStage,
    setFollowUp,
    advanceCadence,
    updateLead,
    deleteLead,
    addAppointment,
  } = useTruCrm();

  // Always read the live record so edits made here re-render immediately.
  const lead = leads.find((l) => l.id === leadProp.id) || leadProp;
  const cur = settings.currency;

  const [tab, setTab] = useState<Tab>('timeline');
  const [logChannel, setLogChannel] = useState<'call' | 'whatsapp' | 'email' | 'note'>('call');
  const [callOutcome, setCallOutcome] = useState<'connected' | 'voicemail' | 'no-answer' | 'wrong-number'>('connected');
  const [duration, setDuration] = useState('5');
  const [logBody, setLogBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [showLostPrompt, setShowLostPrompt] = useState(false);

  const timeline = activitiesFor(lead.id);
  const appts = appointmentsFor(lead.id);
  const stl = speedToLeadMins(lead, activities);
  const sinceContact = daysSinceContact(lead);
  const gross = totalGross(lead.dealSheet, lead.tradeIn.appraisedValue);

  const patch = (p: Partial<Lead>) => updateLead({ ...lead, ...p });

  const handleLog = () => {
    if (logChannel === 'call') {
      logActivity({
        leadId: lead.id,
        channel: 'call',
        summary: `Called — ${callOutcome.replace('-', ' ')}`,
        body: logBody || undefined,
        outcome: callOutcome,
        durationMinutes: Number(duration) || undefined,
      });
    } else if (logChannel === 'note') {
      logActivity({ leadId: lead.id, channel: 'note', summary: 'Note added', body: logBody });
    } else {
      logActivity({
        leadId: lead.id,
        channel: logChannel,
        summary: logChannel === 'whatsapp' ? 'WhatsApp sent' : 'Email sent',
        body: logBody || undefined,
      });
    }
    // Every logged touch should leave the lead with a next step, never dangling.
    if (logChannel !== 'note') advanceCadence(lead.id);
    setLogBody('');
  };

  const waPhone = lead.phone.replace(/[^0-9]/g, '');

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi ${lead.customerName.split(' ')[0]}, it's ${salespersonName(lead.salespersonId)} from ${
        settings.dealershipName
      } about the ${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}. Is now a good time?`
    );
    window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank');
    logActivity({ leadId: lead.id, channel: 'whatsapp', summary: 'WhatsApp opened' });
    advanceCadence(lead.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(10,20,32,0.40)]" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white border-l border-[rgba(10,20,32,0.08)] h-full overflow-y-auto shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 border-b border-[rgba(10,20,32,0.08)] p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[length:var(--t-micro)] font-mono text-[rgba(10,20,32,0.50)]">{lead.reference}</span>
                <StageChip stage={lead.stage} />
                <TempChip temp={lead.temperature} />
              </div>
              <h2 className="text-xl font-semibold text-[#1A2332] truncate">{lead.customerName}</h2>
              <p className="text-xs text-[#6B7685] mt-0.5">
                {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                {lead.vehicle.variant ? ` ${lead.vehicle.variant}` : ''} ·{' '}
                <span className="text-[#334155] font-semibold">{money(lead.vehicle.askingPrice, cur)}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 text-[#6B7685] hover:text-[#1A2332] bg-[#EFEDE8] rounded-lg shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick contact actions. Four equally-coloured buttons is four
              competing priorities; calling is the job, so only it is filled. */}
          <div className="grid grid-cols-4 gap-2">
            <a
              href={`tel:${lead.phone.replace(/[^0-9+]/g, '')}`}
              onClick={() => logActivity({ leadId: lead.id, channel: 'call', summary: 'Dialled' })}
              className="on-fill py-2 rounded-[8px] text-[length:var(--t-micro)] font-medium flex items-center justify-center gap-1.5 hover:brightness-110 transition-[filter]"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
            <button
              onClick={openWhatsApp}
              className={quietBtn}
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <a
              href={lead.email ? `mailto:${lead.email}` : undefined}
              onClick={() => lead.email && logActivity({ leadId: lead.id, channel: 'email', summary: 'Email opened' })}
              className={lead.email ? quietBtn : `${quietBtn} opacity-40 pointer-events-none`}
            >
              <Mail className="w-3.5 h-3.5" /> Email
            </a>
            <button
              onClick={() =>
                addAppointment({
                  leadId: lead.id,
                  type: 'Test Drive',
                  at: new Date(Date.now() + 86400_000).toISOString(),
                  durationMinutes: 45,
                  status: 'Booked',
                })
              }
              className={quietBtn}
            >
              <CalendarClock className="w-3.5 h-3.5" /> Book
            </button>
          </div>

          {/* Vital signs */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl py-2">
              <span className="block text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)]">Speed to Lead</span>
              <span
                className={`text-sm font-medium ${
                  stl === null
                    ? 'text-rose-400'
                    : stl <= settings.speedToLeadTargetMins
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {stl === null ? 'No reply' : stl < 60 ? `${stl}m` : `${Math.round(stl / 60)}h`}
              </span>
            </div>
            <div className="bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl py-2">
              <span className="block text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)]">Last Contact</span>
              <span className="text-sm font-medium text-[#1A2332]">
                {sinceContact === null ? 'Never' : `${sinceContact}d`}
              </span>
            </div>
            <div className="bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl py-2">
              <span className="block text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)]">Source</span>
              <span className="text-sm font-medium text-[#1A2332]">{lead.source}</span>
            </div>
            <div className="bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl py-2">
              <span className="block text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)]">Est. Gross</span>
              <span className={`text-sm font-medium ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {money(gross, cur)}
              </span>
            </div>
          </div>

          {/* Stage mover */}
          <div className="flex items-center gap-2">
            <select
              value={lead.stage}
              onChange={(e) => {
                const next = e.target.value as LeadStageId;
                if (next === 'lost') {
                  setShowLostPrompt(true);
                } else {
                  moveLeadStage(lead.id, next);
                }
              }}
              className="flex-1 bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2332] focus:outline-none focus:border-[#0E9D98]"
            >
              {LEAD_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={lead.nextFollowUpDate || ''}
              onChange={(e) => setFollowUp(lead.id, e.target.value, lead.nextFollowUpNote)}
              className="bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs text-[#1A2332] focus:outline-none focus:border-[#0E9D98]"
              title="Next follow-up date"
            />
          </div>

          {showLostPrompt && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-2">
              <label className={labelClass}>Why was this lead lost?</label>
              <div className="flex flex-wrap gap-1.5">
                {['Bought elsewhere', 'Finance declined', 'Price too high', 'Vehicle sold', 'No contact', 'Just looking'].map(
                  (r) => (
                    <button
                      key={r}
                      onClick={() => setLostReason(r)}
                      className={`px-2 py-1 rounded-lg text-[length:var(--t-micro)] font-semibold border ${
                        lostReason === r
                          ? 'bg-rose-800 text-white border-rose-600'
                          : 'bg-[#FAFAF8] text-[#6B7685] border-[rgba(10,20,32,0.08)] hover:text-[#1A2332]'
                      }`}
                    >
                      {r}
                    </button>
                  )
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowLostPrompt(false)}
                  className="px-3 py-1.5 text-[length:var(--t-micro)] text-[#6B7685] hover:text-[#1A2332]"
                >
                  Cancel
                </button>
                <button
                  disabled={!lostReason}
                  onClick={() => {
                    moveLeadStage(lead.id, 'lost', lostReason);
                    setShowLostPrompt(false);
                  }}
                  className="px-3 py-1.5 bg-rose-600 disabled:bg-[#EFEDE8] disabled:text-[rgba(10,20,32,0.50)] text-white rounded-lg text-[length:var(--t-micro)] font-medium"
                >
                  Mark Lost
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-[rgba(10,20,32,0.08)] bg-[#FAFAF8]">
          {([
            { id: 'timeline', label: 'Timeline', icon: History },
            { id: 'deal', label: 'Deal Sheet', icon: Banknote },
            { id: 'market', label: 'Market', icon: BarChart3 },
            { id: 'trade', label: 'Trade-In', icon: Repeat },
            { id: 'finance', label: 'F&I', icon: Gauge },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 rounded-xl text-[length:var(--t-micro)] font-medium flex items-center justify-center gap-1.5 transition-all ${
                tab === id ? 'bg-white text-black' : 'text-[#6B7685] hover:text-[#1A2332] hover:bg-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* ---------------- TIMELINE ---------------- */}
          {tab === 'timeline' && (
            <>
              {/* Log a touch */}
              <div className="p-4 bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-[18px] space-y-3">
                <h4 className="text-[length:var(--t-micro)] font-medium text-[#6B7685]">Log a touch</h4>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { id: 'call', label: 'Call', icon: Phone },
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                    { id: 'email', label: 'Email', icon: Mail },
                    { id: 'note', label: 'Note', icon: StickyNote },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setLogChannel(id)}
                      className={`py-2 rounded-xl text-[length:var(--t-micro)] font-medium flex flex-col items-center gap-1 border transition-all ${
                        logChannel === id
                          ? 'bg-[#EFEDE8] border-[#0E9D98] text-[#1A2332]'
                          : 'bg-[#FAFAF8] border-[rgba(10,20,32,0.08)] text-[#6B7685] hover:text-[#1A2332]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {logChannel === 'call' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={callOutcome}
                      onChange={(e) => setCallOutcome(e.target.value as any)}
                      className={inputClass}
                    >
                      <option value="connected">Connected</option>
                      <option value="voicemail">Voicemail</option>
                      <option value="no-answer">No answer</option>
                      <option value="wrong-number">Wrong number</option>
                    </select>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="Minutes"
                      className={inputClass}
                    />
                  </div>
                )}

                <textarea
                  rows={2}
                  value={logBody}
                  onChange={(e) => setLogBody(e.target.value)}
                  placeholder="What did the customer say?"
                  className={inputClass}
                />

                <button
                  onClick={handleLog}
                  disabled={logChannel === 'note' && !logBody.trim()}
                  className="w-full py-2 bg-[#0E9D98] hover:bg-[#14B8A6] disabled:bg-[#EFEDE8] disabled:text-[rgba(10,20,32,0.50)] text-white rounded-xl text-[length:var(--t-micro)] font-medium"
                >
                  Save to timeline
                  {logChannel !== 'note' && ' & set next follow-up'}
                </button>
              </div>

              {/* Appointments */}
              {appts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[length:var(--t-micro)] font-medium text-[#6B7685]">Appointments</h4>
                  {appts.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-medium text-[#1A2332]">{a.type}</p>
                        <p className="text-[length:var(--t-micro)] text-[#6B7685]">{when(a.at)} · {a.durationMinutes} min</p>
                        {a.notes && <p className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)] mt-1">{a.notes}</p>}
                      </div>
                      <span className="text-[length:var(--t-micro)] font-medium px-2 py-1 rounded-md bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] text-indigo-600">
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Activity feed */}
              <div className="space-y-2">
                <h4 className="text-[length:var(--t-micro)] font-medium text-[#6B7685]">
                  Activity ({timeline.length})
                </h4>
                {timeline.length === 0 && (
                  <div className="p-6 text-center border-2 border-dashed border-[rgba(10,20,32,0.08)] rounded-xl">
                    <p className="text-xs text-[rgba(10,20,32,0.50)]">
                      Nothing logged yet. This lead has never been worked.
                    </p>
                  </div>
                )}
                {timeline.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-[#0E9D98] mt-1.5 shrink-0" />
                      <div className="flex-1 w-px bg-[#EFEDE8]" />
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium text-[#1A2332]">{a.summary}</p>
                        {a.isFirstResponse && (
                          <span className="text-[length:var(--t-micro)] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-400 border border-emerald-200">
                            FIRST RESPONSE
                          </span>
                        )}
                        {a.durationMinutes ? (
                          <span className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)]">{a.durationMinutes} min</span>
                        ) : null}
                      </div>
                      {a.body && <p className="text-[length:var(--t-micro)] text-[#6B7685] mt-0.5 whitespace-pre-line">{a.body}</p>}
                      <p className="text-[length:var(--t-micro)] text-slate-600 mt-0.5">
                        {when(a.at)} · {a.by}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ---------------- DEAL SHEET ---------------- */}
          {tab === 'deal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['vehiclePrice', 'Vehicle Price'],
                  ['discount', 'Discount'],
                  ['tradeAllowance', 'Trade Allowance'],
                  ['tradeSettlement', 'Trade Settlement'],
                  ['deposit', 'Customer Deposit'],
                  ['vapsValue', 'VAPs / F&I Income'],
                  ['costOfSale', 'Stand-in Value (cost)'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    <input
                      type="number"
                      value={lead.dealSheet[key]}
                      onChange={(e) =>
                        patch({ dealSheet: { ...lead.dealSheet, [key]: Number(e.target.value) || 0 } })
                      }
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-[18px] space-y-2.5">
                {[
                  ['Front gross', frontGross(lead.dealSheet, lead.tradeIn.appraisedValue)],
                  ['Back gross (F&I)', backGross(lead.dealSheet)],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between text-xs">
                    <span className="text-[#6B7685]">{label}</span>
                    <span className={`font-medium ${(val as number) >= 0 ? 'text-[#1A2332]' : 'text-rose-400'}`}>
                      {money(val as number, cur)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2.5 border-t border-[rgba(10,20,32,0.08)]">
                  <span className="font-medium text-[#1A2332]">Total gross</span>
                  <span className={`font-semibold ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {money(gross, cur)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-2.5 border-t border-[rgba(10,20,32,0.08)]">
                  <span className="text-[#6B7685]">Balance to finance</span>
                  <span className="font-medium text-[#0E9D98]">{money(balanceToFinance(lead.dealSheet), cur)}</span>
                </div>
              </div>

              {lead.tradeIn.appraisedValue !== undefined &&
                lead.dealSheet.tradeAllowance > lead.tradeIn.appraisedValue && (
                  <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[length:var(--t-micro)] text-amber-200">
                      Over-allowing{' '}
                      <strong>{money(lead.dealSheet.tradeAllowance - lead.tradeIn.appraisedValue, cur)}</strong> on the
                      trade. This is deducted from front gross above.
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* ---------------- MARKET ---------------- */}
          {tab === 'market' && (
            <MarketPricing vehicle={lead.vehicle} currency={cur} />
          )}

          {/* ---------------- TRADE-IN ---------------- */}
          {tab === 'trade' && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Trade status</label>
                <select
                  value={lead.tradeIn.status}
                  onChange={(e) =>
                    patch({ tradeIn: { ...lead.tradeIn, status: e.target.value as TradeInStatus } })
                  }
                  className={inputClass}
                >
                  {TRADE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {lead.tradeIn.status !== 'None' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Year</label>
                      <input
                        type="number"
                        value={lead.tradeIn.year || ''}
                        onChange={(e) => patch({ tradeIn: { ...lead.tradeIn, year: Number(e.target.value) } })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Make</label>
                      <input
                        value={lead.tradeIn.make || ''}
                        onChange={(e) => patch({ tradeIn: { ...lead.tradeIn, make: e.target.value } })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Model</label>
                      <input
                        value={lead.tradeIn.model || ''}
                        onChange={(e) => patch({ tradeIn: { ...lead.tradeIn, model: e.target.value } })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Mileage (km)</label>
                      <input
                        type="number"
                        value={lead.tradeIn.mileage || ''}
                        onChange={(e) => patch({ tradeIn: { ...lead.tradeIn, mileage: Number(e.target.value) } })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Customer expectation</label>
                      <input
                        type="number"
                        value={lead.tradeIn.customerExpectation || ''}
                        onChange={(e) =>
                          patch({ tradeIn: { ...lead.tradeIn, customerExpectation: Number(e.target.value) } })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Appraised value</label>
                      <input
                        type="number"
                        value={lead.tradeIn.appraisedValue || ''}
                        onChange={(e) =>
                          patch({ tradeIn: { ...lead.tradeIn, appraisedValue: Number(e.target.value) } })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Settlement outstanding</label>
                      <input
                        type="number"
                        value={lead.tradeIn.settlementAmount || ''}
                        onChange={(e) =>
                          patch({ tradeIn: { ...lead.tradeIn, settlementAmount: Number(e.target.value) } })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Appraisal notes</label>
                    <textarea
                      rows={3}
                      value={lead.tradeIn.appraisalNotes || ''}
                      onChange={(e) => patch({ tradeIn: { ...lead.tradeIn, appraisalNotes: e.target.value } })}
                      placeholder="Damage, tyres, service history, warning lights…"
                      className={inputClass}
                    />
                  </div>

                  {lead.tradeIn.customerExpectation !== undefined &&
                    lead.tradeIn.appraisedValue !== undefined && (
                      <div className="p-3 bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl flex justify-between text-xs">
                        <span className="text-[#6B7685]">Expectation gap</span>
                        <span className="font-medium text-amber-400">
                          {money(lead.tradeIn.customerExpectation - lead.tradeIn.appraisedValue, cur)} to bridge
                        </span>
                      </div>
                    )}

                  <div className="p-3 bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[length:var(--t-micro)] font-medium text-[#1A2332]">TruValue appraisal</p>
                      <p className="text-[length:var(--t-micro)] text-[rgba(10,20,32,0.50)]">
                        {lead.tradeIn.truValueRef ? `Linked: ${lead.tradeIn.truValueRef}` : 'No appraisal linked yet'}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        patch({
                          tradeIn: {
                            ...lead.tradeIn,
                            status: lead.tradeIn.status === 'None' ? 'Appraisal Booked' : lead.tradeIn.status,
                            truValueRef: lead.tradeIn.truValueRef || `TV-${new Date().getFullYear()}-${Date.now() % 10000}`,
                          },
                        })
                      }
                      className="px-3 py-1.5 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-[#1A2332] rounded-lg text-[length:var(--t-micro)] font-medium flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {lead.tradeIn.truValueRef ? 'Open' : 'Start appraisal'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------- F&I ---------------- */}
          {tab === 'finance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Application status</label>
                  <select
                    value={lead.finance.status}
                    onChange={(e) =>
                      patch({ finance: { ...lead.finance, status: e.target.value as FinanceStatus } })
                    }
                    className={inputClass}
                  >
                    {FINANCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Bank</label>
                  <select
                    value={lead.finance.bank || ''}
                    onChange={(e) => patch({ finance: { ...lead.finance, bank: e.target.value as Bank } })}
                    className={inputClass}
                  >
                    <option value="">Not selected</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Approved amount</label>
                  <input
                    type="number"
                    value={lead.finance.approvedAmount || ''}
                    onChange={(e) =>
                      patch({ finance: { ...lead.finance, approvedAmount: Number(e.target.value) } })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Term (months)</label>
                  <input
                    type="number"
                    value={lead.finance.termMonths || ''}
                    onChange={(e) => patch({ finance: { ...lead.finance, termMonths: Number(e.target.value) } })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lead.finance.rate || ''}
                    onChange={(e) => patch({ finance: { ...lead.finance, rate: Number(e.target.value) } })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Balloon (%)</label>
                  <input
                    type="number"
                    value={lead.finance.balloonPct || ''}
                    onChange={(e) => patch({ finance: { ...lead.finance, balloonPct: Number(e.target.value) } })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Conditions / decline reason</label>
                <textarea
                  rows={2}
                  value={lead.finance.conditions || ''}
                  onChange={(e) => patch({ finance: { ...lead.finance, conditions: e.target.value } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-[18px] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[length:var(--t-micro)] font-medium text-[#6B7685]">
                    Outstanding FICA / affordability docs
                  </h4>
                  <FinanceChip status={lead.finance.status} />
                </div>
                {['ID copy', 'Proof of residence', 'Latest payslip', '3 months bank statements', "Driver's licence"].map(
                  (doc) => {
                    const outstanding = lead.finance.outstandingDocs?.includes(doc) ?? false;
                    return (
                      <button
                        key={doc}
                        onClick={() => {
                          const cur = lead.finance.outstandingDocs || [];
                          patch({
                            finance: {
                              ...lead.finance,
                              outstandingDocs: outstanding ? cur.filter((d) => d !== doc) : [...cur, doc],
                            },
                          });
                        }}
                        className="w-full flex items-center justify-between py-1.5 text-xs group"
                      >
                        <span className={outstanding ? 'text-amber-300' : 'text-[rgba(10,20,32,0.50)] line-through'}>{doc}</span>
                        {outstanding ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </button>
                    );
                  }
                )}
                <p className="text-[length:var(--t-micro)] text-slate-600 pt-1">Tap a document to toggle received / outstanding.</p>
              </div>

              {/* Desking: customers buy a monthly payment, so quote one. */}
              <div className="tru-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[length:var(--t-micro)] text-[color:var(--muted)]">
                    Monthly instalment
                  </h4>
                  <span className="text-[length:var(--t-micro)] text-[color:var(--faint)]">
                    incl. R69 service fee
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-[38px] leading-none font-semibold tracking-[-0.022em] text-[color:var(--cyan)] tru-mono">
                    {money(
                      monthlyInstalment({
                        amountFinanced: balanceToFinance(lead.dealSheet),
                        annualRatePct: lead.finance.rate || 13.5,
                        termMonths: lead.finance.termMonths || 72,
                        balloonPct: lead.finance.balloonPct || 0,
                      }),
                      cur
                    )}
                  </span>
                  <span className="text-[length:var(--t-small)] text-[color:var(--muted)]">per month</span>
                </div>

                {/* Terms read as a sentence of figures, not three boxed tiles. */}
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[length:var(--t-micro)] pt-1">
                  {[
                    ['Financed', money(balanceToFinance(lead.dealSheet), cur)],
                    ['Term', `${lead.finance.termMonths || 72} months`],
                    ['Rate', `${lead.finance.rate || 13.5}%`],
                    ['Balloon', `${lead.finance.balloonPct || 0}%`],
                  ].map(([k, v]) => (
                    <span key={k as string} className="text-[color:var(--faint)]">
                      {k} <span className="text-[color:var(--white-dim)] tru-mono ml-0.5">{v}</span>
                    </span>
                  ))}
                </div>

                {/* What-if: the three levers a salesperson actually pulls. */}
                <div className="pt-2 border-t border-[rgba(10,20,32,0.08)] space-y-1.5">
                  <span className="text-[length:var(--t-micro)] font-medium text-[rgba(10,20,32,0.50)]">
                    What if…
                  </span>
                  {[
                    { label: '+R10 000 deposit', deposit: 10000, term: 0, balloon: 0 },
                    { label: '84-month term', deposit: 0, term: 84, balloon: 0 },
                    { label: '30% balloon', deposit: 0, term: 0, balloon: 30 },
                  ].map((scenario) => {
                    const base = monthlyInstalment({
                      amountFinanced: balanceToFinance(lead.dealSheet),
                      annualRatePct: lead.finance.rate || 13.5,
                      termMonths: lead.finance.termMonths || 72,
                      balloonPct: lead.finance.balloonPct || 0,
                    });
                    const alt = monthlyInstalment({
                      amountFinanced: Math.max(
                        0,
                        balanceToFinance(lead.dealSheet) - scenario.deposit
                      ),
                      annualRatePct: lead.finance.rate || 13.5,
                      termMonths: scenario.term || lead.finance.termMonths || 72,
                      balloonPct: scenario.balloon || lead.finance.balloonPct || 0,
                    });
                    const delta = alt - base;
                    return (
                      <div key={scenario.label} className="flex justify-between text-[length:var(--t-micro)]">
                        <span className="text-[#6B7685]">{scenario.label}</span>
                        <span className="font-medium text-[#1A2332]">
                          {money(alt, cur)}
                          <span className={delta < 0 ? 'text-emerald-400 ml-1.5' : 'text-amber-400 ml-1.5'}>
                            {delta < 0 ? '' : '+'}
                            {money(delta, cur)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[length:var(--t-micro)] text-slate-600 leading-relaxed">
                  Estimate only — initiation fee capitalised at R1 207.50. Final figures subject to bank approval.
                </p>
              </div>

              {lead.finance.approvedAmount !== undefined &&
                lead.finance.approvedAmount > 0 &&
                lead.finance.approvedAmount < balanceToFinance(lead.dealSheet) && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[length:var(--t-micro)] text-rose-200">
                      Approval is{' '}
                      <strong>{money(balanceToFinance(lead.dealSheet) - lead.finance.approvedAmount, cur)}</strong> short
                      of the balance. Needs a bigger deposit, a cheaper unit, or a re-submission.
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-[rgba(10,20,32,0.08)] flex items-center justify-between">
            <div className="text-[length:var(--t-micro)] text-slate-600">
              Assigned to <span className="text-[#6B7685] font-semibold">{salespersonName(lead.salespersonId)}</span> ·
              created {ago(lead.createdAt)}
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setConfirmDelete(false)} className="text-[length:var(--t-micro)] text-[#6B7685] px-2">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteLead(lead.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[length:var(--t-micro)] font-medium"
                >
                  Confirm delete
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-[rgba(10,20,32,0.50)] hover:text-rose-400 rounded-lg"
                title="Delete lead"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
