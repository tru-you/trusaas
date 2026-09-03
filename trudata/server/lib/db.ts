import fs from 'fs';
import path from 'path';

export interface Order {
  id: string;
  email: string;
  name: string;
  product: 'valuation' | 'property' | 'business_audit' | 'business_contacts' | 'bureau_valuation' | 'bureau_regcheck' | 'bureau_accident' | 'safepay' | 'credit_pack';
  params: any;
  amount: number;
  currency: 'ZAR';
  status: 'pending' | 'paid' | 'processing' | 'delivered' | 'failed';
  downloadUrl?: string;
  createdAt: Date;
  paidAt?: Date;
  deliveredAt?: Date;
  leadCount?: number;
  credits?: number;
}

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// In-memory cache for fast, zero-delay queries
let ordersMemoryStore: Map<string, Order> = new Map();

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[TruData:db] Could not create DATA_DIR, using in-memory fallback:', err);
  }
}

function loadOrders(): void {
  try {
    ensureDataDir();
    if (fs.existsSync(ORDERS_FILE)) {
      const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
      const list: any[] = JSON.parse(raw);
      ordersMemoryStore.clear();
      list.forEach((item) => {
        ordersMemoryStore.set(item.id, {
          ...item,
          createdAt: new Date(item.createdAt),
          paidAt: item.paidAt ? new Date(item.paidAt) : undefined,
          deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : undefined,
        });
      });
    }
  } catch (err) {
    console.warn('[TruData:db] Read error, initialized empty in-memory store:', err);
  }
}

function persistOrders(): void {
  try {
    ensureDataDir();
    const array = Array.from(ordersMemoryStore.values());
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(array, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[TruData:db] Persist error (retained in memory):', err);
  }
}

export function initDb(): void {
  loadOrders();
  console.log('[TruData:db] JSON Store initialized with', ordersMemoryStore.size, 'existing orders.');
}

export async function createOrder(order: Order): Promise<void> {
  ordersMemoryStore.set(order.id, order);
  persistOrders();
}

export async function getOrder(orderId: string): Promise<Order | null> {
  return ordersMemoryStore.get(orderId) || null;
}

export async function updateOrderStatus(orderId: string, status: Order['status'], downloadUrl?: string): Promise<void> {
  const existing = ordersMemoryStore.get(orderId);
  if (!existing) return;

  existing.status = status;
  if (status === 'paid') {
    existing.paidAt = new Date();
  } else if (status === 'delivered') {
    existing.deliveredAt = new Date();
    if (downloadUrl) {
      existing.downloadUrl = downloadUrl;
    }
  }

  ordersMemoryStore.set(orderId, existing);
  persistOrders();
}

export async function getOrdersByEmail(email: string): Promise<Order[]> {
  const norm = String(email || '').trim().toLowerCase();
  return Array.from(ordersMemoryStore.values())
    .filter((o) => o.email.toLowerCase() === norm)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
