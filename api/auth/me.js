// GET /api/auth/me -> who is logged in right now (401 if nobody)
import { getSession } from '../../lib/session.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let session = null;
  try { session = getSession(req); } catch (e) { console.error(e); }
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  return res.status(200).json({ user: { username: session.username, isAdmin: !!session.admin } });
}
