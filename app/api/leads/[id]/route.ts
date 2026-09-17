import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { leadUpdateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";
import {
  cancelActiveFollowUpsForLead,
  scheduleManualFollowUp,
} from "@/lib/followups/create";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();

    const lead = await prisma.lead.findFirst({
      where: { id, businessId: business.id },
      include: {
        calls: {
          orderBy: { createdAt: "desc" },
          include: {
            agent: { select: { id: true, name: true } },
            result: true,
          },
        },
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    return jsonOk(lead);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, leadUpdateSchema);

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) throw new ApiError(404, "Lead not found");

    const { followUpAt, followUpNote, followUpReminder, ...rest } = body;

    if (followUpAt === null) {
      await cancelActiveFollowUpsForLead({
        businessId: business.id,
        leadId: existing.id,
        reason: "Cleared via lead update",
      });
      const updated = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          ...rest,
          followUpRequired: false,
          followUpAt: null,
          ...(followUpNote !== undefined ? { followUpNote } : {}),
          ...(followUpReminder !== undefined ? { followUpReminder } : {}),
        },
      });
      return jsonOk(updated);
    }

    if (typeof followUpAt === "string" && followUpAt) {
      const scheduled = new Date(followUpAt);
      if (Number.isNaN(scheduled.getTime())) {
        throw new ApiError(400, "Invalid followUpAt");
      }
      if (existing.status === "NOT_INTERESTED") {
        throw new ApiError(
          400,
          "Cannot schedule follow-up for an opted-out lead",
        );
      }

      await scheduleManualFollowUp({
        businessId: business.id,
        leadId: existing.id,
        scheduledAt: scheduled,
        note: followUpNote ?? existing.followUpNote,
        reminder: followUpReminder ?? existing.followUpReminder,
      });

      if (Object.keys(rest).length > 0) {
        const patched = await prisma.lead.update({
          where: { id: existing.id },
          data: rest,
        });
        return jsonOk(patched);
      }

      const updated = await prisma.lead.findUniqueOrThrow({
        where: { id: existing.id },
      });
      return jsonOk(updated);
    }

    const updated = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...rest,
        ...(followUpNote !== undefined ? { followUpNote } : {}),
        ...(followUpReminder !== undefined ? { followUpReminder } : {}),
      },
    });

    return jsonOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) throw new ApiError(404, "Lead not found");

    await prisma.lead.delete({ where: { id: existing.id } });
    return jsonOk({ deleted: true, id: existing.id });
  } catch (error) {
    return handleApiError(error);
  }
}
