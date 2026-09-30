"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/http";
import { campaignCreateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/workspace";
import {
  createCampaign,
  markCampaignReady,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  updateCampaign,
} from "./lifecycle";
import type { CampaignTickResult } from "./queue";

export type FormState = { error?: string; success?: boolean; message?: string };

async function requireOwnedBusiness() {
  const session = await requireSession();
  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");
  return business;
}

function parseCampaignForm(formData: FormData) {
  return campaignCreateSchema.safeParse({
    name: formData.get("name"),
    agentId: formData.get("agentId"),
    leadIds: formData.getAll("leadIds").map(String).filter(Boolean),
    callingDays: formData.getAll("callingDays").map(String),
    callingWindowStart: formData.get("callingWindowStart"),
    callingWindowEnd: formData.get("callingWindowEnd"),
    maxAttempts: formData.get("maxAttempts"),
    busyRetryMinutes: formData.get("busyRetryMinutes"),
    retryDelayMinutes: formData.get("retryDelayMinutes"),
    failedRetryMinutes: formData.get("failedRetryMinutes"),
    retryOnVoicemail: formData.get("retryOnVoicemail") === "on",
    createFollowUps: formData.get("createFollowUps") === "on",
  });
}

function toFormError(error: unknown): FormState {
  if (error instanceof ApiError) return { error: error.message };
  console.error("[campaign] action failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  return { error: "Something went wrong. Please try again." };
}

function revalidateCampaign(campaignId?: string) {
  revalidatePath("/dashboard/campaigns");
  if (campaignId) revalidatePath(`/dashboard/campaigns/${campaignId}`);
}

export async function createCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireOwnedBusiness();
  const parsed = parseCampaignForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let campaignId: string;
  try {
    campaignId = (await createCampaign(business.id, parsed.data)).id;
  } catch (error) {
    return toFormError(error);
  }
  revalidateCampaign();
  redirect(`/dashboard/campaigns/${campaignId}`);
}

export async function updateCampaignAction(
  campaignId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireOwnedBusiness();
  const parsed = parseCampaignForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await updateCampaign(business.id, campaignId, parsed.data);
  } catch (error) {
    return toFormError(error);
  }
  revalidateCampaign(campaignId);
  return { success: true };
}

export async function markCampaignReadyAction(campaignId: string): Promise<FormState> {
  const business = await requireOwnedBusiness();
  try {
    await markCampaignReady(business.id, campaignId);
  } catch (error) {
    return toFormError(error);
  }
  revalidateCampaign(campaignId);
  return {
    success: true,
    message: "Campaign is ready. No calls have started. Click Start Campaign when you want to begin.",
  };
}

function describeActivation(
  verb: "started" | "resumed",
  result: { campaign: { failureReason: string | null }; tick: CampaignTickResult | null },
): FormState {
  const tick = result.tick;
  if (tick?.state === "failed") {
    return { error: `Campaign stopped: ${result.campaign.failureReason ?? "unknown error"}` };
  }
  if (tick?.state === "completed") {
    return { success: true, message: "No leads are left to call, so the campaign is completed." };
  }
  if (tick?.state === "outside_schedule") {
    return {
      success: true,
      message: `Campaign ${verb}. It is outside the calling schedule now, so calls will begin in the next allowed window.`,
    };
  }
  if (tick?.state === "calling_disabled") {
    return {
      success: true,
      message: `Campaign ${verb}, but calling is turned off for this business in Settings.`,
    };
  }
  const started = tick?.started ?? 0;
  return {
    success: true,
    message: `Campaign ${verb}. ${started} call${started === 1 ? "" : "s"} placed; more start as calls finish.`,
  };
}

export async function startCampaignAction(
  campaignId: string,
  confirmed: boolean,
): Promise<FormState> {
  const business = await requireOwnedBusiness();
  let state: FormState;
  try {
    state = describeActivation("started", await startCampaign(business.id, campaignId, confirmed));
  } catch (error) {
    return toFormError(error);
  }
  revalidateCampaign(campaignId);
  return state;
}

export async function resumeCampaignAction(campaignId: string): Promise<FormState> {
  const business = await requireOwnedBusiness();
  let state: FormState;
  try {
    state = describeActivation("resumed", await resumeCampaign(business.id, campaignId));
  } catch (error) {
    return toFormError(error);
  }
  revalidateCampaign(campaignId);
  return state;
}

export async function pauseCampaignAction(campaignId: string): Promise<FormState> {
  const business = await requireOwnedBusiness();
  try {
    await pauseCampaign(business.id, campaignId);
  } catch (error) {
    return toFormError(error);
  }
  revalidateCampaign(campaignId);
  return {
    success: true,
    message: "Campaign paused. Calls already in progress will finish; no new calls will start.",
  };
}
