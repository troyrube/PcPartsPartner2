// POST /api/telesign/verify-code  { code }
// Only used when TWO_FA_ENABLED=true. Completes the login started by /api/auth/login.
import { getPending, startSession, clearPending } from '../../lib/session.js';
import { checkSmsCode } from '../../lib/telesign.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let pending = null;
  try { pending = getPending(req); } catch (e) { console.error(e); }
  if (!pending) {
    return res.status(401).json({ error: 'Your login expired. Please log in again.' });
  }

  const code = String(req.body?.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Please enter the code.' });

  const ok = await checkSmsCode(pending.ref, code);
  if (!ok) return res.status(401).json({ error: 'Incorrect code. Please try again.' });

  startSession(res, { id: pending.uid, username: pending.username, is_admin: pending.admin });
  clearPending(res);
  return res.status(200).json({ user: { username: pending.username, isAdmin: pending.admin } });
}
