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
      
      // Note: Here is where we would trigger the worker to generate the report/leads
      // For now, it's just marked as paid.
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
