import { ApiError, handleApiError, jsonOk } from "@/lib/api/http";
import { applyVapiWebhookPayload } from "@/lib/telephony/sync";

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }

    const message = body.message as Record<string, unknown> | undefined;
    const type = message?.type || body.type;

    if (
      type === "end-of-call-report" ||
      type === "status-update" ||
      type === "call" ||
      !type
    ) {
      await applyVapiWebhookPayload(body);
    }

    return jsonOk({ received: true, type: type ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}
