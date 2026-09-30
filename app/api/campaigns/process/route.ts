import {
  handleApiError,
  jsonOk,
  requireApiBusiness,
} from "@/lib/api/http";
import { processRunningCampaigns } from "@/lib/campaigns/queue";

/**
 * Advance RUNNING campaigns (retries that are now due, calling-window openings, missed webhooks).
 * Auth: `x-cron-secret: $CRON_SECRET` for all businesses, otherwise the session business only.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const headerSecret = request.headers.get("x-cron-secret");

    if (cronSecret && headerSecret === cronSecret) {
      return jsonOk({ scope: "all", campaigns: await processRunningCampaigns() });
    }

    const { business } = await requireApiBusiness();
    return jsonOk({
      scope: "authenticated",
      campaigns: await processRunningCampaigns({ businessId: business.id }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
