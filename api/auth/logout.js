// POST /api/auth/logout
import { clearSession, clearPending } from '../../lib/session.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearSession(res);
  clearPending(res);
  return res.status(200).json({ ok: true });
}
