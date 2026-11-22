import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.inkTertiary,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
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
