import type { CampaignLeadStatus } from "@prisma/client";
import type { CallOutcome } from "@/lib/calling/outcome";
import {
  nextAllowedCallingTime,
  type CallingWindowConfig,
} from "@/lib/followups/schedule";

/** Defaults for new campaigns. Every value can be changed per campaign. */
export const CAMPAIGN_DEFAULTS = {
  callingDays: [1, 2, 3, 4, 5, 6],
  callingWindowStart: "09:00",
  callingWindowEnd: "20:00",
  maxAttempts: 3,
  busyRetryMinutes: 30,
  /** No answer and voicemail */
  retryDelayMinutes: 120,
  failedRetryMinutes: 30,
  retryOnVoicemail: true,
  createFollowUps: true,
} as const;

export type CampaignSchedule = {
  callingDays: string;
  callingWindowStart: string;
  callingWindowEnd: string;
};

export type CampaignRetryRules = {
  maxAttempts: number;
  busyRetryMinutes: number;
  retryDelayMinutes: number;
  failedRetryMinutes: number;
  retryOnVoicemail: boolean;
};

export function campaignWindow(
  campaign: CampaignSchedule,
  timezone: string | null | undefined,
): CallingWindowConfig {
  return {
    timezone: timezone || "Asia/Kolkata",
    callingDays: campaign.callingDays,
    callingWindowStart: campaign.callingWindowStart,
    callingWindowEnd: campaign.callingWindowEnd,
  };
}

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** e.g. "Mon–Sat · 09:00–20:00 (Asia/Kolkata)" */
export function formatCampaignSchedule(campaign: CampaignSchedule, timezone: string) {
  const days = campaign.callingDays.split(",").map(Number).filter((d) => d >= 1 && d <= 7);
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText =
    days.length === 7
      ? "Every day"
      : consecutive && days.length > 2
        ? `${DAY_LABELS[days[0]]}–${DAY_LABELS[days[days.length - 1]]}`
        : days.map((d) => DAY_LABELS[d]).join(", ");
  const hours =
    campaign.callingWindowStart === campaign.callingWindowEnd
      ? "all day"
      : `${campaign.callingWindowStart}–${campaign.callingWindowEnd}`;
  return `${dayText || "No days"} · ${hours} (${timezone})`;
}

export function retryDelayMinutesFor(outcome: CallOutcome, rules: CampaignRetryRules) {
  if (outcome === "BUSY") return rules.busyRetryMinutes;
  if (outcome === "FAILED") return rules.failedRetryMinutes;
  return rules.retryDelayMinutes;
}

export function decideAfterCall(input: {
  outcome: CallOutcome;
  attempts: number;
  rules: CampaignRetryRules;
  window: CallingWindowConfig;
  now: Date;
}): {
  status: CampaignLeadStatus;
  lastOutcome: CallOutcome;
  nextAttemptAt: Date | null;
} {
  const { outcome, attempts, rules } = input;
  const done = { lastOutcome: outcome, nextAttemptAt: null };

  if (outcome === "CONNECTED" || outcome === "REFUSED" || outcome === "OPTED_OUT") {
    return { status: "COMPLETED", ...done };
  }
  if (outcome === "VOICEMAIL" && !rules.retryOnVoicemail) {
    return { status: "COMPLETED", ...done };
  }
  if (attempts >= rules.maxAttempts) {
    return { status: "FAILED", ...done };
  }

  const delayMs = retryDelayMinutesFor(outcome, rules) * 60_000;
  const earliest = new Date(input.now.getTime() + delayMs);
  return {
    status: "PENDING",
    lastOutcome: outcome,
    nextAttemptAt: nextAllowedCallingTime(earliest, input.window),
  };
}
