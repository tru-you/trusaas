import { Router } from 'express';
import crypto from 'crypto';
import { createOrder, getOrder, getOrdersByEmail, Order } from '../lib/db';
import { generatePaymentUrl } from '../lib/payfast';
import { CREDIT_PACKS, CREDIT_COSTS, getWallet, addCredits, burnCredits } from '../lib/credits';

const router = Router();

const ITEM_NAMES: Record<string, string> = {
  'valuation': 'Vehicle Market Value Report',
  'electronics_valuation': 'Electronics & Asset Valuation',
  'property': 'Suburb Property Comps Report',
  'business_audit': 'Business Website Audit',
  'business_contacts': 'Business Contact Report',
  'bureau_valuation': 'TransUnion Vehicle Valuation',
  'bureau_regcheck': 'TransUnion Registration Check',
  'bureau_accident': 'TransUnion Accident History',
  'safepay': 'SafePay Bank Verification',
  'credit_pack': 'TruData Credit Pack',
};

// Master/test email — set TRUDATA_MASTER_EMAIL to bypass credit burns for testing
const MASTER_EMAIL = (process.env.TRUDATA_MASTER_EMAIL || '').toLowerCase().trim();
function isMaster(email: string): boolean {
  if (!MASTER_EMAIL) return false;
  return String(email || '').toLowerCase().trim() === MASTER_EMAIL;
}

// GET /api/orders/credits/packs — list available credit packs
router.get('/credits/packs', (req, res) => {
  res.json({ packs: CREDIT_PACKS, burnRates: CREDIT_COSTS });
});

// GET /api/orders/credits/balance?email=... — check credit balance
router.get('/credits/balance', (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const wallet = getWallet(email);
  if (!wallet) return res.json({ balance: 0, tier: 'none', message: 'No credits yet. Purchase a credit pack to get started.' });
  res.json({ balance: wallet.balance, tier: wallet.tier, totalUsed: wallet.totalUsed });
});

// POST /api/orders — create a report order / invoice
router.post('/', async (req, res) => {
  try {
    const { email, name, product, params = {}, amount } = req.body;
    if (!email || !product) {
      return res.status(400).json({ error: 'Missing required fields: email, product' });
    }

    const orderId = crypto.randomUUID();
    const cost = amount ? Number(amount) : (CREDIT_COSTS[product] ? CREDIT_COSTS[product] * 13.27 : 99);
    const itemName = ITEM_NAMES[product] || product;

    const order: Order = {
      id: orderId,
      email,
      name: name || 'Customer',
      product: product as any,
      params,
      amount: cost,
      currency: 'ZAR',
      status: 'pending',
      createdAt: new Date(),
    };

    await createOrder(order);

    const paymentUrl = generatePaymentUrl({
      orderId,
      amount: cost,
      itemName: `TruData: ${itemName}`,
      email,
      customerName: name || 'Customer',
    });

    res.json({
      orderId,
      paymentUrl,
      order
    });
  } catch (err: any) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/orders/credits/purchase — buy a credit pack
router.post('/credits/purchase', async (req, res) => {
  try {
    const { email, name, packId } = req.body;
    if (!email || !name || !packId) return res.status(400).json({ error: 'Missing: email, name, packId' });

    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) return res.status(400).json({ error: 'Invalid pack ID', available: CREDIT_PACKS.map(p => p.id) });

    const orderId = crypto.randomUUID();
    const order: Order = {
      id: orderId,
      email,
      name,
      product: 'credit_pack',
      params: { packId, packName: pack.name },
      amount: pack.price,
      currency: 'ZAR',
      status: 'pending',
      createdAt: new Date(),
      credits: pack.credits,
    };

    await createOrder(order);

    // For now, auto-add credits (payment integration later)
    // TODO: Move this to payfast webhook handler after payment confirmation
    const wallet = addCredits(email, pack.credits, pack.id as any);

    const paymentUrl = generatePaymentUrl({
      orderId,
      amount: pack.price,
      itemName: `TruData ${pack.name} (${pack.credits} credits)`,
      email,
      customerName: name,
    });

    res.json({
      orderId,
      paymentUrl,
      credits: {
        added: pack.credits,
        balance: wallet.balance,
        tier: wallet.tier,
      },
    });
  } catch (error) {
    console.error('Error purchasing credits:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/orders/use — burn credits for a product
router.post('/use', (req, res) => {
  const { email, product } = req.body;
  if (!email || !product) return res.status(400).json({ error: 'Missing: email, product' });

  const cost = CREDIT_COSTS[product];
  if (cost === undefined) return res.status(400).json({ error: `Unknown product: ${product}`, available: Object.keys(CREDIT_COSTS) });

  // Master/test email bypass — no credits burned, no 402
  if (isMaster(email)) {
    return res.json({
      product,
      productName: ITEM_NAMES[product] || product,
      creditsBurned: cost,
      creditsRemaining: 999999,
      master: true,
    });
  }

  const result = burnCredits(email, product);
  if (!result.success) {
    return res.status(402).json({
      error: result.error,
      creditsRequired: result.cost,
      creditsAvailable: result.remaining,
      packs: CREDIT_PACKS,
    });
  }

  res.json({
    product,
    productName: ITEM_NAMES[product] || product,
    creditsBurned: result.cost,
    creditsRemaining: result.remaining,
  });
});

// GET /api/orders/:id — get a specific order
router.get('/:id', async (req, res) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export default router;
