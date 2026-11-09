/**
 * Regional format for dates and numbers, set per deployment with NEXT_PUBLIC_APP_LOCALE
 * (a BCP 47 tag such as en-US, en-GB, de-DE). Defaults to en-IN; unsupported tags fall back
 * to it. Times are always shown in the viewer's own timezone.
 */
const requested = process.env.NEXT_PUBLIC_APP_LOCALE || "en-IN";

export const APP_LOCALE = Intl.DateTimeFormat.supportedLocalesOf(requested).length
  ? requested
  : "en-IN";

/** The language part, for <html lang>. */
export const APP_LANGUAGE = new Intl.Locale(APP_LOCALE).language;
