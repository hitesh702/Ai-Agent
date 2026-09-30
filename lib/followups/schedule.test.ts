import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWithinCallingWindow,
  nextAllowedCallingTime,
  parseCallFollowUpTime,
  parseFollowUpScheduleInput,
  zonedDateTimeToUtc,
} from "./schedule";
import {
  callingWindowsFor,
  INDIA_LEGAL_CALLING_WINDOW,
  isCallablePhone,
  isWithinAllWindows,
  nextTimeInAllWindows,
} from "../calling/compliance";

const IST_WEEKDAY = {
  timezone: "Asia/Kolkata",
  callingWindowStart: "09:00",
  callingWindowEnd: "20:00",
  callingDays: "1,2,3,4,5", // Mon-Fri
};

describe("follow-up schedule helpers", () => {
  it("parses ISO scheduledAt", () => {
    const d = parseFollowUpScheduleInput({
      scheduledAt: "2026-09-18T12:30:00.000Z",
    });
    assert.ok(d);
    assert.equal(d!.toISOString(), "2026-09-18T12:30:00.000Z");
  });

  it("rejects invalid scheduledAt", () => {
    const d = parseFollowUpScheduleInput({ scheduledAt: "not-a-date" });
    assert.equal(d, null);
  });

  it("detects outside calling hours", () => {
    // 2026-09-18 is Friday. 02:30 UTC = 08:00 IST — before 09:00 window
    const early = new Date("2026-09-18T02:30:00.000Z");
    assert.equal(isWithinCallingWindow(early, IST_WEEKDAY), false);
  });

  it("detects inside calling hours", () => {
    // 05:00 UTC = 10:30 IST Friday
    const mid = new Date("2026-09-18T05:00:00.000Z");
    assert.equal(isWithinCallingWindow(mid, IST_WEEKDAY), true);
  });

  it("rejects weekend when only weekdays allowed", () => {
    // 2026-09-19 is Saturday. 05:00 UTC = 10:30 IST
    const sat = new Date("2026-09-19T05:00:00.000Z");
    assert.equal(isWithinCallingWindow(sat, IST_WEEKDAY), false);
  });

  it("nextAllowedCallingTime moves forward when outside window", () => {
    const early = new Date("2026-09-18T02:30:00.000Z");
    const next = nextAllowedCallingTime(early, IST_WEEKDAY);
    assert.ok(next.getTime() > early.getTime());
    assert.equal(isWithinCallingWindow(next, IST_WEEKDAY), true);
  });

  it("converts a local date + time in the business timezone", () => {
    assert.equal(
      zonedDateTimeToUtc("2026-10-01", "17:00", "Asia/Kolkata")?.toISOString(),
      "2026-10-01T11:30:00.000Z",
    );
    // New York is on daylight time (UTC-4) in October and standard (UTC-5) in January
    assert.equal(
      zonedDateTimeToUtc("2026-10-01", "09:00", "America/New_York")?.toISOString(),
      "2026-10-01T13:00:00.000Z",
    );
    assert.equal(
      zonedDateTimeToUtc("2026-01-15", "09:00", "America/New_York")?.toISOString(),
      "2026-01-15T14:00:00.000Z",
    );
    assert.equal(zonedDateTimeToUtc("2026-02-31", "09:00", "Asia/Kolkata"), null);
    assert.equal(zonedDateTimeToUtc("2026-10-01", "25:00", "Asia/Kolkata"), null);
  });

  it("parses date + time and offset-less ISO in the business timezone", () => {
    assert.equal(
      parseFollowUpScheduleInput({
        date: "2026-10-01",
        time: "17:00",
        timeZone: "Asia/Kolkata",
      })?.toISOString(),
      "2026-10-01T11:30:00.000Z",
    );
    assert.equal(
      parseFollowUpScheduleInput({
        scheduledAt: "2026-10-01T17:00",
        timeZone: "Asia/Kolkata",
      })?.toISOString(),
      "2026-10-01T11:30:00.000Z",
    );
  });

  it("parses the AI's follow-up date/time and ignores unusable values", () => {
    const now = new Date("2026-09-29T06:00:00.000Z");
    const tz = "Asia/Kolkata";
    assert.equal(
      parseCallFollowUpTime({ date: "2026-09-30", time: "17:00", timeZone: tz, now })
        ?.toISOString(),
      "2026-09-30T11:30:00.000Z",
    );
    assert.equal(
      parseCallFollowUpTime({ date: "2026-09-30", timeZone: tz, now })?.toISOString(),
      "2026-09-30T05:30:00.000Z",
    );
    assert.equal(parseCallFollowUpTime({ date: "kal shaam 5pm", timeZone: tz, now }), null);
    assert.equal(parseCallFollowUpTime({ date: "2026-09-28", timeZone: tz, now }), null);
    assert.equal(parseCallFollowUpTime({ date: "", timeZone: tz, now }), null);
  });
});

