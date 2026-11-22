import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAccount } from "@/account/account-context";
import { needsWebsite, viaWebsite } from "@/account/finish";
import { ErrorText, GoogleButton, useStep } from "@/components/account/AuthUI";
import { radius, usePalette } from "@/theme/theme";

const STEPS = [
  {
    title: "Привет! Я Успейка",
    text: "Помогу всё успевать: дела на день, неделю и месяц — в одном спокойном месте.",
    points: [] as string[],
  },
  {
    title: "Важное не потеряется",
    text: "Отмечайте, что важно и что срочно — такие дела всегда сверху.",
    points: [
      "Невыполненное само переносится на сегодня",
      "Удалили по ошибке — нажмите «Отменить»",
      "Выполнили — отметьте кружок, это приятно",
    ],
  },
  {
    title: "Всё как на сайте",
    text: "Тот же аккаунт Uspeyka: дела, цели, друзья, команда и достижения — на телефоне и на сайте одинаковые.",
    points: [] as string[],
  },
];

export default function Welcome() {
  const c = usePalette();
  const { signIn } = useAccount();
  const google = useStep();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.top}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((v) => v - 1)} hitSlop={10}>
            <Text style={[styles.link, { color: c.accent }]}>‹ Назад</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {!last ? (
          <Pressable onPress={() => setStep(STEPS.length - 1)} hitSlop={10}>
            <Text style={[styles.link, { color: c.inkSecondary }]}>Пропустить</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Image
          source={step === 1 ? require("../../assets/mascot-peek.webp") : require("../../assets/mascot.webp")}
          style={step === 1 ? styles.peek : styles.mascot}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: c.ink }]}>{s.title}</Text>
        <Text style={[styles.text, { color: c.inkSecondary }]}>{s.text}</Text>
        {s.points.length > 0 ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {s.points.map((p) => (
              <Text key={p} style={[styles.point, { color: c.ink }]}>
                ✓  {p}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === step ? c.accent : c.track }, i === step && styles.dotOn]}
            />
          ))}
        </View>
        {last ? (
          <>
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
          </>
        ) : (
          <Pressable onPress={() => setStep((v) => v + 1)} style={[styles.primary, { backgroundColor: c.accent }]}>
            <Text style={styles.primaryText}>Дальше</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, minHeight: 32 },
  link: { fontSize: 16, fontWeight: "700" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 14 },
  mascot: { width: 170, height: 210 },
  peek: { width: 190, height: 150 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, textAlign: "center" },
  text: { fontSize: 17, lineHeight: 24, textAlign: "center", maxWidth: 340 },
  card: { alignSelf: "stretch", borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 8, marginTop: 4 },
  point: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  primary: { paddingVertical: 16, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  outline: { paddingVertical: 14, borderRadius: radius.pill, alignItems: "center", borderWidth: 1.5 },
  outlineText: { fontSize: 16, fontWeight: "800" },
});
