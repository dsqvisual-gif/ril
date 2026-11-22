import { Suspense, useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrate } from "@/db/migrations";
import { useIsDark, usePalette } from "@/theme/theme";
import { SettingsProvider } from "@/theme/settings-context";
import { AccountProvider, useAccount } from "@/account/account-context";
import { installErrorReporting, reportAppError } from "@/account/report";

let reporting = false;

/** Instead of a blank screen: what happened, a retry button, and a report to the website. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    reportAppError(error, "error boundary");
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#f1f4fa" }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#1d1d1f" }}>Что-то пошло не так</Text>
      <Text style={{ fontSize: 15, color: "#6e6e73", textAlign: "center" }}>
        Мы уже получили отчёт об ошибке и починим её. Попробуйте ещё раз.
      </Text>
      <Text style={{ fontSize: 12, color: "#86868b", textAlign: "center" }}>{error.message}</Text>
      <Pressable onPress={() => void retry()} style={{ backgroundColor: "#007aff", paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999 }}>
        <Text style={{ color: "#fff", fontWeight: "800" }}>Попробовать снова</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const c = usePalette();
  useEffect(() => {
    if (reporting) return;
    reporting = true;
    installErrorReporting();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <Suspense
          fallback={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
              <ActivityIndicator color={c.accent} />
            </View>
          }
        >
          {/* The phone keeps a copy of the planner, so it also works without internet. */}
          <SQLiteProvider databaseName="uspeyka.db" onInit={migrate} useSuspense>
            <SettingsProvider>
              <AccountProvider>
                <ThemedStack />
              </AccountProvider>
            </SettingsProvider>
          </SQLiteProvider>
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Screens and the status bar, in the theme chosen in settings. Signed out, only the
 * sign-in screens exist; signed in, only the app. Expo Router moves between them
 * by itself when the account changes, so no screen is left blank.
 */
function ThemedStack() {
  const c = usePalette();
  const dark = useIsDark();
  const { user, ready } = useAccount();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const signedIn = Boolean(user);
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings/appearance" />
          <Stack.Screen name="settings/about" />
          <Stack.Screen name="settings/account" />
          <Stack.Screen name="settings/achievements" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="account/login" />
          <Stack.Screen name="account/register" />
          <Stack.Screen name="account/code" />
          <Stack.Screen name="account/forgot" />
          <Stack.Screen name="account/verify" />
          {/* Back from the website after Google or a web sign-in; welcome stays the first screen. */}
          <Stack.Screen name="auth" />
        </Stack.Protected>
      </Stack>
      <StatusBar style={dark ? "light" : "dark"} />
    </>
  );
}
