import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { appointmentCreateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    const appointments = await prisma.appointment.findMany({
      where: { businessId: business.id },
      include: { lead: true, call: true },
      orderBy: { date: "asc" },
    });
    return jsonOk(appointments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, appointmentCreateSchema);

    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, businessId: business.id },
    });
    if (!lead) throw new ApiError(404, "Lead not found");

    if (body.callId) {
      const call = await prisma.call.findFirst({
        where: { id: body.callId, businessId: business.id },
      });
      if (!call) throw new ApiError(404, "Call not found");
    }

    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, "Invalid date");
    }

    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        leadId: body.leadId,
        callId: body.callId ?? null,
        date,
        time: body.time ?? null,
        type: body.type ?? null,
        notes: body.notes ?? null,
        status: body.status ?? "SCHEDULED",
      },
      include: { lead: true },
    });

    return jsonOk(appointment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
