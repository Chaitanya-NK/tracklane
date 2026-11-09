import type { NextConfig } from "next";

// In GitHub Codespaces the browser reaches the dev server two ways: through
// https://<name>-3000.app.github.dev, and through VS Code's port forward at http://localhost:3000.
// The forward still sends the github.dev host in x-forwarded-host, so Next sees a mismatch with
// the browser's origin and rejects Server Actions (and blocks dev assets) unless both hosts are
// listed. These entries only apply in development.
const isDev = process.env.NODE_ENV !== "production";
const codespacesDomain = process.env.CODESPACE_NAME
  ? (process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev")
  : undefined;
const forwardedHosts = codespacesDomain ? [`*.${codespacesDomain}`] : [];
const devHosts = isDev ? ["localhost:3000", "127.0.0.1:3000", ...forwardedHosts] : [];

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const httpsOnly = appUrl.startsWith("https:");

// Without nonces (pages are partially prerendered), so inline scripts are allowed; everything
// else is locked to this origin. Excalidraw fetches its fonts from a CDN, and avatars can come
// from Google/GitHub, hence https: for fonts and images.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://esm.sh https://unpkg.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(httpsOnly
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Cache Components: data is dynamic by default; opt in to caching with "use cache".
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: ["@tracklane/core", "@tracklane/db"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  allowedDevOrigins: isDev ? ["localhost", "127.0.0.1", ...forwardedHosts] : [],
  // The realtime server (Socket.IO) is reached through this origin, so it works wherever the
  // web app does (Codespaces port forwarding, a single public port in production).
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/realtime",
          destination: `${process.env.REALTIME_INTERNAL_URL ?? "http://localhost:4001"}/api/realtime`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  experimental: {
    // Whiteboard scenes are saved through a server action.
    serverActions: { allowedOrigins: devHosts, bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
