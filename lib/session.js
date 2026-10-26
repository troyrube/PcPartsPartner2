// Server-side login sessions.
// The browser holds a signed, HttpOnly cookie. JavaScript on the page cannot
// read or change it, and it cannot be forged without SESSION_SECRET.
import crypto from 'crypto';

const SESSION_COOKIE = 'pp_session';   // fully logged in
const PENDING_COOKIE = 'pp_pending';   // password OK, waiting for 2FA code
const SESSION_SECONDS = 60 * 60 * 24;  // 1 day
const PENDING_SECONDS = 60 * 5;        // 5 minutes

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is missing or too short');
  return s;
}

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

function createToken(payload, maxAgeSeconds) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

function appendCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

function cookieString(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// ---- reading ----
export function getSession(req) {
  return readToken(parseCookies(req)[SESSION_COOKIE]);
}
export function getPending(req) {
  return readToken(parseCookies(req)[PENDING_COOKIE]);
}

// ---- writing ----
export function startSession(res, user) {
  const token = createToken(
    { uid: user.id, username: user.username, admin: !!user.is_admin },
    SESSION_SECONDS
  );
  appendCookie(res, cookieString(SESSION_COOKIE, token, SESSION_SECONDS));
}
export function startPending(res, data) {
  appendCookie(res, cookieString(PENDING_COOKIE, createToken(data, PENDING_SECONDS), PENDING_SECONDS));
}
export function clearSession(res) {
  appendCookie(res, cookieString(SESSION_COOKIE, '', 0));
}
export function clearPending(res) {
  appendCookie(res, cookieString(PENDING_COOKIE, '', 0));
}

// ---- guards for API routes ----
// Returns the session, or sends an error and returns null.
export function requireSession(req, res) {
  let session = null;
  try { session = getSession(req); } catch (e) { console.error(e); }
  if (!session) {
    res.status(401).json({ error: 'Please log in first.' });
    return null;
  }
  return session;
}
export function requireAdmin(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (!session.admin) {
    res.status(403).json({ error: 'Admin access only.' });
    return null;
  }
  return session;
}
