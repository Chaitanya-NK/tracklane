import type { NextConfig } from "next";

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
