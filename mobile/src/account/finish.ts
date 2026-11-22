import { Platform } from "react-native";
import { router } from "expo-router";
import { signInOnWebsite, type WebFlow } from "./web-sign-in";
import type { Session } from "./api";

/** After any successful sign-in: back to the profile, with the sign-in screens closed. */
export function goHomeAfterSignIn() {
  if (router.canDismiss()) router.dismissAll();
  router.replace("/profile");
}

/**
 * Registration, code login and password reset need the captcha. The phone apps show
 * it in a window; the browser version does these steps on the website instead.
 */
export function needsWebsite(): boolean {
  return Platform.OS === "web";
}

export async function viaWebsite(flow: WebFlow, signIn: (s: Session) => Promise<void>) {
  const session = await signInOnWebsite(flow);
  if (session) {
    await signIn(session);
    goHomeAfterSignIn();
  }
}
