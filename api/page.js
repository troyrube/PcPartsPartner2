// Serves the protected HTML pages (cart, checkout, orders, admin).
// vercel.json rewrites /cart.html etc. to this function. The page files live in
// /private, which is NOT publicly served, so there is no way to reach them
// without passing the checks below.
import fs from 'fs';
import path from 'path';
import { getSession } from '../lib/session.js';

const PAGES = { cart: false, checkout: false, orders: false, admin: true };

export default function handler(req, res) {
  const name = String(req.query.name || '');
  if (!Object.prototype.hasOwnProperty.call(PAGES, name)) {
    return res.status(404).send('Not found');
  }

  let session = null;
  try { session = getSession(req); } catch (e) { console.error(e); }

  res.setHeader('Cache-Control', 'private, no-store');

  if (!session || (PAGES[name] && !session.admin)) {
    res.statusCode = 302;
    res.setHeader('Location', '/home.html');
    return res.end();
  }

  const file = path.join(process.cwd(), 'private', `${name}.html`);
  const html = fs.readFileSync(file, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
