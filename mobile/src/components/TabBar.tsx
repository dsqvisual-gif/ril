import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import * as Haptics from "expo-haptics";
import { radius, usePalette } from "@/theme/theme";

/** A floating rounded tab bar; the open tab is a blue pill. */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const c = usePalette();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: c.bg }]}>
      <View
        style={[styles.bar, { backgroundColor: c.surface, borderColor: c.border }]}
        accessibilityRole="tablist"
      >
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === "string" ? options.title : route.name;
          const color = focused ? c.onAccent : c.inkSecondary;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  void Haptics.selectionAsync();
                  navigateToTab(route.key);
                }
              }}
              style={[styles.item, focused && { backgroundColor: c.accent }]}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6 },
  bar: {
    flexDirection: "row",
    padding: 6,
    gap: 4,
    borderRadius: 26,
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 7,
    borderRadius: radius.lg,
  },
  label: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
});
