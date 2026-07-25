import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Lead,
  LeadActivity,
  Appointment,
  Salesperson,
  DealershipSettings,
  LeadStageId,
  ActivityChannel,
  DealSheet,
  OPEN_STAGES,
} from '../types/trucrm';
import {
  initialLeads,
  initialLeadActivities,
  initialAppointments,
  initialSalespeople,
  initialDealershipSettings,
} from '../data/trucrmData';

const KEY = 'trucrm_v1';

function load<T>(suffix: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${KEY}_${suffix}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupt or unreadable storage should degrade to seed data, not a white screen.
    return fallback;
  }
}

/**
 * Local-calendar YYYY-MM-DD. Must not use toISOString(), which is UTC — in SAST
 * that shifts "today" by two hours and drops early-morning appointments off the
 * diary. Follow-up dates are a human, local-day concept.
 */
export const localDay = (d: Date | string | number = new Date()): string => {
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const today = () => localDay();
const addDays = (days: number) => localDay(Date.now() + days * 86400_000);

// ---------------------------------------------------------------------------
// Derived dealership metrics
// ---------------------------------------------------------------------------

/**
 * Front gross is the vehicle margin after discount and any over-allowance on the
 * trade. Over-allowance is what we paid above appraised value to make the deal
 * work — it comes straight off front gross, which is exactly how a dealer sees it.
 */
export function frontGross(sheet: DealSheet, appraisedValue?: number): number {
  const overAllowance =
    appraisedValue !== undefined && sheet.tradeAllowance > 0
      ? Math.max(0, sheet.tradeAllowance - appraisedValue)
      : 0;
  return sheet.vehiclePrice - sheet.discount - sheet.costOfSale - overAllowance;
}

/** Back gross is F&I product income. */
export function backGross(sheet: DealSheet): number {
  return sheet.vapsValue;
}

export function totalGross(sheet: DealSheet, appraisedValue?: number): number {
  return frontGross(sheet, appraisedValue) + backGross(sheet);
}

/** Cash the customer must still bring, after trade equity and deposit. */
export function balanceToFinance(sheet: DealSheet): number {
  const tradeEquity = sheet.tradeAllowance - sheet.tradeSettlement;
  return Math.max(0, sheet.vehiclePrice - sheet.discount - tradeEquity - sheet.deposit);
}

/**
 * Monthly instalment on a South African instalment-sale agreement.
 *
 * Standard amortisation with a residual (balloon) that is NOT amortised — only its
 * present value is deducted from the amount financed, because the customer settles
 * it as a lump sum at term end. The NCA initiation fee is capitalised (financed)
 * rather than paid up front, which is how dealers quote it, and the monthly service
 * fee is added after amortisation because it is a flat admin charge, not interest.
 */
export function monthlyInstalment(opts: {
  amountFinanced: number;
  annualRatePct: number;
  termMonths: number;
  balloonPct?: number;
  initiationFee?: number;
  serviceFee?: number;
}): number {
  const {
    amountFinanced,
    annualRatePct,
    termMonths,
    balloonPct = 0,
    initiationFee = 1207.5,
    serviceFee = 69,
  } = opts;

  if (amountFinanced <= 0 || termMonths <= 0) return 0;

  const principal = amountFinanced + initiationFee;
  const balloon = amountFinanced * (balloonPct / 100);
  const i = annualRatePct / 100 / 12;

  // Zero-rate deals still have to amortise, just without interest.
  if (i === 0) return (principal - balloon) / termMonths + serviceFee;

  const pvBalloon = balloon / Math.pow(1 + i, termMonths);
  const amortised = principal - pvBalloon;
  const payment = (amortised * i) / (1 - Math.pow(1 + i, -termMonths));

  return payment + serviceFee;
}

/** Minutes from lead arrival to first outbound response, or null if never responded. */
export function speedToLeadMins(lead: Lead, activities: LeadActivity[]): number | null {
  const first = activities
    .filter((a) => a.leadId === lead.id && a.channel !== 'note' && a.channel !== 'stage')
    .sort((a, b) => +new Date(a.at) - +new Date(b.at))[0];
  if (!first) return null;
  return Math.round((+new Date(first.at) - +new Date(lead.createdAt)) / 60000);
}

export function daysSinceContact(lead: Lead): number | null {
  if (!lead.lastContactedAt) return null;
  return Math.floor((Date.now() - +new Date(lead.lastContactedAt)) / 86400_000);
}

export function isOpen(lead: Lead): boolean {
  return OPEN_STAGES.includes(lead.stage);
}

// ---------------------------------------------------------------------------

interface TruCrmContextType {
  leads: Lead[];
  activities: LeadActivity[];
  appointments: Appointment[];
  salespeople: Salesperson[];
  settings: DealershipSettings;

  addLead: (lead: Omit<Lead, 'id' | 'reference' | 'createdAt'>) => Lead;
  updateLead: (lead: Lead) => void;
  moveLeadStage: (leadId: string, stage: LeadStageId, lostReason?: string) => void;
  deleteLead: (leadId: string) => void;

  logActivity: (input: {
    leadId: string;
    channel: ActivityChannel;
    summary: string;
    body?: string;
    outcome?: LeadActivity['outcome'];
    durationMinutes?: number;
    by?: string;
  }) => void;

  setFollowUp: (leadId: string, date: string, note?: string) => void;
  /** Applies the next step of the dealership cadence from today. */
  advanceCadence: (leadId: string, note?: string) => void;

  addAppointment: (appt: Omit<Appointment, 'id'>) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void;

  importLeads: (rows: Omit<Lead, 'id' | 'reference' | 'createdAt'>[]) => number;
  updateSettings: (patch: Partial<DealershipSettings>) => void;
  resetTruCrm: () => void;

  // Derived work queues
  dueToday: Lead[];
  overdue: Lead[];
  unworked: Lead[];
  stale: Lead[];
  metrics: {
    openLeads: number;
    deliveredThisMonth: number;
    medianSpeedToLeadMins: number | null;
    withinSpeedTargetPct: number | null;
    grossThisMonth: number;
    appointmentsToday: number;
    pipelineValue: number;
    closingRatePct: number | null;
  };
  salespersonName: (id: string) => string;
  activitiesFor: (leadId: string) => LeadActivity[];
  appointmentsFor: (leadId: string) => Appointment[];
}

const TruCrmContext = createContext<TruCrmContextType | undefined>(undefined);

export const TruCrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>(() => load('leads', initialLeads));
  const [activities, setActivities] = useState<LeadActivity[]>(() =>
    load('activities', initialLeadActivities)
  );
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    load('appointments', initialAppointments)
  );
  const [salespeople, setSalespeople] = useState<Salesperson[]>(() =>
    load('salespeople', initialSalespeople)
  );
  const [settings, setSettings] = useState<DealershipSettings>(() =>
    load('settings', initialDealershipSettings)
  );

  useEffect(() => {
    localStorage.setItem(`${KEY}_leads`, JSON.stringify(leads));
    localStorage.setItem(`${KEY}_activities`, JSON.stringify(activities));
    localStorage.setItem(`${KEY}_appointments`, JSON.stringify(appointments));
    localStorage.setItem(`${KEY}_salespeople`, JSON.stringify(salespeople));
    localStorage.setItem(`${KEY}_settings`, JSON.stringify(settings));
  }, [leads, activities, appointments, salespeople, settings]);

  const nextReference = () => {
    const year = new Date().getFullYear();
    const seq = leads.length + 1;
    return `UP-${year}-${String(seq).padStart(4, '0')}`;
  };

  const addLead: TruCrmContextType['addLead'] = (data) => {
    const lead: Lead = {
      ...data,
      id: `lead-${Date.now()}`,
      reference: nextReference(),
      createdAt: new Date().toISOString(),
    };
    setLeads((prev) => [lead, ...prev]);
    return lead;
  };

  const updateLead = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const deleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setActivities((prev) => prev.filter((a) => a.leadId !== leadId));
    setAppointments((prev) => prev.filter((a) => a.leadId !== leadId));
  };

  const logActivity: TruCrmContextType['logActivity'] = ({
    leadId,
    channel,
    summary,
    body,
    outcome,
    durationMinutes,
    by = 'You',
  }) => {
    const now = new Date().toISOString();
    const isFirst = !activities.some(
      (a) => a.leadId === leadId && a.channel !== 'note' && a.channel !== 'stage'
    );

    const entry: LeadActivity = {
      id: `act-${Date.now()}`,
      leadId,
      channel,
      summary,
      body,
      outcome,
      durationMinutes,
      at: now,
      by,
      isFirstResponse: isFirst && channel !== 'note' && channel !== 'stage',
    };
    setActivities((prev) => [entry, ...prev]);

    // Notes and stage changes are record-keeping, not customer contact, so they
    // must not reset the follow-up clock.
    if (channel === 'note' || channel === 'stage') return;

    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const next = { ...l, lastContactedAt: now };
        // A brand-new lead that just got its first touch is now "contacted".
        if (l.stage === 'new') next.stage = 'contacted';
        return next;
      })
    );
  };

  const moveLeadStage = (leadId: string, stage: LeadStageId, lostReason?: string) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const next: Lead = { ...l, stage };
        if (stage === 'lost') {
          next.lostReason = lostReason || l.lostReason || 'Not specified';
          next.nextFollowUpDate = undefined;
          next.nextFollowUpNote = undefined;
        }
        if (stage === 'delivered') {
          next.deliveredAt = new Date().toISOString();
          next.nextFollowUpDate = undefined;
          next.nextFollowUpNote = undefined;
        }
        return next;
      })
    );

    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      const entry: LeadActivity = {
        id: `act-stage-${Date.now()}`,
        leadId,
        channel: 'stage',
        summary: `Stage moved to ${stage}`,
        body: stage === 'lost' && lostReason ? `Reason: ${lostReason}` : undefined,
        at: new Date().toISOString(),
        by: 'You',
      };
      setActivities((prev) => [entry, ...prev]);
    }
  };

  const setFollowUp = (leadId: string, date: string, note?: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, nextFollowUpDate: date, nextFollowUpNote: note } : l
      )
    );
  };

  const advanceCadence = (leadId: string, note?: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const ageDays = Math.floor((Date.now() - +new Date(lead.createdAt)) / 86400_000);
    // Pick the first cadence step still ahead of the lead's current age.
    const nextStep = settings.followUpCadenceDays.find((d) => d > ageDays);
    const offset = nextStep ? nextStep - ageDays : 30;
    setFollowUp(leadId, addDays(offset), note);
  };

  const addAppointment = (appt: Omit<Appointment, 'id'>) => {
    setAppointments((prev) => [{ ...appt, id: `appt-${Date.now()}` }, ...prev]);
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status']) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const importLeads: TruCrmContextType['importLeads'] = (rows) => {
    const year = new Date().getFullYear();
    const created = rows.map((r, i) => ({
      ...r,
      id: `lead-${Date.now()}-${i}`,
      reference: `UP-${year}-${String(leads.length + i + 1).padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
    })) as Lead[];
    setLeads((prev) => [...created, ...prev]);
    return created.length;
  };

  const updateSettings = (patch: Partial<DealershipSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  const resetTruCrm = () => {
    setLeads(initialLeads);
    setActivities(initialLeadActivities);
    setAppointments(initialAppointments);
    setSalespeople(initialSalespeople);
    setSettings(initialDealershipSettings);
  };

  // -------------------------------------------------------------------------
  // Work queues & metrics
  // -------------------------------------------------------------------------
  const derived = useMemo(() => {
    const t = today();
    const open = leads.filter(isOpen);

    const dueToday = open.filter((l) => l.nextFollowUpDate === t);
    const overdue = open.filter((l) => l.nextFollowUpDate && l.nextFollowUpDate < t);
    // An unworked lead has never been touched — the most expensive kind to have.
    const unworked = open.filter((l) => !l.lastContactedAt);
    const stale = open.filter((l) => {
      const d = daysSinceContact(l);
      return d !== null && d >= settings.staleAfterDays;
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const deliveredThisMonth = leads.filter(
      (l) => l.stage === 'delivered' && l.deliveredAt && +new Date(l.deliveredAt) >= +monthStart
    );

    const grossThisMonth = deliveredThisMonth.reduce(
      (sum, l) => sum + totalGross(l.dealSheet, l.tradeIn.appraisedValue),
      0
    );

    const responded = leads
      .map((l) => speedToLeadMins(l, activities))
      .filter((v): v is number => v !== null);

    // Median, not mean: one lead answered three days late would otherwise make a
    // fast-responding floor look broken.
    const sorted = [...responded].sort((a, b) => a - b);
    const medianSpeedToLeadMins = sorted.length
      ? sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : null;

    const withinSpeedTargetPct = responded.length
      ? Math.round(
          (responded.filter((m) => m <= settings.speedToLeadTargetMins).length / responded.length) * 100
        )
      : null;

    const appointmentsToday = appointments.filter(
      (a) => localDay(a.at) === t && a.status !== 'Cancelled'
    ).length;

    const pipelineValue = open.reduce((sum, l) => sum + l.vehicle.askingPrice, 0);

    const closed = leads.filter((l) => l.stage === 'delivered' || l.stage === 'lost');
    const closingRatePct = closed.length
      ? Math.round((closed.filter((l) => l.stage === 'delivered').length / closed.length) * 100)
      : null;

    return {
      dueToday,
      overdue,
      unworked,
      stale,
      metrics: {
        openLeads: open.length,
        deliveredThisMonth: deliveredThisMonth.length,
        medianSpeedToLeadMins,
        withinSpeedTargetPct,
        grossThisMonth,
        appointmentsToday,
        pipelineValue,
        closingRatePct,
      },
    };
  }, [leads, activities, appointments, settings]);

  const salespersonName = (id: string) =>
    salespeople.find((s) => s.id === id)?.name || 'Unassigned';

  const activitiesFor = (leadId: string) =>
    activities
      .filter((a) => a.leadId === leadId)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const appointmentsFor = (leadId: string) =>
    appointments
      .filter((a) => a.leadId === leadId)
      .sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return (
    <TruCrmContext.Provider
      value={{
        leads,
        activities,
        appointments,
        salespeople,
        settings,
        addLead,
        updateLead,
        moveLeadStage,
        deleteLead,
        logActivity,
        setFollowUp,
        advanceCadence,
        addAppointment,
        updateAppointmentStatus,
        importLeads,
        updateSettings,
        resetTruCrm,
        ...derived,
        salespersonName,
        activitiesFor,
        appointmentsFor,
      }}
    >
      {children}
    </TruCrmContext.Provider>
  );
};

export const useTruCrm = () => {
  const ctx = useContext(TruCrmContext);
  if (!ctx) throw new Error('useTruCrm must be used within a TruCrmProvider');
  return ctx;
};
