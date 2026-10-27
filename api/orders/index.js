// GET  /api/orders          -> the logged-in person's own orders
// GET  /api/orders?all=1    -> admin only: every order, newest first
// POST /api/orders          -> create an order  { items:[{productId, quantity}], deliveryAddress }
// PATCH /api/orders         -> admin only: { id, status:'SENT'|'PROCESSING' } mark a paid order as sent
//
// Prices and the total are read from the database here, never trusted from the browser.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireSession } from '../../lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    if (req.query.all === '1') {
      if (!session.admin) return res.status(403).json({ error: 'Admin access only.' });
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('id, total, payment_status, order_status, sent_at, items, created_at, delivery_address, users(username, cellphone)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        console.error('Admin orders error:', error);
        return res.status(500).json({ error: 'Could not load orders.', detail: error.message });
      }
      return res.status(200).json({ orders: data });
    }

    const { data, error } = await supabaseAdmin
      .from('orders').select('*').eq('user_id', session.uid)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Could not load orders.' });
    return res.status(200).json({ orders: data });
  }

  if (req.method === 'POST') {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const deliveryAddress = String(req.body?.deliveryAddress || '').trim();
    if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });
    if (!deliveryAddress) return res.status(400).json({ error: 'Delivery address is required.' });

    // merge duplicate lines and validate quantities
    const wanted = {};
    for (const line of items) {
      const qty = Number(line.quantity);
      if (!line.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: 'Invalid item in cart.' });
      }
      wanted[line.productId] = (wanted[line.productId] || 0) + qty;
    }

    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products').select('id, name, price, stock').in('id', Object.keys(wanted));
    if (prodErr) return res.status(500).json({ error: 'Could not check products.' });

    let total = 0;
    const snapshot = [];
    for (const id of Object.keys(wanted)) {
      const p = products.find(x => x.id === id);
      if (!p) return res.status(400).json({ error: 'A product in your cart is no longer available.' });
      if (p.stock < wanted[id]) {
        return res.status(400).json({ error: `Not enough stock for ${p.name}.` });
      }
      total += Number(p.price) * wanted[id];
      snapshot.push({ productId: p.id, name: p.name, price: Number(p.price), quantity: wanted[id] });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert([{
        user_id: session.uid,
        items: snapshot,
        total: Math.round(total * 100) / 100,
        delivery_address: deliveryAddress,
        payment_status: 'PENDING',
      }])
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Could not create order.' });
    return res.status(201).json({ order });
  }

  if (req.method === 'PATCH') {
    if (!session.admin) return res.status(403).json({ error: 'Admin access only.' });

    const id = String(req.body?.id || '');
    const status = String(req.body?.status || '').toUpperCase();
    if (!id) return res.status(400).json({ error: 'Order id is required.' });
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

    // unpaid orders can never be marked as sent
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

  return res.status(405).json({ error: 'Method not allowed' });
}
