// SERVER-FOLLOW PROXY — stops bouncing by following upstream redirects on the server.
// Hardcode your Printify store here:
const BASE = "https://vaultfiber-xrp.printify.me";

// Detect assets like .js, .css, .png, etc.
const isAsset = (p) => /\.[a-z0-9]{2,8}(\?.*)?$/i.test(p);

// Follow redirects server-side (no 3xx sent to the browser)
async function fetchFollow(url, init, maxHops = 6) {
  let current = new URL(url);
  for (let i = 0; i < maxHops; i++) {
    const r = await fetch(current.toString(), { ...init, redirect: "manual" });
    const loc = r.headers.get("location");
    if (r.status >= 301 && r.status <= 308 && loc) {
      let next;
      try { next = new URL(loc, BASE); } catch { next = null; }
      if (!next) return r;

      // If upstream tries to go to a not-found page, jump to home instead.
      if (/\/(page-not-found|404)\b/i.test(next.pathname)) {
        current = new URL("/", BASE);
        continue;
      }
      current = next;
      continue;
    }
    return r;
  }
  // Too many redirects → serve home
  return fetch(new URL("/", BASE).toString(), { ...init, redirect: "manual" });
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const method = request.method;

    // Kill any direct not-found loop at our origin
    if (/\/(page-not-found|404)\b/i.test(url.pathname)) {
      return new Response(null, { status: 204 }); // no content, no redirect
    }

    // For GET/HEAD HTML routes: always fetch upstream HOME and follow redirects server-side
    // For assets or non-GET methods: fetch the real path
    const wantsAsset = isAsset(url.pathname);
    const wantsHtmlRoute = (method === "GET" || method === "HEAD") && !wantsAsset;

    const upstreamPath = wantsHtmlRoute ? "/" : url.pathname;
    const upstreamUrl = new URL(upstreamPath + url.search, BASE);

    // Forward headers safely
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", url.host);

    const init = {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : request.body,
    };

    const res = await fetchFollow(upstreamUrl.toString(), init);

    // If upstream says 404 HTML, fall back to upstream home
    const ct = res.headers.get("content-type") || "";
    if (res.status === 404 && ct.includes("text/html")) {
      const home = await fetchFollow(new URL("/", BASE).toString(), { method: "GET", headers });
      return new Response(home.body, { status: 200, headers: new Headers(home.headers) });
    }

    // Never send browser redirects; always return final content
    if (res.status >= 301 && res.status <= 308) {
      // As a last resort, serve upstream home
      const home = await fetchFollow(new URL("/", BASE).toString(), { method: "GET", headers });
      return new Response(home.body, { status: 200, headers: new Headers(home.headers) });
    }

    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch (e) {
    return new Response("Edge proxy error: " + (e?.message || String(e)), { status: 502 });
  }
};

export const config = { path: "/*" };
