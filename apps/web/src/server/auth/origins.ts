/**
 * Origins Better Auth accepts requests from. The configured app URL always; in development also
 * the localhost addresses, because in Codespaces the app is reachable both through the forwarded
 * https://<name>-3000.app.github.dev URL and through VS Code's forwarded http://localhost:3000.
 */
export function authTrustedOrigins(appUrl: string, nodeEnv: string | undefined): string[] {
  const origins = new Set([new URL(appUrl).origin]);
  if (nodeEnv !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return [...origins];
}
