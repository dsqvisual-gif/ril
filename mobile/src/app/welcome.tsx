import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAccount } from "@/account/account-context";
import { needsWebsite, viaWebsite } from "@/account/finish";
import { ErrorText, GoogleButton, useStep } from "@/components/account/AuthUI";
import { radius, usePalette } from "@/theme/theme";

/** The first screen when signed out: straight to signing in or creating an account. */
export default function Welcome() {
  const c = usePalette();
  const { signIn } = useAccount();
  const google = useStep();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.body}>
        <Image source={require("../../assets/mascot.webp")} style={styles.mascot} resizeMode="contain" />
        <Text style={[styles.title, { color: c.ink }]}>Uspeyka</Text>
        <Text style={[styles.text, { color: c.inkSecondary }]}>
          Планер дел и целей. Войдите в аккаунт — тот же, что на сайте uspeyka.com.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Pressable onPress={() => router.push("/account/login")} style={[styles.primary, { backgroundColor: c.accent }]}>
          <Text style={styles.primaryText}>Войти</Text>
        </Pressable>
        <Pressable
          onPress={() => (needsWebsite() ? void viaWebsite("register", signIn) : router.push("/account/register"))}
          style={[styles.outline, { borderColor: c.accent }]}
        >
          <Text style={[styles.outlineText, { color: c.accent }]}>Создать аккаунт</Text>
        </Pressable>
        <GoogleButton busy={google.busy} onPress={() => void google.run(() => viaWebsite("google", signIn))} />
        <ErrorText text={google.error} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 12 },
  mascot: { width: 170, height: 210 },
  title: { fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  text: { fontSize: 17, lineHeight: 24, textAlign: "center", maxWidth: 330 },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  primary: { paddingVertical: 16, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  outline: { paddingVertical: 14, borderRadius: radius.pill, alignItems: "center", borderWidth: 1.5 },
  outlineText: { fontSize: 16, fontWeight: "800" },
});
