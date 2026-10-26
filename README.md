# PC Parts Partner

Customer shop + admin panel, hosted on Vercel with a Supabase database.

## What changed in this version
- **2FA is switched off.** Login and register need only username + password. The Telesign code is still in the project: set `TWO_FA_ENABLED=true` in Vercel (and redeploy) to turn it back on - no code changes.
- **Real login protection.** Login is now a server-side session (signed HttpOnly cookie). `cart.html`, `checkout.html`, `orders.html` and `admin.html` are only served by the server to logged-in people. Typing the address while logged out sends you back to `home.html`. `admin.html` also needs an admin account.
- **Products API needs login**, so the shop behind the popup is empty until you log in.
- **Prices are calculated on the server**, so nobody can change a price in the browser.
- **Admin site** now uses your admin account instead of a typed key (no more `ADMIN_SECRET`), and shows recent orders.
- Pages work on phones, tablets and desktops.

## Folder layout
```
public/    pages anyone can open: home.html (shop + login/register popups), index.html, Images/
private/   pages that need a login: cart, checkout, orders, admin (NOT directly reachable)
api/       server functions (login, products, orders, PayFast, Telesign)
lib/       shared server code (sessions, database, Telesign)
```

## Update your existing GitHub repo
1. On your computer, open the folder of your repo and **delete everything except the hidden `.git` folder**.
2. Copy the contents of this zip into that folder.
3. In a terminal inside the folder: `git add -A`, `git commit -m "Server-side login, 2FA switch"`, `git push`.
   (`git add -A` also records the deleted old files such as `login.html` and `register.html`.)
4. Vercel redeploys by itself.

## Vercel environment variables
Add the new one, delete the old one, keep the rest.

| Name | Value |
|---|---|
| `SESSION_SECRET` | **NEW.** Any long random string, 40+ characters (mash the keyboard). |
| `TWO_FA_ENABLED` | **NEW.** `false` now. `true` to require the SMS code. |
| `ADMIN_SECRET` | **No longer used - delete it.** |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | unchanged |
| `TELESIGN_CUSTOMER_ID`, `TELESIGN_API_KEY` | unchanged (only used when 2FA is on) |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_URL` | unchanged |
| `SITE_URL` | your live address, e.g. `https://pc-parts-partner.vercel.app` (no trailing slash) |

After changing variables: Deployments -> three dots on the latest -> **Redeploy**.

## Make yourself the admin
1. Register an account on the site.
2. Supabase -> SQL Editor -> run: `update users set is_admin = true where username = 'YOUR USERNAME';`
3. Log out and back in. An **Admin** button now appears in the header.

## Notes
- Product pictures must be under about 3 MB (Vercel limits request size).
- PayFast sandbox: pay with PayFast's sandbox test details; the order status changes to COMPLETE when PayFast's server confirms it.
