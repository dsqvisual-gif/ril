import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TabBar } from "@/components/TabBar";
import { useSettings } from "@/theme/settings-context";
import { usePalette } from "@/theme/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconOn: IconName }[] = [
  { name: "index", title: "Планер", icon: "calendar-outline", iconOn: "calendar" },
  { name: "goals", title: "Цели", icon: "flag-outline", iconOn: "flag" },
  { name: "team", title: "Команда", icon: "briefcase-outline", iconOn: "briefcase" },
  { name: "friends", title: "Друзья", icon: "people-outline", iconOn: "people" },
  { name: "profile", title: "Профиль", icon: "person-circle-outline", iconOn: "person-circle" },
];

export default function TabsLayout() {
  const c = usePalette();
  const { settings, loaded } = useSettings();
  // First launch: the welcome screens come first.
  if (loaded && !settings.onboarded) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
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
