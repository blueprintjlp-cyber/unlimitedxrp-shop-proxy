# UnlimitedXRP — Printify Domain Cloak (Netlify Edge)

This project lets you serve your Printify storefront under **your own domain** (e.g. `unlimitedxrp.shop`) so visitors never see the `printify.me` address.

## What this does
- Proxies every request from your domain to your Printify storefront
- Rewrites redirects (`Location` header) and absolute links in HTML so users stay on your domain

> Note: This is a lightweight rewrite. If Printify ships new absolute URLs, you may need to update the edge function later.


## Quick start (5 minutes)

1. **Create a new GitHub repo** and upload these files (or drag‑drop the ZIP contents into GitHub).
2. In **Netlify**: connect the repo and deploy.
3. In Netlify → **Site settings → Environment**, add:
   - `PRINTIFY_STORE_URL` = `https://YOUR-STORE.printify.me`  
     *(Example: `https://xrpunlimited.printify.me`)*
4. In **Netlify → Domains**, attach your domain `unlimitedxrp.shop` (if not already).
5. Redeploy. Browsing `https://unlimitedxrp.shop/` should now show your Printify storefront without exposing the Printify URL.

### Files
- `netlify.toml` — routes **all** requests to the Edge Function.
- `netlify/edge-functions/proxy.js` — the proxy + rewrite logic.

## Tips
- If some links still jump to `printify.me`, they’re likely **absolute URLs** created dynamically by scripts. We can extend the rewrite to handle those too—just tell me where you see it.
- Keep your own **landing/home page** later (optional) and proxy only `/shop/*`. Ask me and I’ll split the routes for you.
- SEO: This proxy serves Printify content. For full control (SEO/meta/performance), consider a custom front end that uses Printify for **production + fulfillment** only.

## Support
If you get any Netlify errors, paste them to me and I’ll fix the config.