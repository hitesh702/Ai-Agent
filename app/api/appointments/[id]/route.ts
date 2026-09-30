import type { AppointmentStatus } from "@prisma/client";
import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { appointmentStatusUpdateSchema } from "@/lib/api/schemas";
import { getAppointment, updateAppointmentStatus } from "@/lib/appointments/booking";

type Ctx = { params: Promise<{ id: string }> };

async function changeStatus(businessId: string, id: string, status: AppointmentStatus) {
  const result = await updateAppointmentStatus(businessId, id, status);
  if (!result.ok) {
    throw new ApiError(result.code === "not_found" ? 404 : 409, result.message, {
      code: result.code,
    });
  }
  return getAppointment(businessId, id);
}

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const appointment = await getAppointment(business.id, id);
    if (!appointment) throw new ApiError(404, "Appointment not found");
    return jsonOk(appointment);
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
    return jsonOk(await changeStatus(business.id, id, status));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Cancels the appointment (kept for history) and frees its slot. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    return jsonOk(await changeStatus(business.id, id, "CANCELLED"));
  } catch (error) {
    return handleApiError(error);
  }
}
