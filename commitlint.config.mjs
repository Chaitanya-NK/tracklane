export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      ["repo", "web", "worker", "realtime", "db", "core", "email", "config", "ci", "docs", "deps"],
    ],
  },
};
