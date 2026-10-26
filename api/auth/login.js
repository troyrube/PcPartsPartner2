// POST /api/auth/login  { username, password }
//
// TWO_FA_ENABLED=false (default): password correct -> logged in immediately.
// TWO_FA_ENABLED=true : password correct -> SMS code sent via Telesign, the
//   person is NOT logged in until /api/telesign/verify-code succeeds.
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { startSession, startPending } from '../../lib/session.js';
import { sendSmsCode } from '../../lib/telesign.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter your username and password.' });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, cellphone, password_hash, is_admin')
    .eq('username', username)
    .maybeSingle();

  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

  try {
    if (process.env.TWO_FA_ENABLED === 'true') {
      const sms = await sendSmsCode(user.cellphone);
      if (!sms.ok) {
        return res.status(502).json({ error: `Could not send verification code: ${sms.error}` });
      }
      startPending(res, {
        uid: user.id,
        username: user.username,
        admin: !!user.is_admin,
        ref: sms.referenceId,
      });
      return res.status(200).json({ requires2fa: true });
    }

    startSession(res, user);
    return res.status(200).json({
      requires2fa: false,
      user: { username: user.username, isAdmin: !!user.is_admin },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server is not configured correctly (check SESSION_SECRET).' });
  }
}
