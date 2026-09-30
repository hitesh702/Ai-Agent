import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { campaignStartSchema } from "@/lib/api/schemas";
import { startCampaign } from "@/lib/campaigns/lifecycle";

type Ctx = { params: Promise<{ id: string }> };

/** Start a READY (or FAILED) campaign. Body must be { "confirm": true }. Paused campaigns use /resume. */
export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, campaignStartSchema);
    return jsonOk(await startCampaign(business.id, id, body.confirm));
  } catch (error) {
    return handleApiError(error);
  }
}
