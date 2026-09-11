/**
 * LexisNexis / WinDeed API Client — CIPC, Deeds Office, and Home Affairs ID Verification.
 *
 * Integrates with packages/billing-ledger.ts to record live API call usage.
 * Strict Live Gating: Requires valid LEXISNEXIS_API_KEY in environment. No mock fallbacks on production.
 */

import { recordApiUsage } from './billing-ledger';

export interface LexisNexisOpts {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  product?: 'truflow' | 'truproperty' | 'trudata' | 'truinspect' | 'trulens';
}

export interface CipcCompanyInfo {
  registrationNumber: string;
  companyName: string;
  status: 'In Business' | 'Deregistered' | 'Deregistration Process' | 'Unknown';
  registrationDate: string;
  taxNumber?: string;
  businessType: string;
  registeredAddress?: string;
  directors: Array<{
    idNumber: string;
    fullName: string;
    role: string;
    appointedDate: string;
    status: string;
  }>;
}

export interface DeedsPropertyInfo {
  propertyId: string;
  township: string;
  erfNumber: string;
  portionNumber: string;
  province: string;
  titleDeedNumber: string;
  registeredOwner: string;
  ownerIdOrRegNo: string;
  purchasePrice: number;
  purchaseDate: string;
  registrationDate: string;
  extentSqm: number;
  bonds: Array<{
    bondHolder: string;
    bondAmount: number;
    bondNumber: string;
  }>;
}

export interface IdVerificationResult {
  idNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  deceasedStatus: 'ALIVE' | 'DECEASED';
  idIssuedDate?: string;
  status: 'VERIFIED' | 'NOT_FOUND' | 'MISMATCH';
}

function getOpts(opts?: LexisNexisOpts): Required<LexisNexisOpts> {
  return {
    apiKey: opts?.apiKey || process.env.LEXISNEXIS_API_KEY || '',
    clientId: opts?.clientId || process.env.LEXISNEXIS_CLIENT_ID || '',
    clientSecret: opts?.clientSecret || process.env.LEXISNEXIS_SECRET || '',
    tenantId: opts?.tenantId || 'platform-default',
    product: opts?.product || 'trudata',
  };
}

/**
 * CIPC Company & Director Search
 */
export async function searchCipcCompany(
  companyRegOrName: string,
  opts?: LexisNexisOpts
): Promise<CipcCompanyInfo> {
  const config = getOpts(opts);

  if (!config.apiKey) {
    throw new Error('LexisNexis API key not configured. Live provider connection pending.');
  }

  const response = await fetch(`https://api.windeed.co.za/v1/cipc/company?query=${encodeURIComponent(companyRegOrName)}`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Client-ID': config.clientId,
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LexisNexis CIPC API error: ${response.status} ${response.statusText} — ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  // Record live call in central billing ledger
  recordApiUsage(config.tenantId, config.product, 'lexisnexis_cipc', 12.00, {
    query: companyRegOrName,
  });

  return data;
}

/**
 * Deeds Office Property Ownership Search
 */
export async function searchDeedsProperty(
  townshipOrErf: string,
  province: string = 'Gauteng',
  opts?: LexisNexisOpts
): Promise<DeedsPropertyInfo> {
  const config = getOpts(opts);

  if (!config.apiKey) {
    throw new Error('LexisNexis API key not configured. Live provider connection pending.');
  }

  const response = await fetch(`https://api.windeed.co.za/v1/deeds/property?query=${encodeURIComponent(townshipOrErf)}&province=${encodeURIComponent(province)}`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Client-ID': config.clientId,
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LexisNexis Deeds API error: ${response.status} ${response.statusText} — ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  recordApiUsage(config.tenantId, config.product, 'lexisnexis_deeds_property', 18.00, {
    query: townshipOrErf,
    province,
  });

  return data;
}

/**
 * Home Affairs SA ID Verification (FICA Check)
 */
export async function verifyIdNumber(
  idNumber: string,
  opts?: LexisNexisOpts
): Promise<IdVerificationResult> {
  const config = getOpts(opts);

  if (!config.apiKey) {
    throw new Error('LexisNexis API key not configured. Live provider connection pending.');
  }

  const response = await fetch(`https://api.windeed.co.za/v1/id/verify?idNumber=${encodeURIComponent(idNumber)}`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Client-ID': config.clientId,
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LexisNexis ID Verify API error: ${response.status} ${response.statusText} — ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  recordApiUsage(config.tenantId, config.product, 'lexisnexis_id_verify', 8.00, {
    idNumber: idNumber.slice(0, 6) + '******',
  });

  return data;
}
