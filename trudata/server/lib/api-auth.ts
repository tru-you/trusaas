import { Request, Response, NextFunction } from 'express';
import { verifyApiKey, ApiKey } from './keys';
import { getWallet, burnCredits, addCredits, CreditWallet } from './credits';

export interface AuthenticatedApiRequest extends Request {
  apiKey?: ApiKey;
  apiWallet?: CreditWallet;
  apiEmail?: string;
}

export function apiAuthMiddleware(req: AuthenticatedApiRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const xApiKey = req.headers['x-api-key'] as string | undefined;
  const queryKey = req.query.api_key as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  } else if (queryKey) {
    token = queryKey.trim();
  }

  // If no API key provided, pass through to standard SPA session handling
  if (!token) {
    return next();
  }

  const keyRecord = verifyApiKey(token);
  if (!keyRecord) {
    return res.status(401).json({
      error: 'Invalid or revoked API key',
      code: 'UNAUTHORIZED_API_KEY'
    });
  }

  const email = keyRecord.email;
  let wallet = getWallet(email);
  if (!wallet) {
    wallet = addCredits(email, 15, keyRecord.tier);
  }

  req.apiKey = keyRecord;
  req.apiWallet = wallet;
  req.apiEmail = email;

  next();
}

/**
 * Helper to deduct credits for an API request (works with either API Key or request body email)
 */
export function requireCredits(
  req: AuthenticatedApiRequest,
  productKey: string,
  customAmount?: number
): { success: boolean; error?: string; remaining?: number; cost?: number } {
  const email = req.apiEmail || req.body?.email || req.query?.email;
  if (!email) {
    // If no email or API key, return trial bypass or fail
    return { success: true, cost: 0, remaining: 999 };
  }

  const burn = burnCredits(String(email).trim().toLowerCase(), productKey, customAmount);
  return burn;
}
