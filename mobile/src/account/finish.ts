import { Platform } from "react-native";
import { router } from "expo-router";
import { signInOnWebsite, type WebFlow } from "./web-sign-in";
import type { Session } from "./api";

/**
 * After a sign-in. The root layout swaps the sign-in screens for the app by itself
 * (protected screens); this only makes sure the planner is the open tab.
 */
export function goHomeAfterSignIn() {
  setTimeout(() => {
    try {
      router.replace("/");
    } catch {
      // Already there.
    }
  }, 0);
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
