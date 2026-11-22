import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "@/theme/theme";

/** Placeholder for tabs that are still being built. */
export function ComingSoon({ title, text }: { title: string; text: string }) {
  const c = usePalette();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      <View style={styles.center}>
        <Image source={require("../../assets/mascot.webp")} style={styles.mascot} resizeMode="contain" />
        <Text style={[styles.text, { color: c.inkSecondary }]}>{text}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingBottom: 80 },
  mascot: { width: 160, height: 200 },
  text: { fontSize: 16, textAlign: "center", lineHeight: 22, maxWidth: 280 },
});
