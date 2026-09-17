import { NextRequest, NextResponse } from "next/server";
import { applyVapiWebhookPayload } from "@/lib/telephony/sync";

/** Legacy Vapi webhook path — kept for existing APP_URL/VAPI_SERVER_URL configs. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message as Record<string, unknown> | undefined;
  const type = message?.type;

  if (type === "end-of-call-report" || type === "status-update") {
    await applyVapiWebhookPayload(body);
  }

  return NextResponse.json({ ok: true });
}
