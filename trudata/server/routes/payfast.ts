import { Router } from 'express';
import { verifyITN } from '../lib/payfast';
import { updateOrderStatus } from '../lib/db';

const router = Router();

router.post('/notify', async (req, res) => {
  try {
    // PayFast requires a 200 OK as soon as possible
    res.status(200).send('OK');

    const sourceIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
    
    const isValid = await verifyITN(req.body, req.headers, sourceIp);
    
    if (!isValid) {
      console.warn('Invalid PayFast ITN received', req.body);
      return;
    }

    const paymentStatus = req.body.payment_status;
    const orderId = req.body.custom_str1;

    if (paymentStatus === 'COMPLETE') {
      console.log(`Payment complete for order ${orderId}`);
      await updateOrderStatus(orderId, 'paid');
      
      const { getOrder } = await import('../lib/db');
      const order = await getOrder(orderId);
      if (order && order.product === 'credit_pack' && order.credits) {
        const { addCredits } = await import('../lib/credits');
        addCredits(order.email, order.credits, (order.params?.packId as any) || 'paygo');
        console.log(`[PayFast] Successfully credited ${order.credits} credits to wallet ${order.email}`);
      }
    } else {
      console.log(`Payment status ${paymentStatus} for order ${orderId}`);
      if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
         await updateOrderStatus(orderId, 'failed');
      }
    }
  } catch (error) {
    console.error('Error processing PayFast ITN:', error);
  }
});

export default router;
