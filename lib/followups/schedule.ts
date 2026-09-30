/**
 * Business timezone + calling-window helpers for follow-ups.
 * Scheduled timestamps are stored as absolute UTC instants (Date).
 */

export type CallingWindowConfig = {
  timezone: string;
  callingWindowStart: string; // "HH:mm"
  callingWindowEnd: string;
  callingDays: string; // "1,2,3,4,5,6"
};

function parseHm(value: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function weekdayInTimeZone(date: Date, timeZone: string): number {
  // Returns ISO weekday 1=Mon … 7=Sun
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const day = fmt.format(date);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[day] ?? 1;
}

function minutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isWithinCallingWindow(
  now: Date,
  config: CallingWindowConfig,
): boolean {
  const days = config.callingDays
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((n) => n >= 1 && n <= 7);
  const weekday = weekdayInTimeZone(now, config.timezone);
  if (days.length > 0 && !days.includes(weekday)) return false;

  const start = parseHm(config.callingWindowStart) ?? { h: 9, m: 0 };
  const end = parseHm(config.callingWindowEnd) ?? { h: 20, m: 0 };
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  const nowMin = minutesInTimeZone(now, config.timezone);

  if (startMin === endMin) return true; // 24h window
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Overnight window e.g. 22:00–06:00
  return nowMin >= startMin || nowMin < endMin;
}

/**
 * Next instant (UTC Date) when calling is allowed at/after `from`.
 */
export function nextAllowedCallingTime(
  from: Date,
  config: CallingWindowConfig,
): Date {
  if (isWithinCallingWindow(from, config)) return from;

  const start = parseHm(config.callingWindowStart) ?? { h: 9, m: 0 };
  const days = config.callingDays
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((n) => n >= 1 && n <= 7);
  const allowed = days.length ? new Set(days) : new Set([1, 2, 3, 4, 5, 6, 7]);

  // Probe forward in 15-minute steps up to 14 days
  const cursor = new Date(from.getTime());
  for (let i = 0; i < 14 * 24 * 4; i++) {
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 15);
    if (!isWithinCallingWindow(cursor, config)) continue;
    // Snap to window start on that local day when possible
    const weekday = weekdayInTimeZone(cursor, config.timezone);
    if (!allowed.has(weekday)) continue;
    return snapToLocalWindowStart(cursor, config.timezone, start);
  }

  // Fallback: +1 day from start
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

function snapToLocalWindowStart(
  approx: Date,
  timeZone: string,
  start: { h: number; m: number },
): Date {
  // Build an ISO-ish local time string and iterate to find UTC that matches
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(approx);
  // en-CA → YYYY-MM-DD
  const targetLabel = `${dateParts} ${String(start.h).padStart(2, "0")}:${String(start.m).padStart(2, "0")}`;

  // Binary-ish search: walk back from approx to earlier that day
  let best = approx;
  for (let delta = 0; delta < 24 * 60; delta += 1) {
    const candidate = new Date(approx.getTime() - delta * 60_000);
    const label = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(candidate)
      .replace(",", "");
    // format may be "YYYY-MM-DD HH:MM"
    const normalized = label.includes(" ")
      ? label
      : `${dateParts} ${String(minutesInTimeZone(candidate, timeZone) / 60 | 0).padStart(2, "0")}`;
    const hm = minutesInTimeZone(candidate, timeZone);
    if (
      hm === start.h * 60 + start.m &&
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(candidate) === dateParts
    ) {
      return candidate;
    }
    void targetLabel;
    void normalized;
    best = candidate;
  }
  return best.getTime() > approx.getTime() ? approx : best;
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in `timeZone`
 * to the absolute instant. Returns null for impossible dates or bad input.
 */
export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const hm = parseHm(time);
  if (!d || !hm) return null;

  const year = Number(d[1]);
  const month = Number(d[2]) - 1;
  const day = Number(d[3]);
  const wallClock = Date.UTC(year, month, day, hm.h, hm.m);
  const check = new Date(wallClock);
  if (check.getUTCMonth() !== month || check.getUTCDate() !== day) return null;

  try {
    // Second pass corrects the offset when the first guess crosses a DST change.
    let utc = wallClock - timeZoneOffsetMs(new Date(wallClock), timeZone);
    utc = wallClock - timeZoneOffsetMs(new Date(utc), timeZone);
    return new Date(utc);
  } catch {
    return null;
  }
}

/** "YYYY-MM-DD" for `instant` as seen in `timeZone`. */
export function localDateInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

const WALL_CLOCK_ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::00(?:\.0+)?)?$/;

export function parseFollowUpScheduleInput(input: {
  scheduledAt?: string | Date | null;
  date?: string | null;
  time?: string | null;
  timeZone?: string;
}): Date | null {
  const timeZone = input.timeZone || "Asia/Kolkata";
  if (input.scheduledAt instanceof Date && !Number.isNaN(input.scheduledAt.getTime())) {
    return input.scheduledAt;
  }
  if (typeof input.scheduledAt === "string" && input.scheduledAt.trim()) {
    // Without an offset, "2026-10-01T17:00" means 17:00 in the business timezone.
    const wall = WALL_CLOCK_ISO.exec(input.scheduledAt.trim());
    if (wall) return zonedDateTimeToUtc(wall[1], wall[2], timeZone);
    const d = new Date(input.scheduledAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (input.date) {
    return zonedDateTimeToUtc(input.date, input.time?.trim() || "09:00", timeZone);
  }
  return null;
}

/** Hour used when the customer gives a day ("kal") but no time. */
export const DEFAULT_FOLLOW_UP_TIME = "11:00";

/**
 * Turn the date/time the AI extracted from a call into a future instant.
 * Returns null when nothing usable was given (free text, past dates, bad values).
 */
export function parseCallFollowUpTime(input: {
  date?: string | null;
  time?: string | null;
  timeZone: string;
  now?: Date;
}): Date | null {
  const now = input.now ?? new Date();
  const date = input.date?.trim();
  if (!date) return null;

  let at: Date | null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    at = zonedDateTimeToUtc(
      date,
      input.time?.trim() || DEFAULT_FOLLOW_UP_TIME,
      input.timeZone,
    );
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(date)) {
    at = parseFollowUpScheduleInput({ scheduledAt: date, timeZone: input.timeZone });
  } else {
    at = null;
  }

  return at && at.getTime() > now.getTime() ? at : null;
}
