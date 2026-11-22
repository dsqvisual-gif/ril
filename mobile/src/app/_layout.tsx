import { Suspense } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrate } from "@/db/migrations";
import { useIsDark, usePalette } from "@/theme/theme";
import { SettingsProvider } from "@/theme/settings-context";
import { AccountProvider, useAccount } from "@/account/account-context";

export default function RootLayout() {
  const c = usePalette();
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
