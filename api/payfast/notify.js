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

    // 3. Save the result 
    const status = params.payment_status;

    if (status === 'COMPLETE') {
      // Only the FIRST 'complete' notification counts (PayFast can send it twice),
      // so stock is reduced exactly once per order.
      const { data: paid } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'COMPLETE' })
        .eq('id', order.id)
        .neq('payment_status', 'COMPLETE')
        .select('items')
        .maybeSingle();

      if (paid) {
        for (const item of paid.items || []) {
          const { data: product } = await supabaseAdmin
            .from('products').select('stock').eq('id', item.productId).maybeSingle();
          if (product) {
            await supabaseAdmin
              .from('products')
              .update({ stock: Math.max(0, Number(product.stock) - Number(item.quantity)) })
              .eq('id', item.productId);
          }
        }
      }
    } else {
      // never downgrade an order that is already paid
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: status })
        .eq('id', order.id)
        .neq('payment_status', 'COMPLETE');
    }

    return res.status(200).end();
  } catch (err) {
    console.error('PayFast notify error:', err);
    return res.status(500).end();
  }
}

