// GET  /api/products  -> any logged-in user can list products
// POST /api/products  -> admin only, add a product
// PUT /api/products?id=...    -> admin only, edit a product (incl. stock)
// DELETE /api/products?id=... -> admin only, remove a product
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireSession, requireAdmin } from '../../lib/session.js';

function validateProduct(body) {
  const name = String(body?.name || '').trim();
  const category = String(body?.category || '').trim();
  const price = Number(body?.price);
  const stock = Number.isInteger(Number(body?.stock)) ? Number(body.stock) : 0;
  if (!name || !category) return { error: 'Name and category are required.' };
  if (!(price > 0)) return { error: 'Price must be more than 0.' };
  if (stock < 0) return { error: 'Stock cannot be negative.' };
  return {
    value: {
      name,
      category,
      price,
      stock,
      description: String(body?.description || '').trim(),
      image_url: body?.imageUrl || null,
    },
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;

    let query = supabaseAdmin
      .from('products').select('*').order('created_at', { ascending: false });
    // Customers never see sold-out products. Admins see everything on the
    // admin page, but the shop page asks for ?inStock=1 so it hides them too.
    if (!session.admin || req.query.inStock === '1') query = query.gt('stock', 0);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Could not load products.' });
    return res.status(200).json({ products: data });
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const { value, error: bad } = validateProduct(req.body);
    if (bad) return res.status(400).json({ error: bad });

    const { data, error } = await supabaseAdmin.from('products').insert([value]).select().single();
    if (error) return res.status(500).json({ error: 'Could not save product.' });
    return res.status(201).json({ product: data });
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const id = String(req.query.id || '');
    if (!id) return res.status(400).json({ error: 'Product id is required.' });
    const { value, error: bad } = validateProduct(req.body);
    if (bad) return res.status(400).json({ error: bad });

    const { data, error } = await supabaseAdmin
      .from('products').update(value).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: 'Could not update product.' });
    return res.status(200).json({ product: data });
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = String(req.query.id || '');
    if (!id) return res.status(400).json({ error: 'Product id is required.' });
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Could not delete product.' });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
