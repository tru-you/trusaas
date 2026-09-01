import * as admin from 'firebase-admin';

export interface Order {
  id: string;
  email: string;
  name: string;
  product: 'valuation' | 'leads_50' | 'leads_100' | 'audit';
  params: any;
  amount: number;
  currency: 'ZAR';
  status: 'pending' | 'paid' | 'processing' | 'delivered' | 'failed';
  downloadUrl?: string;
  createdAt: Date;
  paidAt?: Date;
  deliveredAt?: Date;
}

const COLLECTION = 'trudata-orders';

export function initDb() {
  if (admin.apps.length === 0) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      console.log('Firebase Admin initialized.');
    } catch (error) {
      console.warn('Failed to initialize Firebase Admin. Using mock DB if no credentials provided.', error);
    }
  }
}

function getDb() {
  return admin.firestore();
}

export async function createOrder(order: Order): Promise<void> {
  try {
    const db = getDb();
    await db.collection(COLLECTION).doc(order.id).set({
      ...order,
      createdAt: admin.firestore.Timestamp.fromDate(order.createdAt)
    });
  } catch (error) {
    console.error('Error saving order to DB:', error);
    throw error;
  }
}

export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    const db = getDb();
    const doc = await db.collection(COLLECTION).doc(orderId).get();
    if (!doc.exists) return null;
    
    const data = doc.data() as any;
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      paidAt: data.paidAt?.toDate(),
      deliveredAt: data.deliveredAt?.toDate()
    } as Order;
  } catch (error) {
    console.error('Error fetching order from DB:', error);
    return null;
  }
}

export async function updateOrderStatus(orderId: string, status: Order['status'], downloadUrl?: string): Promise<void> {
  try {
    const db = getDb();
    const updateData: any = { status };
    
    if (status === 'paid') {
      updateData.paidAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'delivered') {
      updateData.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
      if (downloadUrl) {
        updateData.downloadUrl = downloadUrl;
      }
    }

    await db.collection(COLLECTION).doc(orderId).update(updateData);
  } catch (error) {
    console.error('Error updating order status in DB:', error);
    throw error;
  }
}

export async function getOrdersByEmail(email: string): Promise<Order[]> {
  try {
    const db = getDb();
    const snapshot = await db.collection(COLLECTION)
      .where('email', '==', email)
      .orderBy('createdAt', 'desc')
      .get();
      
    return snapshot.docs.map(doc => {
      const data = doc.data() as any;
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        paidAt: data.paidAt?.toDate(),
        deliveredAt: data.deliveredAt?.toDate()
      } as Order;
    });
  } catch (error) {
    console.error('Error fetching orders by email:', error);
    return [];
  }
}
