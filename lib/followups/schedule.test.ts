import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWithinCallingWindow,
  nextAllowedCallingTime,
  parseFollowUpScheduleInput,
} from "./schedule";

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
});

describe("safe queue concurrency config", () => {
  it("defaults concurrency to 2", async () => {
    const prev = process.env.CALL_CONCURRENCY_LIMIT;
    delete process.env.CALL_CONCURRENCY_LIMIT;
    const { getCallConcurrencyLimit } = await import("../calling/safe-queue");
    assert.equal(getCallConcurrencyLimit(), 2);
    if (prev !== undefined) process.env.CALL_CONCURRENCY_LIMIT = prev;
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
