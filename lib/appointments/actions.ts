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
  leadId: z.string().min(1, "Select a lead"),
  date: z.string().min(1, "Date is required"),
  time: z.string().trim().optional(),
  type: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function createAppointmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireOwnedBusiness();

  const parsed = createSchema.safeParse({
    leadId: formData.get("leadId"),
    date: formData.get("date"),
    time: formData.get("time") || undefined,
    type: formData.get("type") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, businessId: business.id },
  });
  if (!lead) return { error: "Lead not found" };

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) return { error: "Invalid date" };

  await prisma.appointment.create({
    data: {
      businessId: business.id,
      leadId: lead.id,
      date,
      time: parsed.data.time || null,
      type: parsed.data.type || "counselling",
      notes: parsed.data.notes || null,
      status: "SCHEDULED",
    },
  });

  revalidatePath("/dashboard/appointments");
  return { success: true };
}
