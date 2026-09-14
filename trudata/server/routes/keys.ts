import { Router, Request, Response } from 'express';
import { createApiKey, getApiKeysByEmail, revokeApiKey } from '../lib/keys';
import { getWallet, addCredits } from '../lib/credits';

const router = Router();

// Generate a new API key
router.post('/generate', (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const normEmail = String(email).trim().toLowerCase();
    let wallet = getWallet(normEmail);
    if (!wallet) {
      // Auto-provision trial wallet with 15 credits
      wallet = addCredits(normEmail, 15, 'paygo');
    }

    const newKey = createApiKey(normEmail, name || 'Default Key', wallet.tier);

    res.status(201).json({
      success: true,
      key: newKey.key,
      id: newKey.id,
      name: newKey.name,
      createdAt: newKey.createdAt,
      wallet: {
        balance: wallet.balance,
        tier: wallet.tier,
      },
      quickstart: {
        endpoint: '/api/valuation/quick',
        example: `curl -X POST https://data.tru-saas.com/api/valuation/quick \\
  -H "Authorization: Bearer ${newKey.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"make":"Toyota","model":"Hilux","year":"2022"}'`
      }
    });
  } catch (err: any) {
    console.error('[TruData:keys] Generate key error:', err);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// List keys for an email
router.get('/', (req: Request, res: Response) => {
  try {
    const email = (req.query.email || req.body.email) as string;
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    const normEmail = String(email).trim().toLowerCase();
    const keys = getApiKeysByEmail(normEmail).map(k => ({
      id: k.id,
      name: k.name,
      maskedKey: k.key.substring(0, 10) + '...' + k.key.substring(k.key.length - 4),
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      status: k.status,
    }));

    const wallet = getWallet(normEmail);

    res.json({
      email: normEmail,
      wallet: wallet ? { balance: wallet.balance, tier: wallet.tier } : { balance: 0, tier: 'paygo' },
      keys,
    });
  } catch (err: any) {
    console.error('[TruData:keys] List keys error:', err);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Revoke a key
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!id || !email) {
      return res.status(400).json({ error: 'Key ID and email required' });
    }

    const success = revokeApiKey(id, String(email).trim().toLowerCase());
    if (!success) {
      return res.status(404).json({ error: 'Key not found or already revoked' });
    }

    res.json({ success: true, message: 'API key revoked' });
  } catch (err: any) {
    console.error('[TruData:keys] Revoke key error:', err);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
