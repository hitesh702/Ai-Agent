import {
  handleApiError,
  jsonOk,
  requireApiBusiness,
} from "@/lib/api/http";
import { processDueFollowUps } from "@/lib/followups/process";

/**
 * Process due follow-ups into the safe calling queue.
 * Auth: session business OR `x-cron-secret: $CRON_SECRET`.
 * Jobs are DB-persistent — restarts do not lose PENDING follow-ups.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const headerSecret = request.headers.get("x-cron-secret");

    if (cronSecret && headerSecret === cronSecret) {
      const summary = await processDueFollowUps();
      return jsonOk({ scope: "all", ...summary });
    }

    await requireApiBusiness();
    const summary = await processDueFollowUps();
    return jsonOk({ scope: "authenticated", ...summary });
  } catch (error) {
    return handleApiError(error);
  }
}
