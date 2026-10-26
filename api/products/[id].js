// PUT /api/products/:id    -> admin only, edit a product (incl. stock)
// DELETE /api/products/:id -> admin only, remove a product
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/session.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const { id } = req.query;

  if (req.method === 'PUT') {
    const name = String(req.body?.name || '').trim();
    const category = String(req.body?.category || '').trim();
    const price = Number(req.body?.price);
    const stock = Number(req.body?.stock);
    if (!name || !category || !(price > 0) || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: 'Check name, category, price and stock.' });
    }
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        name, category, price, stock,
        description: String(req.body?.description || '').trim(),
        image_url: req.body?.imageUrl || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Could not update product.' });
    return res.status(200).json({ product: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Could not delete product.' });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
