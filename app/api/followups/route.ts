import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { scheduleManualFollowUp } from "@/lib/followups/create";
import { parseFollowUpScheduleInput } from "@/lib/followups/schedule";

const createSchema = z.object({
  leadId: z.string().min(1),
  scheduledAt: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  note: z.string().optional().nullable(),
  reminder: z.boolean().optional(),
  agentId: z.string().optional().nullable(),
});

/** Create a manual follow-up for a lead owned by the current business. */
export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, createSchema);

    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, businessId: business.id },
    });
    if (!lead) throw new ApiError(404, "Lead not found");

    if (lead.status === "NOT_INTERESTED") {
      throw new ApiError(400, "Cannot schedule follow-up for an opted-out lead");
    }

    const scheduledAt = parseFollowUpScheduleInput({
      scheduledAt: body.scheduledAt,
      date: body.date,
      time: body.time,
      timeZone: business.timezone,
    });
    if (!scheduledAt) {
      throw new ApiError(400, "Invalid follow-up date/time");
    }

    if (body.agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: body.agentId, businessId: business.id, active: true },
      });
      if (!agent) throw new ApiError(400, "Agent not found");
    }

    const followUp = await scheduleManualFollowUp({
      businessId: business.id,
      leadId: lead.id,
      agentId: body.agentId,
      scheduledAt,
      note: body.note,
      reminder: body.reminder,
    });

    return jsonOk(followUp, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId");

    const followUps = await prisma.followUp.findMany({
      where: {
        businessId: business.id,
        ...(leadId ? { leadId } : {}),
      },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    });

    return jsonOk(followUps);
  } catch (error) {
    return handleApiError(error);
  }
}
