/**
 * Central TruWidget configuration for Your Car Guy.
 * Single source of truth — the loader tag and every inline mount read from here.
 */

export const YCG = {
  dealer: "Your Car Guy",
  accent: "#E30613", // logo red
  wa: "27834659921",
  cdn: "https://cdn.tru-saas.com",
  // Leads POST here in the widget payload shape; the route fans out to
  // email + portal (WhatsApp is ALSO pinged client-side by the widget).
  webhook: "/api/lead",
  bookAddress: "17 Burt Drive, Newton Park, Port Elizabeth",
  shareSite: "https://yourcarguy.co.za",
  shareVehiclePath: "/vehicle/",
  theme: "light",
} as const;

/** Widget payload — mirrors what tru-form/tru-afford POST to data-webhook. */
export interface TruLeadPayload {
  dealerSlug?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone: string;
  email: string;
  source?: string;
  notes?: string;
  [k: string]: unknown;
}

declare global {
  interface Window {
    TruDealer?: {
      open: (widget: string, payload?: Record<string, unknown>) => void;
      closeAll: () => void;
      config: Record<string, unknown>;
    };
    TruSaaS?: typeof window.TruDealer;
    TruShare?: { open: (opts: Record<string, unknown>) => void };
    TruForm?: { open: (payload?: Record<string, unknown>) => void; close: () => void };
    TruAfford?: { open: (payload?: Record<string, unknown>) => void; close: () => void };
    TruRepay?: { open: (payload?: Record<string, unknown>) => void; close: () => void };
    TruBook?: { open: (payload?: Record<string, unknown>) => void };
    TruValue?: { open: (payload?: Record<string, unknown>) => void };
  }
}
