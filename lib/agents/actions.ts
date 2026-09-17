"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AgentLanguage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace, requireSession } from "@/lib/workspace";

export type AgentActionState = {
  error?: string;
  success?: boolean;
};

const agentSchema = z.object({
  name: z.string().trim().min(2, "Agent name is required"),
  language: z.nativeEnum(AgentLanguage),
  voice: z.string().trim().optional(),
  objective: z.string().trim().optional(),
  systemPrompt: z.string().trim().optional(),
  active: z.boolean(),
});

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

async function requireOwnedBusiness() {
  const session = await requireSession();
  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");
  return business;
}

export async function createAgentAction(
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const business = await requireOwnedBusiness();

  const parsed = agentSchema.safeParse({
    name: formData.get("name"),
    language: formData.get("language") || "HINGLISH",
    voice: emptyToUndefined(formData.get("voice")),
    objective: emptyToUndefined(formData.get("objective")),
    systemPrompt: emptyToUndefined(formData.get("systemPrompt")),
    active: formData.get("active") !== "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const agent = await prisma.agent.create({
    data: {
      ...parsed.data,
      businessId: business.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agents");
  redirect(`/dashboard/agents/${agent.id}`);
}

export async function updateAgentAction(
  agentId: string,
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const business = await requireOwnedBusiness();

  const existing = await prisma.agent.findFirst({
    where: { id: agentId, businessId: business.id },
  });
  if (!existing) return { error: "Agent not found" };

  const parsed = agentSchema.safeParse({
    name: formData.get("name"),
    language: formData.get("language") || existing.language,
    voice: emptyToUndefined(formData.get("voice")),
    objective: emptyToUndefined(formData.get("objective")),
    systemPrompt: emptyToUndefined(formData.get("systemPrompt")),
    active: formData.get("active") !== "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.agent.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/agents/${agentId}`);
  return { success: true };
}

export async function listAgentsForWorkspace() {
  const { business } = await getCurrentWorkspace();
  return prisma.agent.findMany({
    where: { businessId: business.id },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAgentForWorkspace(agentId: string) {
  const { business } = await getCurrentWorkspace();
  return prisma.agent.findFirst({
    where: { id: agentId, businessId: business.id },
  });
}
