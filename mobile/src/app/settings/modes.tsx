import { useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useAccount } from "@/account/account-context";
import type { AccountUser } from "@/account/api";
import { useRpc } from "@/account/use-rpc";
import { BabyIcon } from "@/components/baby/children";
import { errorText } from "@/components/dialogs";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { radius, usePalette } from "@/theme/theme";

/** The usual mode or mom mode, the same switch as on the website. */
export default function ModesSettings() {
  const c = usePalette();
  const call = useRpc();
  const { user, replaceUser } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = Boolean(user?.momMode);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await replaceUser(await call<AccountUser>("account.setMomMode", next));
      router.replace(next ? "/baby" : "/");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsScreen title="Режим" lead="Обычный режим — планер, цели, друзья и команда. Режим мамы добавляет трекер малыша, а личный планер остаётся рядом.">
      <View style={[styles.card, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.border }]}>
        <View style={[styles.icon, { backgroundColor: "rgba(232,99,122,0.15)" }]}>
          <BabyIcon name="mother-nurse" color="#e8637a" size={26} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: c.ink, fontWeight: "800", fontSize: 17 }}>Режим мамы</Text>
          <Text style={{ color: c.inkSecondary, fontSize: 14, lineHeight: 20 }}>
            Трекер малыша: сон, кормления, подгузники, прикорм, рост и вес — и статистика. Меню становится короче, оформление — мягче.
          </Text>
        </View>
        {busy ? <ActivityIndicator color={c.accent} /> : <Switch value={on} onValueChange={(v) => void toggle(v)} />}
      </View>
      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: radius.lg, padding: 14 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
