import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { auth, SITE, type Session } from "./api";

export type WebFlow = "google" | "register" | "login" | "code" | "forgot";

/** Where the website sends the person back after signing in: this app's /auth screen. */
export function returnUrl(): string {
  return Linking.createURL("auth");
}

/**
 * Signs in through the website in the phone's browser (used for Google).
 * Resolves with a session, or null if the person closed the browser.
 * On the web version the whole page goes to the website and comes back to /auth.
 */
export async function signInOnWebsite(flow: WebFlow): Promise<Session | null> {
  const back = returnUrl();
  const url = `${SITE}/mobile/start?to=${flow}&return=${encodeURIComponent(back)}`;
  if (Platform.OS === "web") {
    window.location.href = url;
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, back);
  if (result.type !== "success") return null;
  const params = Linking.parse(result.url).queryParams ?? {};
  if (typeof params.error === "string") throw new Error("Не получилось войти. Попробуйте ещё раз.");
  if (typeof params.code !== "string") return null;
  return auth("exchange", { code: params.code });
}
