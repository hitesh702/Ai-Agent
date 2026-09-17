"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/workspace";

export type LeadActionState = {
  error?: string;
  success?: boolean;
};

const leadSchema = z.object({
  name: z.string().trim().min(2, "Lead name is required"),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .max(20, "Phone number is too long"),
  email: z.string().trim().email().optional().or(z.literal("")),
  source: z.string().trim().optional(),
  notes: z.string().trim().optional(),
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

export async function createLeadAction(
  _prev: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const business = await requireOwnedBusiness();

  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: emptyToUndefined(formData.get("email")) ?? "",
    source: emptyToUndefined(formData.get("source")),
    notes: emptyToUndefined(formData.get("notes")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, ...rest } = parsed.data;

  await prisma.lead.create({
    data: {
      ...rest,
      email: email || null,
      businessId: business.id,
      status: "NEW",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/calls");
  return { success: true };
}
