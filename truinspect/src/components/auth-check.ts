/**
 * Shared Auth & Health Configuration Helpers
 * Used across TruLens, TruInspect, and TruFlow PWAs
 */

export interface HealthResponse {
  ok?: boolean;
  status?: string;
  accessCodeConfigured?: boolean;
  syncKeyConfigured?: boolean;
  dealerCodesConfigured?: number | string;
  [key: string]: any;
}

export function isServerSecured(healthData: HealthResponse | null | undefined): boolean {
  if (!healthData) return false;
  return Boolean(
    healthData.accessCodeConfigured ||
    healthData.syncKeyConfigured ||
    Number(healthData.dealerCodesConfigured) > 0
  );
}
