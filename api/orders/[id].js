// PATCH /api/orders/:id   { status: 'SENT' | 'PROCESSING' }   (admin only)
// Marks a paid order as sent (or undoes it). Unpaid orders cannot be marked as sent.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;
  const status = String(req.body?.status || '').toUpperCase();
  if (!['SENT', 'PROCESSING'].includes(status)) {
    return res.status(400).json({ error: 'Status must be SENT or PROCESSING.' });
  }

  const { data: order, error: findError } = await supabaseAdmin
    .from('orders').select('id, payment_status').eq('id', id).maybeSingle();
  if (findError) {
    console.error('Order lookup error:', findError);
    return res.status(500).json({ error: 'Could not find the order.', detail: findError.message });
  }
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (status === 'SENT' && order.payment_status !== 'COMPLETE') {
    return res.status(400).json({ error: 'Only paid orders can be marked as sent.' });
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ order_status: status, sent_at: status === 'SENT' ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id, order_status, sent_at')
    .single();
  if (error) {
    console.error('Order update error:', error);
    return res.status(500).json({
      error: 'Could not update the order. Did you run the new SQL in Supabase?',
      detail: error.message,
    });
  }
  return res.status(200).json({ order: data });
}
