import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { radius, usePalette } from "@/theme/theme";

/** For features that work through an Uspeyka account: friends, teams. */
export function NeedsAccount({ title, text, points }: { title: string; text: string; points: string[] }) {
  const c = usePalette();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      <View style={styles.center}>
        <Image source={require("../../assets/mascot.webp")} style={styles.mascot} resizeMode="contain" />
        <Text style={[styles.text, { color: c.ink }]}>{text}</Text>
        <View style={styles.points}>
          {points.map((p) => (
            <Text key={p} style={[styles.point, { color: c.inkSecondary }]}>
              •  {p}
            </Text>
          ))}
        </View>
        <Pressable
          onPress={() => router.push("/settings/account")}
          style={[styles.btn, { backgroundColor: c.accent }]}
        >
          <Text style={styles.btnText}>Войти или зарегистрироваться</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 30 },
  mascot: { width: 130, height: 160 },
  text: { fontSize: 17, fontWeight: "600", textAlign: "center", lineHeight: 23, maxWidth: 320 },
  points: { gap: 4, alignSelf: "stretch", paddingHorizontal: 24 },
  point: { fontSize: 15, lineHeight: 21 },
  btn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 14, borderRadius: radius.pill },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
