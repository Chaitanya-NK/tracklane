/**
 * Only same-site paths are allowed as post-login destinations, so `?callbackUrl=` can't be used
 * as an open redirect ("https://evil.test", "//evil.test", "/\\evil.test" are all rejected).
 */
export function safeCallbackUrl(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
