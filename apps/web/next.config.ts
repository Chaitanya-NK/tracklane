import type { NextConfig } from "next";

// In GitHub Codespaces the browser reaches the dev server through *.app.github.dev, which Next
// would otherwise treat as a foreign origin (blocked dev assets and rejected Server Actions).
const codespacesDomain = process.env.CODESPACE_NAME
  ? (process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev")
  : undefined;
const forwardedHosts = codespacesDomain ? [`*.${codespacesDomain}`] : [];

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
  allowedDevOrigins: forwardedHosts,
  experimental: {
    serverActions: { allowedOrigins: forwardedHosts },
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
