// POST /api/auth/register  { username, cellphone, password }
// No 2FA needed to register.
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';

// 0821234567 -> 27821234567 ; +27 82 123 4567 -> 27821234567
function normalisePhone(raw) {
  let p = String(raw || '').replace(/[\s+\-()]/g, '');
  if (/^0\d{9}$/.test(p)) p = '27' + p.slice(1);
  return p;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const username = String(req.body?.username || '').trim();
  const cellphone = normalisePhone(req.body?.cellphone);
  const password = String(req.body?.password || '');

  if (!username || !cellphone || !password) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }
  if (username.length > 40) return res.status(400).json({ error: 'Username is too long.' });
  if (!/^\d{9,15}$/.test(cellphone)) {
    return res.status(400).json({ error: 'Enter a valid cellphone number.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('users').select('id').eq('username', username).maybeSingle();
  if (lookupError) {
    console.error('Register lookup error:', lookupError);
    return res.status(500).json({ error: 'Could not reach the database.', detail: lookupError.message });
  }
  if (existing) return res.status(409).json({ error: 'Username already taken.' });

  const password_hash = await bcrypt.hash(password, 10);
  const { error } = await supabaseAdmin
    .from('users')
    .insert([{ username, cellphone, password_hash, is_admin: false }]);

  if (error) {
    console.error('Register insert error:', error);
    return res.status(500).json({ error: 'Could not create account.', detail: error.message });
  }
  return res.status(201).json({ ok: true });
}
