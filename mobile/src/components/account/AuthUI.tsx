import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { radius, usePalette } from "@/theme/theme";
import { GoogleLogo } from "@/components/GoogleLogo";

/** Frame of the sign-in screens: back link, mascot, title, explanation. */
export function AuthFrame({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} hitSlop={8}>
            <Text style={[styles.back, { color: c.accent }]}>‹ Назад</Text>
          </Pressable>
          <Image source={require("../../../assets/mascot-peek.webp")} style={styles.mascot} resizeMode="contain" />
          <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
          {lead ? <Text style={[styles.lead, { color: c.inkSecondary }]}>{lead}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PrimaryButton({ title, onPress, busy, disabled }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.primary, { backgroundColor: c.accent, opacity: busy || disabled ? 0.6 : 1 }]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.linkWrap}>
      <Text style={[styles.link, { color: c.accent }]}>{title}</Text>
    </Pressable>
  );
}

export function GoogleButton({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.google, { backgroundColor: c.surface, borderColor: c.border, opacity: busy ? 0.6 : 1 }]}
    >
      <GoogleLogo size={20} />
      <Text style={[styles.googleText, { color: c.ink }]}>Продолжить с Google</Text>
    </Pressable>
  );
}

export function Divider() {
  const c = usePalette();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: c.border }]} />
      <Text style={[styles.or, { color: c.inkTertiary }]}>или</Text>
      <View style={[styles.line, { backgroundColor: c.border }]} />
    </View>
  );
}

export function ErrorText({ text }: { text: string | null }) {
  const c = usePalette();
  return text ? <Text style={[styles.error, { color: c.danger }]}>{text}</Text> : null;
}

/** Busy and error state around an async step. */
export function useStep() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40, gap: 10 },
  back: { fontSize: 16, fontWeight: "700" },
  mascot: { width: 110, height: 86, alignSelf: "center", marginTop: 4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, textAlign: "center" },
  lead: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  body: { gap: 14, marginTop: 10 },
  primary: { paddingVertical: 15, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  linkWrap: { alignSelf: "center", paddingVertical: 4 },
  link: { fontSize: 15, fontWeight: "700" },
  google: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  googleText: { fontSize: 16, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: 13 },
  error: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
