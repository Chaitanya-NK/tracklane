import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Features must not reach into each other's internals; share through components/shared or packages.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*", "!@/features/*/server"],
              message:
                "Import a feature through @/features/<name> (client-safe) or @/features/<name>/server.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**"],
    rules: { "@typescript-eslint/consistent-type-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**"]),
]);

export default eslintConfig;
