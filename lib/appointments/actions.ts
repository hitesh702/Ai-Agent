"use server";

import { AppointmentStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/workspace";
import {
  bookAppointment,
  updateAppointmentStatus,
  type BookingSlot,
} from "./booking";

export type FormState = {
  error?: string;
  success?: boolean;
  message?: string;
  alternatives?: BookingSlot[];
};

async function requireOwnedBusiness() {
  const session = await requireSession();
  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");
  return business;
}

export async function createAppointmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireOwnedBusiness();
  if (formData.get("customerAgreed") !== "on") {
    return { error: "Only book after the customer has agreed to this time." };
  }

  const result = await bookAppointment(business.id, {
    leadId: formData.get("leadId"),
    date: formData.get("date"),
    time: formData.get("time"),
    appointmentType: formData.get("type"),
    notes: formData.get("notes") || undefined,
  });

  if (!result.ok) {
    return { error: result.message, alternatives: result.alternatives };
  }

  revalidatePath("/dashboard/appointments");
  return {
    success: true,
    message: result.created
      ? `Booked. ${result.confirmation}`
      : `This appointment already exists. ${result.confirmation}`,
  };
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<FormState> {
  const business = await requireOwnedBusiness();
  if (!Object.values(AppointmentStatus).includes(status)) {
    return { error: "Choose a valid appointment status" };
  }

  const result = await updateAppointmentStatus(business.id, appointmentId, status);
  if (!result.ok) return { error: result.message };

  revalidatePath("/dashboard/appointments");
  revalidatePath(`/dashboard/appointments/${appointmentId}`);
  return { success: true };
}
