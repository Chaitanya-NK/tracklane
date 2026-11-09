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
