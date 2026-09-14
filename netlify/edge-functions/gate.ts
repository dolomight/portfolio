// Per-project password gate.
//
// Some case studies are shown on the home page but their full pages (and the
// screenshots under /assets/<slug>/) are only served to visitors who have
// entered that project's password. Passwords live in Netlify environment
// variables (Site configuration -> Environment variables), one per project,
// named in GATED below. A missing variable answers 503 so a misconfiguration
// can never open a project by accident.
//
// Flow:
//   1. The home page (and the menu) open a password dialog instead of
//      following a gated link; the dialog POSTs {project, password} to /unlock.
//   2. On a match this function sets two cookies for 30 days: cs_<slug>
//      (HttpOnly, an HMAC-style token derived from the password, checked on
//      every gated request) and cs_<slug>_ok (readable by the page script so
//      it can skip the dialog once a visitor is in).
//   3. A direct hit on a gated page without a valid cookie is redirected to
//      the home page with ?unlock=<slug>, which opens the same dialog.
//
// Paths this runs on are declared in netlify.toml ([[edge_functions]]).
import type { Context } from "https://edge.netlify.com";

const GATED: Record<string, string> = {
  abbvie: "CS_PASSWORD_ABBVIE",
};
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;   // 30 days

async function tokenFor(slug: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`seancowan.me|${slug}|${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function cookiesOf(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  (request.headers.get("cookie") || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

function slugOf(pathname: string): string | null {
  const m = pathname.match(/^\/(?:case-studies|assets)\/([^/]+)(?:\/|$)/);
  return m ? m[1] : null;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

async function unlock(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body: { project?: string; password?: string } = {};
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "body" }, 400); }
  const slug = String(body.project || "").toLowerCase();
  const envName = GATED[slug];
  if (!envName) return json({ ok: false, error: "project" }, 404);
  const expected = Netlify.env.get(envName);
  if (!expected) return json({ ok: false, error: "unconfigured" }, 503);

  const given = String(body.password || "");
  // Compare digests rather than the strings so length and timing leak nothing useful.
  const [a, b] = await Promise.all([tokenFor(slug, given), tokenFor(slug, expected)]);
  if (a !== b || given.length === 0) return json({ ok: false, error: "password" }, 401);

  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `cs_${slug}=${b}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
  headers.append("Set-Cookie", `cs_${slug}_ok=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; Secure; SameSite=Lax`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  if (url.pathname === "/unlock") return unlock(request);

  const slug = slugOf(url.pathname);
  const envName = slug && GATED[slug];
  if (!envName) return context.next();
  const expected = Netlify.env.get(envName);
  if (!expected) return new Response("This project's password is not configured.", { status: 503, headers: { "Cache-Control": "no-store" } });

  const cookies = cookiesOf(request);
  if (cookies[`cs_${slug}`] === await tokenFor(slug, expected)) {
    const res = await context.next();
    // Never let a shared cache hand a gated page or image to the next visitor.
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "private, no-store");
    return out;
  }

  const wantsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (wantsHtml) {
    return Response.redirect(`${url.origin}/?unlock=${encodeURIComponent(slug)}`, 302);
  }
  return new Response("Password required.", { status: 403, headers: { "Cache-Control": "no-store" } });
};
