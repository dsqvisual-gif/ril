import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSettings } from "@/theme/settings-context";
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
    title: "Работает без интернета",
    text: "Дела хранятся прямо на телефоне. Аккаунт Uspeyka — по желанию, для друзей, команды и сайта.",
    points: [] as string[],
  },
];

export default function Welcome() {
  const c = usePalette();
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.name);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  async function finish(next: "/" | "/settings/account") {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length >= 2) await update("name", clean);
    await update("onboarded", true);
    router.replace("/");
    if (next !== "/") router.push(next);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
          {last ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Как вас зовут? (необязательно)"
              placeholderTextColor={c.inkTertiary}
              maxLength={80}
              returnKeyType="done"
              style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
            />
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
          <Pressable
            onPress={() => (last ? void finish("/") : setStep((v) => v + 1))}
            style={[styles.primary, { backgroundColor: c.accent }]}
          >
            <Text style={styles.primaryText}>{last ? "Начать" : "Дальше"}</Text>
          </Pressable>
          {last ? (
            <Pressable onPress={() => void finish("/settings/account")} style={styles.secondary}>
              <Text style={[styles.secondaryText, { color: c.accent }]}>У меня есть аккаунт на сайте</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
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
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginTop: 6,
  },
  bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  primary: { paddingVertical: 16, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  secondary: { paddingVertical: 8, alignItems: "center" },
  secondaryText: { fontSize: 15, fontWeight: "700" },
});
