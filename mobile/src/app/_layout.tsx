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
          {/* Everything lives on the phone: the planner works without internet. */}
          <SQLiteProvider databaseName="uspeyka.db" onInit={migrate} useSuspense>
            <SettingsProvider>
              <ThemedStack />
            </SettingsProvider>
          </SQLiteProvider>
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Screens and the status bar, in the theme chosen in settings. */
function ThemedStack() {
  const c = usePalette();
  const dark = useIsDark();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
      <StatusBar style={dark ? "light" : "dark"} />
    </>
  );
}
