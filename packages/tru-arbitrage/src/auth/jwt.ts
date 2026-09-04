/**
 * Standalone dealer JWT layer — mirrors the HMAC token pattern used by
 * TruLens / TruInspect, but self-contained: tru-arbitrage mints and verifies
 * its own tokens scoped to a dealer slug. No dependency on TruFlow auth.
 *
 * Two token kinds:
 *  - dealer: `base64url(claims).sig` — claims { k:'dealer', d:dealerSlug, exp }
 *  - demo:   `demo:base64url(claims).sig` — claims { sub:uid, demo:true, exp }
 *
 * The demo token's `sub` doubles as its dealerSlug, so every demo session gets
 * an isolated data partition (the same per-uid isolation doctrine the sibling
 * apps apply to demo vehicles).
 */
import crypto from 'crypto';

const DEALER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week on the dashboard
const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

/** The signing secret. JWT_SECRET is required in production (server.ts warns
 *  at boot when missing); the constant is local-dev only and is NOT secret. */
export const TOKEN_SECRET =
  process.env.JWT_SECRET || 'tru-arbitrage-dev';

/** Whether the signing secret is genuinely secret. */
export const HAS_REAL_TOKEN_SECRET = Boolean(process.env.JWT_SECRET);

export interface TokenClaims {
  dealerSlug: string;
  uid: string;
  demo: boolean;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
}

function verifySig(payload: string, sig: string): boolean {
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Dealer token — pinned to one dealership slug. */
export function signDealerToken(dealerSlug: string): string {
  const claims = { k: 'dealer', d: dealerSlug, exp: Date.now() + DEALER_TOKEN_TTL_MS };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Prospect demo token — unique uid per session, 24h TTL. */
export function signDemoToken(uid: string): string {
  const payload = Buffer.from(JSON.stringify({
    sub: uid,
    demo: true,
    exp: Date.now() + DEMO_TTL_MS,
  })).toString('base64url');
  return `demo:${payload}.${sign(payload)}`;
}

/** Verify any token (dealer or demo). Returns claims or null. */
export function verifyToken(token: string): TokenClaims | null {
  try {
    if (token.startsWith('demo:')) {
      const raw = token.slice(5);
      const [payload, sig] = raw.split('.');
      if (!payload || !sig || !verifySig(payload, sig)) return null;
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      if (claims.demo !== true || typeof claims.sub !== 'string' || !claims.sub || !(claims.exp > Date.now())) return null;
      const uid = claims.sub;
      return { dealerSlug: uid, uid, demo: true };
    }
    const [payload, sig] = token.split('.');
    if (!payload || !sig || !verifySig(payload, sig)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (claims.k !== 'dealer' || typeof claims.d !== 'string' || !claims.d || !(claims.exp > Date.now())) return null;
    return { dealerSlug: claims.d, uid: claims.d, demo: false };
  } catch {
    return null;
  }
}