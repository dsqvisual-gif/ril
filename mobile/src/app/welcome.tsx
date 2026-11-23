import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useAccount } from "@/account/account-context";
import { needsWebsite, viaWebsite } from "@/account/finish";
import { ErrorText, useStep } from "@/components/account/AuthUI";
import { GoogleLogo } from "@/components/GoogleLogo";
import { Mascot } from "@/components/Mascot";
import { Icon, type IconName } from "@/components/ui";
import { radius, usePalette } from "@/theme/theme";

const FEATURES: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: "checkmark-done-circle", color: "#007aff", title: "Дела на каждый день", text: "Списки покупок, заметки, время и дела вместе с друзьями" },
  { icon: "flag", color: "#0ca678", title: "Цели с прогрессом", text: "Разбейте цель на шаги и отмечайте, что уже сделано" },
  { icon: "briefcase", color: "#7950f2", title: "Работа в команде", text: "Задачи с исполнителями, сроками и графиком загрузки" },
  { icon: "heart", color: "#e8637a", title: "Режим мамы", text: "Сон, кормления, прикорм и прививки малыша в одно касание" },
];

/** Signed out: a lively first screen with what the app does, and the ways to sign in. */
export default function Welcome() {
  const c = usePalette();
  const { signIn } = useAccount();
  const google = useStep();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % FEATURES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [float]);
  const blobA = useAnimatedStyle(() => ({ transform: [{ translateX: -20 + float.value * 40 }, { translateY: float.value * 30 }] }));
  const blobB = useAnimatedStyle(() => ({ transform: [{ translateX: 20 - float.value * 40 }, { translateY: -float.value * 26 }] }));

  const f = FEATURES[slide];

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Animated.View style={[styles.blob, { backgroundColor: `${c.accent}26`, top: -80, left: -70 }, blobA]} />
      <Animated.View style={[styles.blob, { backgroundColor: "#ffd8a833", width: 300, height: 300, top: 220, right: -140 }, blobB]} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.top}>
          <Animated.View entering={FadeInDown.duration(600).springify()}>
            <Mascot width={150} bubble />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(120).duration(600)} style={[styles.title, { color: c.ink }]}>
            Uspeyka
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).duration(600)} style={[styles.tagline, { color: c.inkSecondary }]}>
            Планер, который помогает успевать
          </Animated.Text>

          <Animated.View entering={FadeIn.delay(350)} style={[styles.feature, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Animated.View key={slide} entering={FadeIn.duration(350)} exiting={FadeOut.duration(200)} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: `${f.color}1f` }]}>
                <Icon name={f.icon} color={f.color} size={24} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.featureTitle, { color: c.ink }]}>{f.title}</Text>
                <Text style={[styles.featureText, { color: c.inkSecondary }]}>{f.text}</Text>
              </View>
            </Animated.View>
            <View style={styles.dots}>
              {FEATURES.map((x, i) => (
                <Pressable key={x.title} onPress={() => setSlide(i)} hitSlop={8} accessibilityLabel={x.title}>
                  <View style={[styles.dot, { backgroundColor: i === slide ? c.accent : c.track, width: i === slide ? 18 : 7 }]} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.bottom}>
          <Pressable
            onPress={() => router.push("/account/login")}
            style={({ pressed }) => [styles.primary, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.primaryText, { color: c.onAccent }]}>Войти</Text>
          </Pressable>
          <Pressable
            onPress={() => (needsWebsite() ? void viaWebsite("register", signIn) : router.push("/account/register"))}
            style={({ pressed }) => [styles.outline, { borderColor: c.accent, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.outlineText, { color: c.accent }]}>Создать аккаунт</Text>
          </Pressable>
          <Pressable
            onPress={() => void google.run(() => viaWebsite("google", signIn))}
            disabled={google.busy}
            style={({ pressed }) => [styles.google, { backgroundColor: c.surface, borderColor: c.border, opacity: google.busy || pressed ? 0.7 : 1 }]}
          >
            <GoogleLogo size={20} />
            <Text style={[styles.googleText, { color: c.ink }]}>{google.busy ? "Открываем Google…" : "Продолжить с Google"}</Text>
          </Pressable>
          <ErrorText text={google.error} />
          <Text style={[styles.legal, { color: c.inkTertiary }]}>Тот же аккаунт, что на сайте uspeyka.com</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  blob: { position: "absolute", width: 320, height: 320, borderRadius: 999 },
  top: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, gap: 10 },
  title: { fontSize: 38, fontWeight: "800", letterSpacing: -1.2, marginTop: 4 },
  tagline: { fontSize: 17, textAlign: "center" },
  feature: { alignSelf: "stretch", borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 12, marginTop: 14, minHeight: 104 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 16, fontWeight: "800" },
  featureText: { fontSize: 14, lineHeight: 19 },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center" },
  dot: { height: 7, borderRadius: 4 },
  bottom: { paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  primary: { paddingVertical: 16, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { fontSize: 17, fontWeight: "800" },
  outline: { paddingVertical: 14, borderRadius: radius.pill, alignItems: "center", borderWidth: 1.5 },
  outlineText: { fontSize: 16, fontWeight: "800" },
  google: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1 },
  googleText: { fontSize: 16, fontWeight: "700" },
  legal: { fontSize: 12, textAlign: "center", marginTop: 2 },
});
