import { TruDocsState } from './truDocs';
import { apiFetch } from './api';

// Client e-signature links. The CRM freezes a document (TruDocsState), the
// server stores it under a slug, and the client opens /tru-sign.html?id=<slug>
// on their phone, draws a signature and submits. The signature flows back via
// /esig/status and lands on the CRM record.

export type EsigKind = 'quote' | 'invoice' | 'sla';

export interface EsigSigned {
  name: string;
  signature: string; // PNG data URL
  signedAt: string; // ISO timestamp
}

export interface EsigShareTarget {
  id: string; // unique slug, used in the signing URL
  kind: EsigKind;
  title: string; // e.g. "Quote Q-2026-014"
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  currency: string;
  doc: TruDocsState; // frozen snapshot published to the server
  onSigned: (signed: EsigSigned) => void;
}

export const signingUrl = (id: string) =>
  `${window.location.origin}/tru-sign.html?id=${encodeURIComponent(id)}`;

export async function publishEsig(target: EsigShareTarget): Promise<string> {
  const res = await apiFetch('/api/esig/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: target.id,
      kind: target.kind,
      docNo: target.doc.fields.docNo || target.title,
      mode: target.doc.mode,
      vat: target.doc.vat,
      currency: target.currency,
      fields: target.doc.fields,
      rows: target.doc.rows,
    }),
  });
  if (!res.ok) {
    let message = 'Could not publish the signing link.';
    try {
      message = (await res.json()).error || message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return signingUrl(target.id);
}

export interface EsigStatus {
  signed: boolean;
  name?: string;
  signature?: string;
  signedAt?: string;
}

export async function fetchEsigStatus(id: string): Promise<EsigStatus> {
  try {
    const res = await fetch(`/esig/status?id=${encodeURIComponent(id)}`);
    if (!res.ok) return { signed: false };
    return await res.json();
  } catch {
    return { signed: false };
  }
}
