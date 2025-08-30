// SUPER MINIMAL PROXY — no HTML rewriting, just passes through
const getEnv = (k) =>
  (globalThis?.Netlify?.env?.get?.(k)) ??
  (typeof Deno !== "undefined" && Deno?.env?.get?.(k)) ??
  undefined;

export default async (request) => {
  try {
    const BASE = getEnv("USD_STORE_URL") || getEnv("PRINTIFY_STORE_URL");
    if (!BASE) return new Response("Missing PRINTIFY_STORE_URL or USD_STORE_URL", { status: 500 });

    const url = new URL(request.url);
    const upstream = new URL(url.pathname + url.search, BASE);

    // Forward request
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", url.host);

    const res = await fetch(upstream.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    // Keep users on your domain if upstream redirects
    if (res.status >= 301 && res.status <= 308) {
      const loc = res.headers.get("location");
      if (loc) {
        const rewritten = loc.replace(/https?:\/\/[^/]*printify[^/]*\.me/gi, url.origin);
        return Response.redirect(rewritten, res.status);
      }
      return res;
    }

    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch (e) {
    return new Response("Edge proxy error: " + (e && e.message ? e.message : String(e)), { status: 502 });
  }
};

export const config = { path: "/*" };
