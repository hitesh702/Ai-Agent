import {
  ApiError,
  handleApiError,
  jsonOk,
  requireApiBusiness,
} from "@/lib/api/http";
import { getCallSummaryForBusiness } from "@/lib/ai/summarize-call";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();

    const call = await prisma.call.findFirst({
      where: { id, businessId: business.id },
      include: { agent: true, lead: true, result: true },
    });
    if (!call) throw new ApiError(404, "Call not found");

    const aiSummary = await getCallSummaryForBusiness(business.id, call.id);
    return jsonOk({ ...call, aiSummary });
  } catch (error) {
    return handleApiError(error);
  }
}
