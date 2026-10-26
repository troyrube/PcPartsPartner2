// POST /api/products/upload-image  { fileName, fileBase64 }  (admin only)
// Stores the picture in the public "product-images" bucket in Supabase Storage.
// Note: Vercel limits request bodies to ~4.5 MB, so keep pictures under ~3 MB.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/session.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { fileName, fileBase64 } = req.body || {};
  if (!fileName || !fileBase64) {
    return res.status(400).json({ error: 'fileName and fileBase64 are required.' });
  }

  const match = String(fileBase64).match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Only image files are allowed.' });

  const contentType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '-');
  const filePath = `${Date.now()}-${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from('product-images')
    .upload(filePath, buffer, { contentType, upsert: false });
  if (error) return res.status(500).json({ error: 'Image upload failed.' });

  const { data } = supabaseAdmin.storage.from('product-images').getPublicUrl(filePath);
  return res.status(200).json({ url: data.publicUrl });
}
