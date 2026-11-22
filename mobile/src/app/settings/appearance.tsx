import { Pressable, StyleSheet, Text, View } from "react-native";
import { SettingsGroup, SettingsScreen } from "@/components/settings/SettingsUI";
import type { ThemePref } from "@/db/settings";
import { useSettings } from "@/theme/settings-context";
import { usePalette } from "@/theme/theme";

const OPTIONS: { id: ThemePref; title: string; hint: string }[] = [
  { id: "system", title: "Как в телефоне", hint: "Светлая днём, тёмная — когда тёмная в телефоне" },
  { id: "light", title: "Светлая", hint: "Всегда светлая" },
  { id: "dark", title: "Тёмная", hint: "Всегда тёмная — бережёт глаза вечером" },
];

export default function AppearanceSettings() {
  const c = usePalette();
  const { settings, update } = useSettings();
  return (
    <SettingsScreen title="Оформление" lead="Больше цветов, как на сайте, появится в следующих обновлениях.">
      <SettingsGroup>
        {OPTIONS.map((o, i) => {
          const on = settings.theme === o.id;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => void update("theme", o.id)}
              style={({ pressed }) => [
                styles.row,
                i < OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
                pressed && { backgroundColor: c.fill },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: c.ink }]}>{o.title}</Text>
                <Text style={[styles.hint, { color: c.inkSecondary }]}>{o.hint}</Text>
              </View>
              <View style={[styles.radio, { borderColor: on ? c.accent : c.inkTertiary }]}>
                {on ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </SettingsGroup>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: "600" },
  hint: { fontSize: 13, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 11, height: 11, borderRadius: 6 },
});
