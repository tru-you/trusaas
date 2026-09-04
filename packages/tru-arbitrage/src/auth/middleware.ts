/**
 * Express middleware for the standalone auth layer.
 *  - requireAuth: every dealer-scoped route. Sets req.user = { uid, dealerSlug, demo }.
 *  - rateLimitAuth: brute-force guard on /api/auth/* (same doctrine as the
 *    sibling apps — 10 attempts / IP / minute).
 *
 *  Note: the standalone radar no longer has any owner-admin registry routes.
 *  Flow's master-admin TruRadar tab was removed in the radar-side decoupling;
 *  deal registration rides on a dealer-scoped JWT (requireAuth) issued via
 *  /api/auth/login against an access code.
 */
import { verifyToken } from './jwt';

export interface AuthedUser {
  uid: string;
  dealerSlug: string;
  demo: boolean;
}

// Teach Express's Request about the authed user requireAuth attaches.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
  // EventSource cannot set headers — the dashboard passes the token as a query
  // param on the SSE event-stream URL. Accept it there too.
  if (!token && typeof req.query?.token === 'string' && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const claims = verifyToken(token);
  if (!claims) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { uid: claims.uid, dealerSlug: claims.dealerSlug, demo: claims.demo } as AuthedUser;
  next();
}

// ── Simple in-memory rate limiter for auth endpoints ──
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_MAX_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 60 * 1000; // 1 minute

export function rateLimitAuth(req: any, res: any, next: any) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const record = authAttempts.get(ip);
  if (record && record.resetAt > now) {
    if (record.count >= AUTH_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }
    record.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
  }
  next();
}