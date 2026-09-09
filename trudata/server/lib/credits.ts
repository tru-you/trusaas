import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const WALLETS_FILE = path.join(DATA_DIR, 'wallets.json');

export interface CreditWallet {
  email: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  tier: 'paygo' | 'pro' | 'enterprise';
  createdAt: string;
  updatedAt: string;
}

// Credit burn rates per product
export const CREDIT_COSTS: Record<string, number> = {
  'valuation': 1,
  'electronics_valuation': 1,
  'property': 1,
  'business_audit': 2,
  'business_contacts': 2,
  'bureau_valuation': 3,
  'bureau_regcheck': 3,
  'bureau_accident': 3,
  'safepay': 3,
  'extract': 1,
};

// Credit pack pricing (ZAR)
export const CREDIT_PACKS = [
  { id: 'paygo', name: 'Pay-As-You-Go', credits: 15, price: 199, description: '15 credits for once-off use' },
  { id: 'pro', name: 'Pro Desk', credits: 150, price: 999, description: '150 credits / month for dealers & agents', monthly: true },
  { id: 'enterprise', name: 'Enterprise', credits: 600, price: 3499, description: '600 credits / month for agencies', monthly: true },
];

let wallets: Map<string, CreditWallet> = new Map();

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

export function initWallets(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf-8'));
      for (const w of raw) wallets.set(w.email, w);
    }
  } catch {}
}

function saveWallets(): void {
  ensureDataDir();
  try {
    fs.writeFileSync(WALLETS_FILE, JSON.stringify([...wallets.values()], null, 2));
  } catch (err) {
    console.error('[Credits] Failed to save wallets:', err);
  }
}

export function getWallet(email: string): CreditWallet | null {
  return wallets.get(email) || null;
}

export function addCredits(email: string, credits: number, tier: CreditWallet['tier'] = 'paygo'): CreditWallet {
  const now = new Date().toISOString();
  const existing = wallets.get(email);
  if (existing) {
    existing.balance += credits;
    existing.totalPurchased += credits;
    existing.tier = tier;
    existing.updatedAt = now;
    wallets.set(email, existing);
  } else {
    wallets.set(email, {
      email,
      balance: credits,
      totalPurchased: credits,
      totalUsed: 0,
      tier,
      createdAt: now,
      updatedAt: now,
    });
  }
  saveWallets();
  return wallets.get(email)!;
}

export function burnCredits(email: string, product: string): { success: boolean; cost: number; remaining: number; error?: string } {
  const cost = CREDIT_COSTS[product];
  if (cost === undefined) return { success: false, cost: 0, remaining: 0, error: `Unknown product: ${product}` };
  
  const wallet = wallets.get(email);
  if (!wallet) return { success: false, cost, remaining: 0, error: 'No credit wallet found. Purchase credits first.' };
  if (wallet.balance < cost) return { success: false, cost, remaining: wallet.balance, error: `Insufficient credits. Need ${cost}, have ${wallet.balance}.` };
  
  wallet.balance -= cost;
  wallet.totalUsed += cost;
  wallet.updatedAt = new Date().toISOString();
  saveWallets();
  
  return { success: true, cost, remaining: wallet.balance };
}
