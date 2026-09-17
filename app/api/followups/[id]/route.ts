import { FollowUpStatus } from "@prisma/client";
import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { parseFollowUpScheduleInput } from "@/lib/followups/schedule";

type Ctx = { params: Promise<{ id: string }> };

const rescheduleSchema = z.object({
  scheduledAt: z.string().min(1),
});

async function requireOwnedFollowUp(id: string, businessId: string) {
  const followUp = await prisma.followUp.findFirst({
    where: { id, businessId },
  });
  if (!followUp) throw new ApiError(404, "Follow-up not found");
  return followUp;
}

/** Cancel a follow-up */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const existing = await requireOwnedFollowUp(id, business.id);

    if (
      existing.status === FollowUpStatus.COMPLETED ||
      existing.status === FollowUpStatus.CANCELLED
    ) {
      return jsonOk(existing);
    }

    const updated = await prisma.followUp.update({
      where: { id: existing.id },
      data: {
        status: FollowUpStatus.CANCELLED,
        skipReason: "Cancelled by user",
      },
    });

    const remaining = await prisma.followUp.count({
      where: {
        leadId: existing.leadId,
        status: {
          in: [
            FollowUpStatus.PENDING,
            FollowUpStatus.READY,
            FollowUpStatus.QUEUED,
          ],
        },
      },
    });
    if (remaining === 0) {
      await prisma.lead.update({
        where: { id: existing.leadId },
        data: {
          followUpRequired: false,
          followUpAt: null,
        },
      });
    }

    return jsonOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Reschedule a follow-up */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const existing = await requireOwnedFollowUp(id, business.id);
    const body = await parseJsonBody(request, rescheduleSchema);

    if (
      existing.status === FollowUpStatus.COMPLETED ||
      existing.status === FollowUpStatus.CANCELLED ||
      existing.status === FollowUpStatus.SKIPPED
    ) {
      throw new ApiError(400, `Cannot reschedule a ${existing.status} follow-up`);
    }

    const scheduledAt = parseFollowUpScheduleInput({
      scheduledAt: body.scheduledAt,
    });
    if (!scheduledAt) throw new ApiError(400, "Invalid scheduledAt");

    const updated = await prisma.followUp.update({
      where: { id: existing.id },
      data: {
        scheduledAt,
        nextAttemptAt: scheduledAt,
        status: FollowUpStatus.PENDING,
        skipReason: null,
      },
    });

    await prisma.lead.update({
      where: { id: existing.leadId },
      data: {
        followUpRequired: true,
        followUpAt: scheduledAt,
      },
    });

    return jsonOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
