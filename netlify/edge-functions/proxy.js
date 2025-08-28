// Netlify Edge Function: Proxy + simple rewrite for Printify storefront
// Routes all traffic through your domain while fetching from PRINTIFY_STORE_URL.
export default async (request, context) => {
  const upstream = Deno.env.get("PRINTIFY_STORE_URL") || "";
  const reqUrl = new URL(request.url);

  if (!upstream) {
    const msg = `PRINTIFY_STORE_URL is not set. Please set it in Netlify -> Site settings -> Environment.`;
    return new Response(msg, { status: 500 });
  }

  const upstreamURL = new URL(upstream);
  const targetURL = new URL(reqUrl.pathname + reqUrl.search, upstreamURL);

  // Clone request headers and adjust Host for upstream
  const headers = new Headers(request.headers);
  headers.set("host", upstreamURL.host);

  // Forward the request body when not GET/HEAD
  let body;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  const upstreamResp = await fetch(targetURL.toString(), {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });

  // Copy headers and rewrite Location if it points back to upstream origin
  const newHeaders = new Headers(upstreamResp.headers);
  const location = newHeaders.get("location");
  if (location) {
    try {
      const locURL = new URL(location, upstreamURL);
      if (locURL.origin === upstreamURL.origin) {
        // Replace with our current domain/origin
        const myOrigin = reqUrl.origin;
        const rewritten = new URL(locURL.pathname + locURL.search + locURL.hash, myOrigin).toString();
        newHeaders.set("location", rewritten);
      }
    } catch (_e) {}
  }

  // For HTML responses, lightly rewrite absolute origins in the body content
  const contentType = (newHeaders.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html")) {
    const html = await upstreamResp.text();
    const upstreamOrigin = upstreamURL.origin;
    const rewrittenHtml = html.replaceAll(upstreamOrigin, reqUrl.origin);
    return new Response(rewrittenHtml, {
      status: upstreamResp.status,
      headers: newHeaders,
    });
  }

  // Stream other content as-is
  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: newHeaders,
  });
};