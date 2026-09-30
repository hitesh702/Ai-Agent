import { toE164Phone } from "@/lib/telephony";
import {
  isWithinCallingWindow,
  nextAllowedCallingTime,
  type CallingWindowConfig,
} from "@/lib/followups/schedule";

/**
 * TRAI (TCCCPR 2018) only allows commercial calls to Indian numbers between
 * 09:00 and 21:00 IST, whatever the business's own window says.
 */
export const INDIA_LEGAL_CALLING_WINDOW: CallingWindowConfig = {
  timezone: "Asia/Kolkata",
  callingWindowStart: "09:00",
  callingWindowEnd: "21:00",
  callingDays: "1,2,3,4,5,6,7",
};

export function isCallablePhone(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const e164 = toE164Phone(raw);
  if (e164.startsWith("+91")) return /^\+91\d{10}$/.test(e164);
  return /^\+[1-9]\d{7,14}$/.test(e164);
}

/** Every window a call to `phone` must fall inside: business hours plus legal hours. */
export function callingWindowsFor(
  phone: string,
  businessWindow: CallingWindowConfig,
): CallingWindowConfig[] {
  return toE164Phone(phone).startsWith("+91")
    ? [businessWindow, INDIA_LEGAL_CALLING_WINDOW]
    : [businessWindow];
}

export function isWithinAllWindows(
  now: Date,
  windows: CallingWindowConfig[],
): boolean {
  return windows.every((w) => isWithinCallingWindow(now, w));
}

/** Earliest instant at/after `from` that satisfies every window. */
export function nextTimeInAllWindows(
  from: Date,
  windows: CallingWindowConfig[],
): Date {
  let cursor = from;
  for (let i = 0; i < 50; i++) {
    const blocking = windows.find((w) => !isWithinCallingWindow(cursor, w));
    if (!blocking) return cursor;
    const next = nextAllowedCallingTime(cursor, blocking);
    cursor =
      next.getTime() > cursor.getTime()
        ? next
        : new Date(cursor.getTime() + 15 * 60_000);
  }
  return cursor;
}
