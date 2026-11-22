import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAccount } from "@/account/account-context";
import { needsWebsite, viaWebsite } from "@/account/finish";
import { ErrorText, GoogleButton, PrimaryButton, useStep } from "@/components/account/AuthUI";
import { AccountAvatar } from "@/components/AccountAvatar";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { radius, usePalette } from "@/theme/theme";

export default function AccountSettings() {
  const c = usePalette();
  const { user, signIn, signOut } = useAccount();
  const google = useStep();

  if (user) {
    return (
      <SettingsScreen title="Аккаунт Uspeyka">
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.row}>
            <AccountAvatar name={user.name} uri={user.avatar} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.ink }]}>{user.name}</Text>
              {user.username ? <Text style={[styles.sub, { color: c.accent }]}>@{user.username}</Text> : null}
              <Text style={[styles.sub, { color: c.inkSecondary }]}>{user.email}</Text>
            </View>
          </View>
          <Text style={[styles.note, { color: c.inkSecondary }]}>
            Это тот же аккаунт, что на сайте: дела, цели, друзья и команда одинаковые и там, и тут.
          </Text>
        </View>
        <Pressable
          onPress={() => {
            const go = () => void signOut();
            if (Platform.OS === "web") go();
            else
              Alert.alert("Выйти из аккаунта?", "Чтобы снова видеть дела, нужно будет войти.", [
                { text: "Отмена", style: "cancel" },
                { text: "Выйти", style: "destructive", onPress: go },
              ]);
          }}
          style={[styles.logout, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Text style={[styles.logoutText, { color: c.danger }]}>Выйти из аккаунта</Text>
        </Pressable>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen
      title="Аккаунт Uspeyka"
      lead="Один аккаунт для сайта и приложения. Планер работает и без него — аккаунт нужен для друзей, команды и сайта."
    >
      <View style={styles.hero}>
        <Image source={require("../../../assets/mascot.webp")} style={styles.mascot} resizeMode="contain" />
      </View>
      <PrimaryButton title="Войти" onPress={() => router.push("/account/login")} />
      <Pressable
        onPress={() => (needsWebsite() ? void viaWebsite("register", signIn) : router.push("/account/register"))}
        style={[styles.secondary, { borderColor: c.accent }]}
      >
        <Text style={[styles.secondaryText, { color: c.accent }]}>Создать аккаунт</Text>
      </Pressable>
      <GoogleButton busy={google.busy} onPress={() => void google.run(() => viaWebsite("google", signIn))} />
      <ErrorText text={google.error} />
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontSize: 18, fontWeight: "800" },
  sub: { fontSize: 14, marginTop: 2 },
  note: { fontSize: 14, lineHeight: 20 },
  logout: { borderRadius: radius.lg, borderWidth: 1, paddingVertical: 15, alignItems: "center" },
  logoutText: { fontSize: 16, fontWeight: "700" },
  hero: { alignItems: "center" },
  mascot: { width: 120, height: 150 },
  secondary: { paddingVertical: 14, borderRadius: radius.pill, alignItems: "center", borderWidth: 1.5 },
  secondaryText: { fontSize: 16, fontWeight: "800" },
});
