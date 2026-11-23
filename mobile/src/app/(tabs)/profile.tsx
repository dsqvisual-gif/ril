import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Application from "expo-application";
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
          <SettingsRow icon="person-circle-outline" tone="#e64980" title="Фото, имя и ник" onPress={() => router.push("/settings/profile")} />
          <SettingsRow icon="qr-code-outline" tone="#0ca678" title="Мой QR для друзей" onPress={() => router.push("/settings/qr")} last />
        </SettingsGroup>

        <SettingsGroup title="Режим">
          <SettingsRow
            icon="heart-outline"
            tone="#e8637a"
            title="Режим мамы"
            value={user?.momMode ? "Включён" : "Выключен"}
            onPress={() => router.push("/settings/modes")}
            last={!user?.momMode}
          />
          {user?.momMode ? (
            <SettingsRow icon="medkit-outline" tone="#e8637a" title="Прививки и визиты" onPress={() => router.push("/settings/health")} last />
          ) : null}
        </SettingsGroup>

        <SettingsGroup title="Приложение">
          <SettingsRow
            icon="color-palette-outline"
            tone="#7950f2"
            title="Оформление"
            value={settings.theme === "system" ? "Авто" : THEMES.find((t) => t.id === settings.theme)?.name}
            onPress={() => router.push("/settings/appearance")}
          />
          <SettingsRow
            icon="notifications-outline"
            tone="#f08c00"
            title="Уведомления и напоминания"
            onPress={() => router.push("/settings/notifications")}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Успехи">
          <SettingsRow
            icon="trophy-outline"
            tone="#d99a06"
            title="Достижения и мои цифры"
            onPress={() => router.push("/settings/achievements")}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Аккаунт">
          <SettingsRow
            icon="key-outline"
            tone="#0a84ff"
            title="Аккаунт и безопасность"
            onPress={() => router.push("/settings/account")}
          />
          <SettingsRow
            icon="help-circle-outline"
            tone="#5f6b7a"
            title="Помощь и документы"
            onPress={() => router.push("/settings/about")}
            last
          />
        </SettingsGroup>

        <Text style={[styles.version, { color: c.inkTertiary }]}>
          Uspeyka {Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? ""}
          {Application.nativeBuildVersion ? ` · сборка ${Application.nativeBuildVersion}` : ""}
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
