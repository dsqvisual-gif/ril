import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TabBar } from "@/components/TabBar";
import { useAccount } from "@/account/account-context";
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
  const { user, ready } = useAccount();
  // Wait for the saved sign-in, so the tabs do not flash before the welcome screens.
  if (!ready) return null;
  // Everything comes from the Uspeyka account, so signing in comes first.
  if (!user) return <Redirect href="/welcome" />;

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
