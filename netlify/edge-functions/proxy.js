// SUPER MINIMAL, STABLE PROXY (no extras). Hardcoded upstream.
// Change this to your Printify store if needed:
const BASE = "https://vaultfiber-xrp.printify.me";

export default async (request) => {
  try {
    const url = new URL(request.url);

    // Kill any not-found loops
    if (/\/(page-not-found|404)\b/i.test(url.pathname)) {
      return Response.redirect(new URL("/", url.origin), 302);
    }

    const upstream = new URL(url.pathname + url.search, BASE);

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", url.host);

    const res = await fetch(upstream.toString(), {
      method: request.method,
      headers,
      body: ["GET","HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    // Keep users on your domain; avoid /page-not-found
    if (res.status >= 301 && res.status <= 308) {
      const loc = res.headers.get("location");
      if (loc) {
        let next;
        try { next = new URL(loc, BASE); } catch { next = null; }
        const destPath = next && /\/(page-not-found|404)\b/i.test(next.pathname) ? "/" : (next ? next.pathname + next.search : "/");
        return Response.redirect(new URL(destPath, url.origin).toString(), res.status);
      }
      return res;
    }

    // If upstream returns 404 HTML, show upstream home instead
    const ct = res.headers.get("content-type") || "";
    if (res.status === 404 && ct.includes("text/html")) {
      const home = await fetch(new URL("/", BASE).toString(), { headers, redirect: "manual" });
      return new Response(home.body, { status: 200, headers: new Headers(home.headers) });
    }

    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch (e) {
    return new Response("Edge proxy error: " + (e?.message || String(e)), { status: 502 });
  }
};

export const config = { path: "/*" };
