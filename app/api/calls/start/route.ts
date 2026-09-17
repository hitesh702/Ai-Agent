import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { startCallSchema } from "@/lib/api/schemas";
import { startOutboundCallForBusiness } from "@/lib/calls/start-call";

export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, startCallSchema);

    const call = await startOutboundCallForBusiness({
      businessId: business.id,
      agentId: body.agentId,
      leadId: body.leadId,
    });

    return jsonOk(call, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
