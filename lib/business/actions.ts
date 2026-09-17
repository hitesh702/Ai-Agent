"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export type BusinessActionState = {
  error?: string;
  success?: boolean;
};

const businessSchema = z.object({
  name: z.string().trim().min(2, "Business name is required"),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  website: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v) || v.includes("."),
      "Enter a valid website",
    ),
  description: z.string().trim().optional(),
});

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export async function createBusinessAction(
  _prev: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const session = await requireSession();

  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");

  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    phone: emptyToUndefined(formData.get("phone")),
    address: emptyToUndefined(formData.get("address")),
    website: emptyToUndefined(formData.get("website")),
    description: emptyToUndefined(formData.get("description")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.business.update({
    where: { id: business.id },
    data: parsed.data,
  });

  redirect("/dashboard");
}

export async function updateBusinessAction(
  _prev: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const session = await requireSession();

  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");

  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    phone: emptyToUndefined(formData.get("phone")),
    address: emptyToUndefined(formData.get("address")),
    website: emptyToUndefined(formData.get("website")),
    description: emptyToUndefined(formData.get("description")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.business.update({
    where: { id: business.id },
    data: parsed.data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/business");
  return { success: true };
}
