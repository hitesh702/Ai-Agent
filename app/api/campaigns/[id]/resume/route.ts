import { handleApiError, jsonOk, requireApiBusiness } from "@/lib/api/http";
import { resumeCampaign } from "@/lib/campaigns/lifecycle";

type Ctx = { params: Promise<{ id: string }> };

/** PAUSED → RUNNING after re-checking agent, leads, opt-outs and schedule. */
export async function POST(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    return jsonOk(await resumeCampaign(business.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
