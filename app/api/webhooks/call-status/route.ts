import { ApiError, handleApiError, jsonOk } from "@/lib/api/http";
import { applyVapiWebhookPayload } from "@/lib/telephony/sync";

/** Call status webhook — ringing / in-progress / ended / failed. */
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }

    await applyVapiWebhookPayload(body);
    return jsonOk({ received: true, kind: "call-status" });
  } catch (error) {
    return handleApiError(error);
  }
}
