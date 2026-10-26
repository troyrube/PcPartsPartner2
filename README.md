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

