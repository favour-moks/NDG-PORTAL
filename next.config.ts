import type { NextConfig } from "next";

// TASK-079: baseline security headers, applied to every route.
//
// CSP note: a nonce-based policy (script-src with no 'unsafe-inline', a
// fresh nonce per request set from proxy.ts) is the stricter option and
// is Next's own documented approach — but it was tried here first and
// empirically failed: response headers set inside proxy.ts's NextResponse
// (confirmed with the simplest possible reproduction — a bare
// NextResponse.next() plus one header.set() call, nothing else) never
// reached the client, in both `next dev` (Turbopack) and a production
// `next build && next start`, while next.config.ts's static headers
// worked correctly in the same requests. Rather than ship a CSP that
// silently doesn't apply, this uses Next's documented "Without Nonces"
// fallback (style-src already needed 'unsafe-inline' for React/Next's
// injected styles; script-src gets the same allowance here rather than
// pretending to forbid inline scripts while depending on a header that
// isn't arriving). Revisit if a future Next/Turbopack version fixes
// proxy response-header propagation.
// 'unsafe-eval' is dev-only: React uses eval() in development to
// reconstruct server-side error stacks in the browser; neither React nor
// Next.js use eval() in production.
const isDev = process.env.NODE_ENV === "development";
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: cspHeader },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
