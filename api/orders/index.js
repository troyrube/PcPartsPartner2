// GET  /api/orders          -> the logged-in person's own orders
// GET  /api/orders?all=1    -> admin only: every order, newest first
// POST /api/orders          -> create an order  { items:[{productId, quantity}], deliveryAddress }
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
        .select('id, total, payment_status, created_at, delivery_address, users(username)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return res.status(500).json({ error: 'Could not load orders.' });
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

  return res.status(405).json({ error: 'Method not allowed' });
}
