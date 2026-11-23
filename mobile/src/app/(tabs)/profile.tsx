import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsUI";
import { useSettings } from "@/theme/settings-context";
import { useAccount } from "@/account/account-context";
import { AccountAvatar } from "@/components/AccountAvatar";
import { radius, usePalette } from "@/theme/theme";
import { THEMES } from "@/theme/themes";


export default function SettingsHub() {
  const c = usePalette();
  const { settings } = useSettings();
  const { user } = useAccount();
  const name = user?.name ?? "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.root}>
        <Text style={[styles.title, { color: c.ink }]}>Настройки</Text>

        <Pressable
          onPress={() => router.push("/settings/profile")}
          style={({ pressed }) => [
            styles.profile,
            { backgroundColor: pressed ? c.fill : c.surface, borderColor: c.border },
          ]}
        >
          <AccountAvatar name={name} uri={user?.avatar} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.sub, { color: c.inkSecondary }]} numberOfLines={1}>
              {user?.username ? `@${user.username}` : user?.email}
            </Text>
          </View>
          <Text style={[styles.edit, { color: c.accent }]}>Изменить ›</Text>
        </Pressable>

        <SettingsGroup title="Профиль">
          <SettingsRow icon="🙂" tone="#ffe8ef" title="Фото, имя и ник" onPress={() => router.push("/settings/profile")} />
          <SettingsRow icon="🔳" tone="#e6f4ea" title="Мой QR для друзей" onPress={() => router.push("/settings/qr")} last />
        </SettingsGroup>

        <SettingsGroup title="Приложение">
          <SettingsRow
            icon="🎨"
            tone="#e7e4ff"
            title="Оформление"
            value={settings.theme === "system" ? "Авто" : THEMES.find((t) => t.id === settings.theme)?.name}
            onPress={() => router.push("/settings/appearance")}
          />
          <SettingsRow
            icon="🔔"
            tone="#dff1ff"
            title="Уведомления и напоминания"
            onPress={() => router.push("/settings/notifications")}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Успехи">
          <SettingsRow
            icon="🏆"
            tone="#fff1d6"
            title="Достижения и мои цифры"
            onPress={() => router.push("/settings/achievements")}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Аккаунт">
          <SettingsRow
            icon="🔐"
            tone="#eceef3"
            title="Аккаунт и безопасность"
            onPress={() => router.push("/settings/account")}
          />
          <SettingsRow
            icon="💡"
            tone="#fff6c7"
            title="Помощь и документы"
            onPress={() => router.push("/settings/about")}
            last
          />
        </SettingsGroup>

        <Text style={[styles.version, { color: c.inkTertiary }]}>
          Uspeyka {Constants.expoConfig?.version ?? ""}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, paddingBottom: 40, gap: 18 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  name: { fontSize: 17, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 2 },
  edit: { fontSize: 14, fontWeight: "700" },
  version: { textAlign: "center", fontSize: 12 },
});
