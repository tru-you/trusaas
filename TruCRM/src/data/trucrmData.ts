import {
  Lead,
  LeadActivity,
  Appointment,
  Salesperson,
  DealershipSettings,
} from '../types/trucrm';

/* ============================================================================
   Seed data is intentionally empty — TruSaaS is a personal workspace, so a
   fresh install starts clean. The dealership settings and salesperson list are
   configuration (kept so the module renders), while leads, activities and
   appointments begin empty until the user adds their own.
   ========================================================================== */

export const initialDealershipSettings: DealershipSettings = {
  dealershipName: 'TruSaaS',
  currency: 'R',
  speedToLeadTargetMins: 15,
  followUpCadenceDays: [1, 3, 7, 14, 30],
  staleAfterDays: 5,
};

export const initialSalespeople: Salesperson[] = [
  { id: 'sp-1', name: 'Me', initials: 'ME', role: 'Sales Executive', monthlyTarget: 12, active: true },
];

export const initialLeads: Lead[] = [];
export const initialLeadActivities: LeadActivity[] = [];
export const initialAppointments: Appointment[] = [];
