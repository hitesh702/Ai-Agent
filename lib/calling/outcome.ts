export type CallOutcome =
  | "CONNECTED"
  | "BUSY"
  | "NO_ANSWER"
  | "VOICEMAIL"
  | "FAILED"
  | "REFUSED"
  | "OPTED_OUT";

/**
 * Classify a finished call. Returns null while the call is still active.
 * Voicemail is only reported when the provider says so; it is never inferred.
 */
export function classifyCallOutcome(input: {
  status: string;
  providerStatus?: string | null;
  endedReason?: string | null;
  interest?: string | null;
  optOut?: boolean | null;
}): CallOutcome | null {
  if (input.status !== "ENDED" && input.status !== "FAILED") return null;

  const reason = (input.endedReason ?? "").toLowerCase();
  const providerStatus = (input.providerStatus ?? "").toLowerCase();
  const interest = (input.interest ?? "").toUpperCase().replaceAll("-", "_");

  if (input.optOut) return "OPTED_OUT";
  if (reason.includes("voicemail")) return "VOICEMAIL";
  if (providerStatus === "busy" || reason.includes("busy")) return "BUSY";
  if (
    providerStatus === "no-answer" ||
    reason.includes("did-not-answer") ||
    reason.includes("no-answer")
  ) {
    return "NO_ANSWER";
  }
  if (interest === "NOT_INTERESTED") return "REFUSED";
  if (input.status === "FAILED") return "FAILED";
  if (reason.includes("error") || reason.includes("failed")) return "FAILED";
  return "CONNECTED";
}

export function isConversationOutcome(outcome: CallOutcome): boolean {
  return outcome === "CONNECTED" || outcome === "REFUSED" || outcome === "OPTED_OUT";
}
