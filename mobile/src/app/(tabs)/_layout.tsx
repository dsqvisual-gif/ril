import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePalette } from "@/theme/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconOn: IconName }[] = [
  { name: "index", title: "Планер", icon: "calendar-outline", iconOn: "calendar" },
  { name: "goals", title: "Цели", icon: "flag-outline", iconOn: "flag" },
  { name: "achievements", title: "Достижения", icon: "trophy-outline", iconOn: "trophy" },
  { name: "profile", title: "Профиль", icon: "person-circle-outline", iconOn: "person-circle" },
];

export default function TabsLayout() {
  const c = usePalette();
  // Room for the labels above the home indicator; the default bar clipped them.
  const bottom = Math.max(useSafeAreaInsets().bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.inkTertiary,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 62 + bottom,
          paddingTop: 4,
          paddingBottom: bottom,
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, paddingBottom: 2, fontWeight: "600" },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? t.iconOn : t.icon} color={String(color)} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
