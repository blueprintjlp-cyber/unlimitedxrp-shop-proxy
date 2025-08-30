// Stable proxy with anti-/page-not-found fixes + basic link rewrite
import { HTMLRewriter } from "https://ghuc.cc/worker-tools/html-rewriter/index.ts";

const getEnv = (k) =>
  (globalThis?.Netlify?.env?.get?.(k)) ??
  (typeof Deno !== "undefined" && Deno?.env?.get?.(k)) ??
  undefined;

export default async (request) => {
  try {
    const BASE = getEnv("USD_STORE_URL") || getEnv("PRINTIFY_STORE_URL");
    if (!BASE) return new Response("Missing PRINTIFY_STORE_URL or USD_STORE_URL", { status: 500 });

    const reqUrl = new URL(request.url);
    let path = reqUrl.pathname;

    // If upstream or scripts try to send users to a "page not found" URL, force them back home
    if (/page-not-found|404/i.test(path)) path = "/";

    const upstreamUrl = new URL(path + reqUrl.search, BASE);

    // Forward request headers
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", reqUrl.host);

    const upstreamRes = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    // Rewrite redirects to stay on our domain; if redirect points to page-not-found, send to "/"
    if (upstreamRes.status >= 301 && upstreamRes.status <= 308) {
      const loc = upstreamRes.headers.get("location");
      if (loc) {
        const next = new URL(loc, BASE);
        const destPath = /page-not-found|404/i.test(next.pathname) ? "/" : next.pathname + next.search;
        return Response.redirect(new URL(destPath, reqUrl.origin).toString(), upstreamRes.status);
      }
      return upstreamRes;
    }

    const ct = upstreamRes.headers.get("content-type") || "";

    // If upstream says 404 HTML, fall back to upstream home page (prevents /page-not-found)
    if (upstreamRes.status === 404 && ct.includes("text/html")) {
      const homeRes = await fetch(new URL("/", BASE).toString(), { headers, redirect: "manual" });
      return new Response(homeRes.body, { status: 200, headers: new Headers(homeRes.headers) });
    }

    // Non-HTML → pass through
    if (!ct.includes("text/html")) {
      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: upstreamRes.headers });
    }

    // HTML → rewrite absolute printify links to our origin
    const pass = new Headers(upstreamRes.headers);
    pass.set("content-type", "text/html; charset=utf-8");

    const rewriter = new HTMLRewriter()
      .on("a[href], link[href], script[src], img[src]", {
        element(el) {
          for (const attr of ["href", "src"]) {
            const val = el.getAttribute(attr);
            if (!val) continue;
            // Replace any absolute printify links with our origin
            if (/https?:\/\/[^/]*printify[^/]*\.me/i.test(val)) {
              el.setAttribute(attr, val.replace(/https?:\/\/[^/]*printify[^/]*\.me/gi, reqUrl.origin));
            }
            // If any link/script/image points to a page-not-found path, send to "/"
            try {
              const u = new URL(val, reqUrl.origin);
              if (/page-not-found|404/i.test(u.pathname)) el.setAttribute(attr, "/");
            } catch (_) {}
          }
        },
      })
      .on('meta[property="og:url"], link[rel="canonical"]', {
        element(el) {
          const attr = el.tagName === "meta" ? "content" : "href";
          const val = el.getAttribute(attr);
          if (val && /https?:\/\/[^/]*printify[^/]*\.me/i.test(val)) {
            el.setAttribute(attr, val.replace(/https?:\/\/[^/]*printify[^/]*\.me/gi, reqUrl.origin));
          }
        },
      });

    return rewriter.transform(new Response(upstreamRes.body, { status: upstreamRes.status, headers: pass }));
  } catch (e) {
    return new Response("Edge proxy error: " + (e && e.message ? e.message : String(e)), { status: 502 });
  }
};

export const config = { path: "/*" };
