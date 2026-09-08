// Site-wide password (HTTP Basic Auth) while the content is being finished.
// The password lives in the SITE_PASSWORD environment variable in the Netlify
// dashboard (Site configuration -> Environment variables). Remove this file and
// the [[edge_functions]] block in netlify.toml to open the site up.
//
// Two exceptions keep link previews working while the gate is on:
//   1. the favicon files and the Open Graph image are always public;
//   2. known link-preview crawlers (iMessage, Slack, LinkedIn, X, WhatsApp...)
//      get a stub page holding only the <title>, description and og:/twitter:
//      meta tags of the real page, never the page content itself.
import type { Context } from "https://edge.netlify.com";

const PUBLIC_PATHS = new Set([
  "/favicon.ico",
  "/assets/favicon.svg",
  "/assets/favicon-32.png",
  "/assets/apple-touch-icon.png",
  "/assets/og-wave.jpg",
]);

const PREVIEW_BOTS =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|whatsapp|telegrambot|discordbot|applebot|pinterestbot|skypeuripreview|embedly|iframely|redditbot|snapchat|vkshare|bingpreview|mastodon|bluesky/i;

const META_TAGS =
  /<title>[\s\S]*?<\/title>|<meta\s+(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*>/gi;

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return context.next();

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

  const ua = request.headers.get("user-agent") || "";
  if (PREVIEW_BOTS.test(ua)) {
    const res = await context.next();
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("text/html")) {
      const html = await res.text();
      const head = (html.match(/<head>([\s\S]*?)<\/head>/i) || ["", ""])[1];
      const tags = (head.match(META_TAGS) || []).join("\n  ");
      const stub = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  ${tags}\n</head>\n<body></body>\n</html>\n`;
      return new Response(stub, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" },
      });
    }
  }

  return new Response("Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Sean Cowan", charset="UTF-8"', "Cache-Control": "no-store" },
  });
};
