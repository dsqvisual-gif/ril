import { useEffect } from "react";
import { router, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { TabBar } from "@/components/TabBar";
import { NotificationSync } from "@/notify/NotificationSync";
import { useSettings } from "@/theme/settings-context";
import { usePalette } from "@/theme/theme";

type Tab = {
  name: string;
  title: string;
  icon: (focused: boolean, color: string, size: number) => React.ReactNode;
  /** Shown in the usual mode, in mom mode, or both. */
  modes: ("usual" | "mom")[];
};

function ion(off: keyof typeof Ionicons.glyphMap, on: keyof typeof Ionicons.glyphMap) {
  return function TabIcon(focused: boolean, color: string, size: number) {
    return <Ionicons name={focused ? on : off} color={color} size={size} />;
  };
}
function mci(name: keyof typeof MaterialCommunityIcons.glyphMap) {
  return function TabIcon(_focused: boolean, color: string, size: number) {
    return <MaterialCommunityIcons name={name} color={color} size={size} />;
  };
}

// Declared with the planner first (the opening tab); the bar shows each mode's own order.
const TABS: Tab[] = [
  { name: "index", title: "Планер", icon: ion("calendar-outline", "calendar"), modes: ["usual", "mom"] },
  { name: "baby", title: "Малыш", icon: mci("baby-face-outline"), modes: ["mom"] },
  { name: "goals", title: "Цели", icon: ion("flag-outline", "flag"), modes: ["usual"] },
  { name: "team", title: "Команда", icon: ion("briefcase-outline", "briefcase"), modes: ["usual"] },
  { name: "friends", title: "Друзья", icon: ion("people-outline", "people"), modes: ["usual"] },
  { name: "food", title: "Прикорм", icon: mci("food-apple-outline"), modes: ["mom"] },
  { name: "stats", title: "Статистика", icon: ion("stats-chart-outline", "stats-chart"), modes: ["mom"] },
  { name: "profile", title: "Профиль", icon: ion("person-circle-outline", "person-circle"), modes: ["usual", "mom"] },
];

// As in the website's menu.
const ORDER = {
  usual: ["index", "goals", "team", "friends", "profile"],
  mom: ["baby", "index", "food", "stats", "profile"],
};

export default function TabsLayout() {
  const c = usePalette();
  const { settings } = useSettings();
  const mode = settings.mom ? "mom" : "usual";

  // In mom mode the app opens on the baby, as the website does.
  useEffect(() => {
    if (mode === "mom") router.navigate("/baby");
  }, [mode]);

  return (
    <>
    <NotificationSync />
    <Tabs
      // Switching the mode starts the tabs afresh, on the mode's first tab.
      key={mode}
      tabBar={(props) => <TabBar {...props} order={ORDER[mode]} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            href: t.modes.includes(mode) ? undefined : null,
            tabBarIcon: ({ focused, color, size }) => t.icon(focused, String(color), size),
          }}
        />
      ))}
    </Tabs>
    </>
  );
}
