import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { appointmentCreateSchema } from "@/lib/api/schemas";
import {
  bookAppointment,
  listAppointments,
  toSafeAppointment,
  type BookingFailureCode,
} from "@/lib/appointments/booking";

const FAILURE_STATUS: Record<BookingFailureCode, number> = {
  invalid_input: 400,
  invalid_lead: 404,
  invalid_call: 404,
  past_time: 400,
  outside_hours: 400,
  slot_taken: 409,
};

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    const timeZone = business.timezone || "Asia/Kolkata";
    const appointments = await listAppointments(business.id);
    return jsonOk(appointments.map((a) => toSafeAppointment(a, timeZone)));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Body: { leadId, date: "YYYY-MM-DD", time: "HH:MM", appointmentType, notes?, callId? } */
export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, appointmentCreateSchema);

    // Only the AI tool flow records which agent booked; dashboard/API bookings never set it.
    const result = await bookAppointment(business.id, { ...body, agentId: null });
    if (!result.ok) {
      throw new ApiError(FAILURE_STATUS[result.code], result.message, {
        code: result.code,
        alternatives: result.alternatives,
      });
    }

    return jsonOk(
      {
        appointment: toSafeAppointment(result.appointment, business.timezone || "Asia/Kolkata"),
        created: result.created,
        confirmation: result.confirmation,
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
