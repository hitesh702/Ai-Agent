"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/workspace";

export type FormState = { error?: string; success?: boolean };

async function requireOwnedBusiness() {
  const session = await requireSession();
  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");
  return business;
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Campaign name is required"),
  agentId: z.string().min(1, "Select an agent"),
  leadIds: z.array(z.string()).default([]),
});

export async function createCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireOwnedBusiness();
  const leadIds = formData.getAll("leadIds").map(String).filter(Boolean);

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    agentId: formData.get("agentId"),
    leadIds,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const agent = await prisma.agent.findFirst({
    where: { id: parsed.data.agentId, businessId: business.id },
  });
  if (!agent) return { error: "Agent not found" };

  if (parsed.data.leadIds.length) {
    const count = await prisma.lead.count({
      where: { businessId: business.id, id: { in: parsed.data.leadIds } },
    });
    if (count !== parsed.data.leadIds.length) {
      return { error: "One or more leads are invalid" };
    }
  }

  const campaign = await prisma.campaign.create({
    data: {
      businessId: business.id,
      agentId: parsed.data.agentId,
      name: parsed.data.name,
      status: "DRAFT",
      leads: {
        create: parsed.data.leadIds.map((leadId) => ({ leadId })),
      },
    },
  });

  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${campaign.id}`);
}

export async function startCampaignAction(campaignId: string): Promise<FormState> {
  const business = await requireOwnedBusiness();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId: business.id },
    include: { leads: true },
  });
  if (!campaign) return { error: "Campaign not found" };
  if (campaign.leads.length === 0) {
    return { error: "Add at least one lead before starting" };
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "ACTIVE", startTime: campaign.startTime ?? new Date() },
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export async function pauseCampaignAction(campaignId: string): Promise<FormState> {
  const business = await requireOwnedBusiness();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId: business.id },
  });
  if (!campaign) return { error: "Campaign not found" };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "PAUSED" },
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}
