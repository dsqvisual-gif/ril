import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { createHandoffCode, isAppReturnUrl, RETURN_COOKIE } from "@/lib/mobile-auth";

/** After signing in on the website: back to the app with a one-time code. */
export async function GET(request: Request) {
  const jar = await cookies();
  const back = jar.get(RETURN_COOKIE)?.value ?? null;
  // A client-side navigation from the site arrives first as an RSC fetch, which cannot
  // follow a redirect to the app; the browser then loads this page for real. Keep the
  // return address for that second request.
  if (request.headers.get("rsc") === "1") {
    return new Response(null, { status: 302, headers: { Location: new URL("/mobile/finish", request.url).toString() } });
  }
  jar.delete(RETURN_COOKIE);
  if (!isAppReturnUrl(back)) return Response.redirect(new URL("/app", request.url));

  const target = new URL(back);
  const userId = (await auth())?.user?.id;
  const failed = new URL(request.url).searchParams.get("error");
  if (userId && !failed) {
    target.searchParams.set("code", await createHandoffCode(userId));
  } else {
    target.searchParams.set("error", failed ?? "signin");
  }
  return new Response(null, { status: 302, headers: { Location: target.toString() } });
}
