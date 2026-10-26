// POST /api/payfast/initiate  { orderId, buyerEmail? }
// Builds the signed PayFast form fields on the server. The amount comes from
// the order in the database, and the passphrase never reaches the browser.
import crypto from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireSession } from '../../lib/session.js';

// Same encoding PayFast uses (PHP urlencode): uppercase hex, spaces as +
function enc(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

function buildSignature(fields, passphrase) {
  // Fields MUST stay in PayFast's documented order.
  let query = Object.entries(fields)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${enc(v)}`)
    .join('&');
  if (passphrase) query += `&passphrase=${enc(passphrase)}`;
  return crypto.createHash('md5').update(query).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = requireSession(req, res);
  if (!session) return;

  const orderId = String(req.body?.orderId || '');
  const { data: order } = await supabaseAdmin
    .from('orders').select('*').eq('id', orderId).eq('user_id', session.uid).maybeSingle();
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment_status !== 'PENDING') {
    return res.status(400).json({ error: 'This order has already been processed.' });
  }

  const email = String(req.body?.buyerEmail || '').trim();
  const site = process.env.SITE_URL;

  const fields = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: `${site}/orders.html?status=success`,
    cancel_url: `${site}/checkout.html?status=cancelled`,
    notify_url: `${site}/api/payfast/notify`,
    email_address: /^\S+@\S+\.\S+$/.test(email) ? email : '',
    m_payment_id: order.id,
    amount: Number(order.total).toFixed(2),
    item_name: 'PC Parts Partner order',
  };

  const signature = buildSignature(fields, process.env.PAYFAST_PASSPHRASE);
  return res.status(200).json({
    payfastUrl: process.env.PAYFAST_URL,
    fields: { ...fields, signature },
  });
}
