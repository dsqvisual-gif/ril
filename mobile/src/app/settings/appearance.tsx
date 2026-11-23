import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SettingsGroup, SettingsScreen } from "@/components/settings/SettingsUI";
import type { ThemePref } from "@/db/settings";
import { useStore } from "@/db/store-types";
import { useRpc } from "@/account/use-rpc";
import { useSettings } from "@/theme/settings-context";
import { THEMES } from "@/theme/themes";
import { radius, usePalette } from "@/theme/theme";

/** The same colour themes as on the website; the choice goes to the account too. */
export default function AppearanceSettings() {
  const c = usePalette();
  const system = useColorScheme();
  const store = useStore();
  const call = useRpc();
  const { settings, update } = useSettings();

  async function choose(id: ThemePref) {
    await update("theme", id);
    if (id === "system") return;
    await store.setSetting("account_theme_seen", id);
    // Saved to the account so the website and other phones get it; offline it stays here.
    call("account.setTheme", id).catch(() => {});
  }

  const options: { id: ThemePref; name: string; swatch: [string, string, string] }[] = [
    {
      id: "system",
      name: "Авто",
      swatch: system === "dark" ? ["#0f1115", "#1b1e24", "#4c9dff"] : ["#f5f7fb", "#ffffff", "#007aff"],
    },
    ...THEMES,
  ];

  return (
    <SettingsScreen title="Оформление" lead="Те же темы, что на сайте, и сохраняются в аккаунте. «Авто» — светлая или тёмная, как в телефоне.">
      <SettingsGroup title="Тема">
        <View style={styles.grid}>
          {options.map((o) => {
            const on = settings.theme === o.id;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => void choose(o.id)}
                style={[styles.tile, { borderColor: on ? c.accent : c.border, backgroundColor: c.surface }]}
              >
                <View style={[styles.preview, { backgroundColor: o.swatch[0] }]}>
                  <View style={[styles.card, { backgroundColor: o.swatch[1] }]}>
                    <View style={[styles.line, { backgroundColor: o.swatch[2] }]} />
                    <View style={[styles.line, styles.short, { backgroundColor: o.swatch[2], opacity: 0.35 }]} />
                  </View>
                </View>
                <Text style={[styles.name, { color: on ? c.accent : c.ink }]} numberOfLines={1}>
                  {on ? "✓ " : ""}
                  {o.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SettingsGroup>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 10 },
  tile: { width: "31%", flexGrow: 1, borderWidth: 2, borderRadius: radius.md, padding: 6, gap: 6 },
  preview: { height: 64, borderRadius: radius.sm, padding: 8, justifyContent: "center" },
  card: { borderRadius: 8, padding: 7, gap: 5 },
  line: { height: 6, borderRadius: 3 },
  short: { width: "60%" },
  name: { fontSize: 13, fontWeight: "700", textAlign: "center" },
});
