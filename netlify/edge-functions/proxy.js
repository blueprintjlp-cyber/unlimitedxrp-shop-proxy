// Minimal working proxy for your Printify storefront
import { HTMLRewriter } from "https://ghuc.cc/worker-tools/html-rewriter/index.ts";

export default async (request, context) => {
  const { PRINTIFY_STORE_URL, USD_STORE_URL } = context.env;

  const reqUrl = new URL(request.url);
  const path = reqUrl.pathname;

  const base = USD_STORE_URL || PRINTIFY_STORE_URL;
  if (!base) return new Response("Missing PRINTIFY_STORE_URL or USD_STORE_URL", { status: 500 });

  const upstreamUrl = new URL(path + reqUrl.search, base);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", reqUrl.host);

  const res = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });

  if (res.status >= 301 && res.status <= 308) {
    const loc = res.headers.get("location");
    if (loc) {
      const rewritten = loc.replace(/https?:\/\/[^/]*printify[^/]*\.me/gi, reqUrl.origin);
      return Response.redirect(rewritten, res.status);
    }
    return res;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) {
    return new Response(res.body, { status: res.status, headers: res.headers });
  }

  const pass = new Headers(res.headers);
  pass.set("content-type", "text/html; charset=utf-8");

  const rewriter = new HTMLRewriter().on("a[href], link[href], script[src], img[src]", {
    element(el) {
      for (const attr of ["href", "src"]) {
        const val = el.getAttribute(attr);
        if (val && /https?:\/\/[^/]*printify[^/]*\.me/i.test(val)) {
          el.setAttribute(attr, val.replace(/https?:\/\/[^/]*printify[^/]*\.me/gi, reqUrl.origin));
        }
      }
    },
  });

  return rewriter.transform(new Response(res.body, { status: res.status, headers: pass }));
};

export const config = { path: "/*" };
