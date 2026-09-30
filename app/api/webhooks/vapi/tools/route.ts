import { NextResponse } from "next/server";
import {
  handleAppointmentToolWebhook,
  TOOL_TOKEN_HEADER,
} from "@/lib/appointments/agent-tools";

/** Vapi function-tool calls (appointment slots / booking) during a live call. */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { status, body } = await handleAppointmentToolWebhook(
      payload,
      request.headers.get(TOOL_TOKEN_HEADER),
    );
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[appointments] tool webhook failed", error);
    return NextResponse.json({ error: "Tool request failed" }, { status: 500 });
  }
}
