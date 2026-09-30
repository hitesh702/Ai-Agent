import type { AppointmentStatus } from "@prisma/client";
import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { appointmentStatusUpdateSchema } from "@/lib/api/schemas";
import {
  getAppointment,
  toSafeAppointment,
  updateAppointmentStatus,
} from "@/lib/appointments/booking";

type Ctx = { params: Promise<{ id: string }> };

async function loadDetails(business: { id: string; timezone: string }, id: string) {
  const appointment = await getAppointment(business.id, id);
  if (!appointment) throw new ApiError(404, "Appointment not found");
  return {
    ...toSafeAppointment(appointment, business.timezone || "Asia/Kolkata"),
    phone: appointment.lead.phone,
    email: appointment.lead.email,
    leadId: appointment.lead.id,
    call: appointment.call ? { id: appointment.call.id, status: appointment.call.status } : null,
    bookedByAgent: appointment.agent?.name ?? null,
    notes: appointment.notes,
    createdAt: appointment.createdAt,
  };
}

async function changeStatus(
  business: { id: string; timezone: string },
  id: string,
  status: AppointmentStatus,
) {
  const result = await updateAppointmentStatus(business.id, id, status);
  if (!result.ok) {
    throw new ApiError(result.code === "not_found" ? 404 : 409, result.message, {
      code: result.code,
    });
  }
  return loadDetails(business, id);
}

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    return jsonOk(await loadDetails(business, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Status changes only: confirm, cancel, mark completed or no-show. */
export async function PUT(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const { status } = await parseJsonBody(request, appointmentStatusUpdateSchema);
    return jsonOk(await changeStatus(business, id, status));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Cancels the appointment (kept for history) and frees its slot. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    return jsonOk(await changeStatus(business, id, "CANCELLED"));
  } catch (error) {
    return handleApiError(error);
  }
}
