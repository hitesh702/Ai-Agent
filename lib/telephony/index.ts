import type { TelephonyProvider } from "@/lib/telephony/types";
import { VapiTelephonyProvider } from "@/lib/telephony/providers/vapi";

/**
 * TelephonyProvider
 * ├── vapi          (Provider A — current MVP)
 * ├── twilio/exotel (Provider B — future)
 * └── future        (swap via TELEPHONY_PROVIDER env)
 */
const providers: Record<string, () => TelephonyProvider> = {
  vapi: () => new VapiTelephonyProvider(),
};

export function getTelephonyProvider(): TelephonyProvider {
  const key = (process.env.TELEPHONY_PROVIDER || "vapi").toLowerCase();
  const factory = providers[key];
  if (!factory) {
    throw new Error(
      `Unknown TELEPHONY_PROVIDER "${key}". Registered: ${Object.keys(providers).join(", ")}`,
    );
  }
  return factory();
}

export function isTelephonyConfigured(): boolean {
  try {
    return getTelephonyProvider().isConfigured();
  } catch {
    return false;
  }
}

/** Normalize Indian / local numbers to E.164 when possible. */
export function toE164Phone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  return `+${digits}`;
}
