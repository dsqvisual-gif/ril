import { Alert, Platform } from "react-native";

/** "Are you sure?" that works on phones and in the browser version. */
export function confirmAsk(title: string, message: string | undefined, ok: string, run: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) run();
    return;
  }
  Alert.alert(title, message, [
    { text: "Отмена", style: "cancel" },
    { text: ok, style: "destructive", onPress: run },
  ]);
}

export function notify(text: string) {
  if (Platform.OS === "web") window.alert(text);
  else Alert.alert(text);
}

export function errorText(e: unknown, fallback = "Не получилось. Попробуйте ещё раз."): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
