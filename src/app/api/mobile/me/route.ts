import { mobileJson, mobileUser, mobileUserId, preflight } from "@/lib/mobile-auth";

/** The signed-in app user's profile; 401 once the token is invalid or the account is gone. */
export async function GET(request: Request) {
  const userId = await mobileUserId(request);
  const user = userId ? await mobileUser(userId) : null;
  return user ? mobileJson(request, { user }) : mobileJson(request, { error: "unauthorized" }, 401);
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
