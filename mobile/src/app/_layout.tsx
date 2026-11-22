import { Suspense } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrate } from "@/db/migrations";
import { usePalette } from "@/theme/theme";

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
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
          </SQLiteProvider>
        </Suspense>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
