import {
  handleApiError,
  jsonOk,
  requireApiBusiness,
} from "@/lib/api/http";
import { markCampaignReady } from "@/lib/campaigns/lifecycle";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    return jsonOk(await markCampaignReady(business.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
