import { clearSessionCookie } from "@/lib/auth/session";
import { handleApiError, jsonOk } from "@/lib/api/http";

export async function POST() {
  try {
    await clearSessionCookie();
    return jsonOk({ loggedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
