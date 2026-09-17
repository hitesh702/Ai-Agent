"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/workspace";
import { isTelephonyConfigured } from "@/lib/telephony";
import { startOutboundCallForBusiness } from "@/lib/calls/start-call";
import { applyProviderSnapshot } from "@/lib/telephony/sync";
import { getTelephonyProvider } from "@/lib/telephony";
import { ApiError } from "@/lib/api/http";

export type CallActionState = {
  error?: string;
  success?: boolean;
};

async function requireOwnedBusiness() {
  const session = await requireSession();
  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");
  return business;
}

const startCallSchema = z.object({
  agentId: z.string().min(1, "Select an agent"),
  leadId: z.string().min(1, "Select a lead"),
});

export async function startTestCallAction(
  _prev: CallActionState,
  formData: FormData,
): Promise<CallActionState> {
  const business = await requireOwnedBusiness();

  if (!isTelephonyConfigured()) {
    return {
      error:
        "Add telephony credentials to .env (VAPI_API_KEY + VAPI_PHONE_NUMBER_ID), then restart.",
    };
  }

  const parsed = startCallSchema.safeParse({
    agentId: formData.get("agentId"),
    leadId: formData.get("leadId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let callId: string;

  try {
    const call = await startOutboundCallForBusiness({
      businessId: business.id,
      agentId: parsed.data.agentId,
      leadId: parsed.data.leadId,
    });
    callId = call.id;
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return {
      error:
        error instanceof Error ? error.message : "Failed to start the test call",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calls");
  redirect(`/dashboard/calls/${callId}`);
}

export async function refreshCallFromProviderAction(
  callId: string,
): Promise<CallActionState> {
  const business = await requireOwnedBusiness();

  const call = await prisma.call.findFirst({
    where: { id: callId, businessId: business.id },
  });

  if (!call) return { error: "Call not found" };
  if (!call.providerCallId) {
    return { error: "This call has no provider ID yet." };
  }

  try {
    const provider = getTelephonyProvider();
    const snapshot = await provider.fetchCall(call.providerCallId);
    await applyProviderSnapshot({
      callaiCallId: call.id,
      providerCallId: call.providerCallId,
      providerName: call.provider,
      snapshot,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not refresh call status",
    };
  }

  revalidatePath(`/dashboard/calls/${callId}`);
  revalidatePath("/dashboard/calls");
  return { success: true };
}
