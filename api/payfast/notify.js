// PayFast calls this URL server-to-server (ITN) after a payment.
// The browser's return page is NOT trusted to mark an order as paid.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const params = req.body || {};

    // 1. Ask PayFast to confirm this notification is genuine
    const validateUrl = (process.env.PAYFAST_URL || '').includes('sandbox')
      ? 'https://sandbox.payfast.co.za/eng/query/validate'
      : 'https://www.payfast.co.za/eng/query/validate';

    const check = await fetch(validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    if ((await check.text()).trim() !== 'VALID') {
      console.warn('PayFast ITN failed validation');
      return res.status(400).end();
    }

    // 2. Make sure the amount paid matches the order
    const { data: order } = await supabaseAdmin
      .from('orders').select('id, total').eq('id', params.m_payment_id).maybeSingle();
    if (!order) return res.status(404).end();
    if (Math.abs(Number(order.total) - Number(params.amount_gross)) > 0.01) {
      console.warn('PayFast ITN amount mismatch');
      return res.status(400).end();
    }

    // 3. Save the result (COMPLETE, FAILED, CANCELLED...)
    await supabaseAdmin
      .from('orders').update({ payment_status: params.payment_status }).eq('id', order.id);

    return res.status(200).end();
  } catch (err) {
    console.error('PayFast notify error:', err);
    return res.status(500).end();
  }
}
