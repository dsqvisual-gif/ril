import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { useSettings } from "@/theme/settings-context";
import { radius, usePalette } from "@/theme/theme";

export default function ProfileSettings() {
  const c = usePalette();
  const { settings, update } = useSettings();
  const [name, setName] = useState(settings.name);
  const clean = name.trim().replace(/\s+/g, " ");

  return (
    <SettingsScreen title="Профиль" lead="Имя нужно, чтобы приложение обращалось к вам. Всё хранится только на телефоне.">
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.label, { color: c.inkSecondary }]}>Имя</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Например: Аружан"
          placeholderTextColor={c.inkTertiary}
          maxLength={80}
          autoFocus={!settings.name}
          style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
        />
        <Pressable
          disabled={clean.length < 2}
          onPress={async () => {
            await update("name", clean);
            router.back();
          }}
          style={[styles.save, { backgroundColor: c.accent, opacity: clean.length < 2 ? 0.5 : 1 }]}
        >
          <Text style={styles.saveText}>Сохранить</Text>
        </Pressable>
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  save: { alignSelf: "flex-end", paddingHorizontal: 22, paddingVertical: 11, borderRadius: radius.pill },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
