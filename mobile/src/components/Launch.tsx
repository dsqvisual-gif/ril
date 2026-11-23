import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Mascot } from "@/components/Mascot";

/** While the app starts: the mascot appears, the name fades in, the bubble "types". */
export function Launch({ bg = "#f1f4fa", ink = "#1d1d1f" }: { bg?: string; ink?: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.back(1.6)) });
  }, [v]);
  const pop = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.85 + 0.15 * v.value }, { translateY: (1 - v.value) * 24 }] }));
  const name = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 10 }] }));
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Animated.View style={pop}>
        <Mascot width={130} bubble />
      </Animated.View>
      <Animated.View style={[{ alignItems: "center", gap: 4 }, name]}>
        <Text style={[styles.title, { color: ink }]}>Uspeyka</Text>
        <Text style={styles.sub}>Загружаем ваши дела…</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  sub: { fontSize: 15, color: "#86868b" },
});
