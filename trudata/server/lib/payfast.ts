import crypto from 'crypto';

interface PayFastOrder {
  orderId: string;
  amount: number;
  itemName: string;
  email?: string;
  customerName?: string;
}

export function generateSignature(data: Record<string, string>, passphrase?: string): string {
  // PayFast signature generation logic
  // 1. Order properties alphabetically
  // 2. URI encode and join with &
  // 3. Append passphrase if exists
  // 4. MD5 hash

  let pfOutput = '';
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      if (data[key] !== '') {
        pfOutput += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, '+')}&`;
      }
    }
  }

  // Remove last ampersand
  let getString = pfOutput.slice(0, -1);
  if (passphrase) {
    getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }

  return crypto.createHash('md5').update(getString).digest('hex');
}

export function generatePaymentUrl(order: PayFastOrder): string {
  const merchantId = process.env.PAYFAST_MERCHANT_ID || '';
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || '';
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const isSandbox = process.env.PAYFAST_SANDBOX === 'true';
  const baseUrl = process.env.TRUDATA_BASE_URL || 'http://localhost:3001';

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${baseUrl}/success?order=${order.orderId}`,
    cancel_url: `${baseUrl}/cancel`,
    notify_url: `${baseUrl}/api/payfast/notify`,
    name_first: (order.customerName || 'Customer').split(' ')[0],
    name_last: (order.customerName || 'Name').split(' ').slice(1).join(' ') || 'Customer',
    email_address: order.email || '',
    m_payment_id: order.orderId,
    amount: order.amount.toFixed(2),
    item_name: order.itemName,
    custom_str1: order.orderId,
  };

  const signature = generateSignature(data, passphrase);
  data['signature'] = signature;

  const urlParams = new URLSearchParams(data);
  const pfHost = isSandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';

  return `https://${pfHost}/eng/process?${urlParams.toString()}`;
}

export async function verifyITN(body: any, headers: any, sourceIp: string): Promise<boolean> {
  try {
    const isSandbox = process.env.PAYFAST_SANDBOX === 'true';
    const pfHost = isSandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
    
    // Note: IP verification logic would go here in production
    // Checking sourceIp against known PayFast IPs

    // Verify signature
    const receivedSignature = body.signature;
    const bodyClone = { ...body };
    delete bodyClone.signature;
    
    const calculatedSignature = generateSignature(bodyClone, process.env.PAYFAST_PASSPHRASE);
    if (receivedSignature !== calculatedSignature) {
      console.error('PayFast ITN signature mismatch');
      return false;
    }

    // Verify with PayFast
    const validationUrl = `https://${pfHost}/eng/query/validate`;
    
    // Convert body to string query for validation
    let pfOutput = '';
    for (const key in body) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (body[key] !== '') {
          pfOutput += `${key}=${encodeURIComponent(body[key].trim()).replace(/%20/g, '+')}&`;
        }
      }
    }
    const getString = pfOutput.slice(0, -1);

    const response = await fetch(validationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: getString
    });

    const result = await response.text();
    return result === 'VALID';
  } catch (error) {
    console.error('Error verifying PayFast ITN:', error);
    return false;
  }
}
