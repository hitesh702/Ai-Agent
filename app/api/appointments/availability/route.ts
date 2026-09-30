import type { NextRequest } from "next/server";
import { ApiError, handleApiError, jsonOk, requireApiBusiness } from "@/lib/api/http";
import { appointmentAvailabilityQuerySchema } from "@/lib/api/schemas";
import {
  APPOINTMENT_SLOT_MINUTES,
  appointmentTypeSchema,
  getAvailableSlots,
} from "@/lib/appointments/booking";

/**
 * GET /api/appointments/availability?date=YYYY-MM-DD&preference=morning&appointmentType=demo&duration=30
 * All appointment types use the same fixed slot length.
 */
export async function GET(request: NextRequest) {
  try {
    const { business } = await requireApiBusiness();
    const params = request.nextUrl.searchParams;
    const query = appointmentAvailabilityQuerySchema.parse({
      date: params.get("date") ?? "",
      preference: params.get("preference") || undefined,
      appointmentType: params.get("appointmentType") || undefined,
    });

    if (query.appointmentType && !appointmentTypeSchema.safeParse(query.appointmentType).success) {
      throw new ApiError(400, "Choose a valid appointment type");
    }
    const duration = params.get("duration");
    if (duration && Number(duration) !== APPOINTMENT_SLOT_MINUTES) {
      throw new ApiError(400, `Appointments are ${APPOINTMENT_SLOT_MINUTES} minutes long`);
    }

    const result = await getAvailableSlots(business.id, {
      date: query.date,
      preference: query.preference,
    });
    if (!result.ok) throw new ApiError(400, result.message, { code: result.code });

    return jsonOk({
      date: result.date,
      timeZone: result.timeZone,
      slotMinutes: result.slotMinutes,
      slots: result.slots,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