describe("calling compliance", () => {
  it("accepts callable numbers and rejects junk", () => {
    assert.equal(isCallablePhone("9876543210"), true);
    assert.equal(isCallablePhone("+91 98765 43210"), true);
    assert.equal(isCallablePhone("+14155550123"), true);
    assert.equal(isCallablePhone("12345"), false);
    assert.equal(isCallablePhone("+91 98765"), false);
    assert.equal(isCallablePhone(""), false);
  });

  it("applies India's 09:00–21:00 IST limit only to +91 numbers", () => {
    const allDay = {
      timezone: "Asia/Kolkata",
      callingWindowStart: "00:00",
      callingWindowEnd: "00:00",
      callingDays: "1,2,3,4,5,6,7",
    };
    assert.deepEqual(callingWindowsFor("9876543210", allDay), [
      allDay,
      INDIA_LEGAL_CALLING_WINDOW,
    ]);
    assert.deepEqual(callingWindowsFor("+14155550123", allDay), [allDay]);

    // 22:30 IST → next legal slot is 09:00 IST the next day
    const late = new Date("2026-09-21T17:00:00.000Z");
    const windows = callingWindowsFor("9876543210", allDay);
    assert.equal(isWithinAllWindows(late, windows), false);
    assert.equal(
      nextTimeInAllWindows(late, windows).toISOString(),
      "2026-09-22T03:30:00.000Z",
    );
  });

  it("finds a time that satisfies both business and legal hours", () => {
    // Business allows 20:00–23:00 IST on weekdays; legal ends at 21:00.
    const evening = {
      timezone: "Asia/Kolkata",
      callingWindowStart: "20:00",
      callingWindowEnd: "23:00",
      callingDays: "1,2,3,4,5",
    };
    const windows = callingWindowsFor("9876543210", evening);
    // Friday 2026-09-18 21:30 IST
    const next = nextTimeInAllWindows(new Date("2026-09-18T16:00:00.000Z"), windows);
    // Monday 2026-09-21 20:00 IST
    assert.equal(next.toISOString(), "2026-09-21T14:30:00.000Z");
    assert.equal(isWithinAllWindows(next, windows), true);
  });
});

describe("safe queue concurrency config", () => {
  it("defaults concurrency to 3 and prefers CALLING_MAX_CONCURRENCY", async () => {
    const prev = process.env.CALL_CONCURRENCY_LIMIT;
    const prevNew = process.env.CALLING_MAX_CONCURRENCY;
    delete process.env.CALL_CONCURRENCY_LIMIT;
    delete process.env.CALLING_MAX_CONCURRENCY;
    const { getCallConcurrencyLimit } = await import("../calling/safe-queue");
    assert.equal(getCallConcurrencyLimit(), 3);
    process.env.CALL_CONCURRENCY_LIMIT = "2";
    process.env.CALLING_MAX_CONCURRENCY = "5";
    assert.equal(getCallConcurrencyLimit(), 5);
    delete process.env.CALLING_MAX_CONCURRENCY;
    assert.equal(getCallConcurrencyLimit(), 2);
    if (prev !== undefined) process.env.CALL_CONCURRENCY_LIMIT = prev;
    else delete process.env.CALL_CONCURRENCY_LIMIT;
    if (prevNew !== undefined) process.env.CALLING_MAX_CONCURRENCY = prevNew;
  });

  it("caps concurrency at 10", async () => {
    const prev = process.env.CALL_CONCURRENCY_LIMIT;
    process.env.CALL_CONCURRENCY_LIMIT = "99";
    const { getCallConcurrencyLimit } = await import("../calling/safe-queue");
    assert.equal(getCallConcurrencyLimit(), 10);
    if (prev !== undefined) process.env.CALL_CONCURRENCY_LIMIT = prev;
    else delete process.env.CALL_CONCURRENCY_LIMIT;
  });
});
