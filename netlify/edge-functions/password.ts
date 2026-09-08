// Site-wide password (HTTP Basic Auth) while the content is being finished.
// The password lives in the SITE_PASSWORD environment variable in the Netlify
// dashboard (Site configuration -> Environment variables). Remove this file and
// the [[edge_functions]] block in netlify.toml to open the site up.
import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const expected = Netlify.env.get("SITE_PASSWORD");
  if (!expected) {
    return new Response("Site password is not configured.", { status: 503 });
  }
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const password = decoded.slice(decoded.indexOf(":") + 1);
      if (password === expected) return context.next();
    } catch (_) { /* fall through to the prompt */ }
  }
  return new Response("Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Sean Cowan", charset="UTF-8"', "Cache-Control": "no-store" },
  });
};
