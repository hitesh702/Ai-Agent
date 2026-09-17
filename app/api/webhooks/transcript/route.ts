import { ApiError, handleApiError, jsonOk } from "@/lib/api/http";
import { applyVapiWebhookPayload } from "@/lib/telephony/sync";

/** Transcript-focused webhook — persists transcript/summary from provider payload. */
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }

    await applyVapiWebhookPayload(body);
    return jsonOk({ received: true, kind: "transcript" });
  } catch (error) {
    return handleApiError(error);
  }
}
