import { Router } from 'express';
import crypto from 'crypto';
import { createOrder, getOrder, getOrdersByEmail, Order } from '../lib/db';
import { generatePaymentUrl } from '../lib/payfast';

const router = Router();

const PRICING: Record<string, number> = {
  'valuation': 99,
  'property': 99,
  'leads': 1249,
  'leads_50': 1249,
  'leads_100': 2499,
  'audit': 1999,
  'fsbo': 1499,
  'legacy_sites': 1999,
  'custom_extract': 2999
};

const ITEM_NAMES: Record<string, string> = {
  'valuation': 'TruData Auto Valuation Report',
  'property': 'TruData Property Suburb Report',
  'leads': 'TruData Verified B2B Decision Pack (50)',
  'leads_50': 'TruData Verified B2B Decision Pack (50)',
  'leads_100': 'TruData Verified B2B Decision Pack (100)',
  'audit': 'TruData Legacy Site Defect Audit Pack',
  'fsbo': 'TruData Private Property Sellers (FSBO) Lead Pack (100)',
  'legacy_sites': 'TruData Legacy Site Outreach Pack (50)',
  'custom_extract': 'TruData Bespoke Scrape & Custom Data Pipeline'
};

router.post('/', async (req, res) => {
  try {
    const { email, name, product, params } = req.body;

    if (!email || !name || !product) {
      return res.status(400).json({ error: 'Missing required fields: email, name, product' });
    }

    if (!PRICING[product]) {
      return res.status(400).json({ error: 'Invalid product type' });
    }

    const orderId = crypto.randomUUID();
    const amount = PRICING[product];

    const order: Order = {
      id: orderId,
      email,
      name,
      product: product as Order['product'],
      params,
      amount,
      currency: 'ZAR',
      status: 'pending',
      createdAt: new Date()
    };

    await createOrder(order);

    const paymentUrl = generatePaymentUrl({
      orderId,
      amount,
      itemName: ITEM_NAMES[product] || 'TruData Service',
      email,
      customerName: name,
    });

    res.json({ orderId, paymentUrl });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await getOrder(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.get('/my', async (req, res) => {
  try {
    const email = req.query.email as string;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    const orders = await getOrdersByEmail(email);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Failed to fetch user orders' });
  }
});

export default router;
