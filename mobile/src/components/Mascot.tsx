import { useEffect } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const RATIO = 1028 / 640;

/**
 * The mascot, alive as on the website: it sways, breathes and blinks, and can show
 * a "typing" bubble while something loads.
 */
export function Mascot({ width = 150, bubble = false, style }: { width?: number; bubble?: boolean; style?: StyleProp<ViewStyle> }) {
  const sway = useSharedValue(0);
  const breathe = useSharedValue(0);
  const blink = useSharedValue(0);

  useEffect(() => {
    sway.value = withRepeat(withTiming(1, { duration: 2750, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    blink.value = withRepeat(
      withSequence(withDelay(3800, withTiming(1, { duration: 90 })), withTiming(1, { duration: 80 }), withTiming(0, { duration: 110 })),
      -1,
      false,
    );
  }, [sway, breathe, blink]);

  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: width * RATIO * 0.5 },
      { rotate: `${-2 + sway.value * 4}deg` },
      { translateY: -width * RATIO * 0.5 },
      { scaleX: 1 + breathe.value * 0.012 },
      { scaleY: 1 - breathe.value * 0.015 },
    ],
  }));
  const lids = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const shadow = useAnimatedStyle(() => ({ transform: [{ scale: 1 - breathe.value * 0.06 }], opacity: 1 - breathe.value * 0.2 }));
  const h = width * RATIO;

  return (
    <View style={[{ width, alignItems: "center", paddingTop: bubble ? 46 : 0 }, style]} accessible={false}>
      {bubble ? <Typing style={{ position: "absolute", top: 0, right: -width * 0.18 }} /> : null}
      <Animated.View style={[{ width, height: h }, body]}>
        <Image source={require("../../assets/mascot.webp")} style={{ width, height: h }} resizeMode="contain" />
        <Animated.View style={[styles.lid, { left: "35.1%", top: "33.2%", width: "7.8%", height: "11.6%", backgroundColor: "#efebec" }, lids]} />
        <Animated.View style={[styles.lid, { left: "63.4%", top: "33.2%", width: "7.8%", height: "11.6%", backgroundColor: "#f2eeef" }, lids]} />
      </Animated.View>
      <Animated.View style={[styles.shadow, { width: width * 0.72, height: Math.max(10, width * 0.08) }, shadow]} />
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 380 }), withTiming(0, { duration: 540 })), -1, false));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * v.value }], opacity: 0.35 + 0.65 * v.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** "…" — the mascot is busy. */
export function Typing({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.bubble, style]}>
      <Dot delay={0} />
      <Dot delay={180} />
      <Dot delay={360} />
    </View>
  );
}

const styles = StyleSheet.create({
  lid: { position: "absolute", borderRadius: 999, transformOrigin: "50% 0%" },
  shadow: { marginTop: -6, borderRadius: 999, backgroundColor: "rgba(30,60,150,0.13)" },
  bubble: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: "rgba(255,255,255,0.97)",
    shadowColor: "#1e3c8c",
    shadowOpacity: 0.14,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#1757f5" },
});
