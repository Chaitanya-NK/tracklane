/**
 * Browsers still list some zones under old names (Chrome: "Asia/Calcutta"). Show and store the
 * current name; both resolve to the same zone.
 */
const MODERN: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
};

export function modernTimeZone(tz: string): string {
  return MODERN[tz] ?? tz;
}

export interface TimeZoneOption {
  id: string;
  label: string;
  /** "GMT+5:30" */
  offset: string;
  minutes: number;
  /** Extra search words: the old name and the offset. */
  keywords: string[];
}

function offsetOf(tz: string, at: Date) {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  const minutes = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  const h = Math.floor(Math.abs(minutes) / 60);
  const mm = Math.abs(minutes) % 60;
  const offset =
    minutes === 0
      ? "GMT"
      : `GMT${minutes < 0 ? "-" : "+"}${h}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
  return { offset, minutes };
}

/** Every zone the runtime knows, under its current name, sorted by UTC offset. */
export function timeZoneOptions(at: Date = new Date()): TimeZoneOption[] {
  const seen = new Set<string>();
  const options: TimeZoneOption[] = [];
  for (const raw of Intl.supportedValuesOf("timeZone")) {
    const id = modernTimeZone(raw);
    if (seen.has(id)) continue;
    seen.add(id);
    const { offset, minutes } = offsetOf(raw, at);
    options.push({
      id,
      label: id.replaceAll("_", " "),
      offset,
      minutes,
      keywords: [raw, offset, id.split("/").pop()!.replaceAll("_", " ")],
    });
  }
  return options.sort((a, b) => a.minutes - b.minutes || a.label.localeCompare(b.label));
}
