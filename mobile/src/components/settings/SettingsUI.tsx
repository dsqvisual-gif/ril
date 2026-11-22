import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { radius, usePalette } from "@/theme/theme";

/** A settings line, like on the website and in phone settings. */
export function SettingsRow(props: {
  icon: string;
  tone: string;
  title: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const c = usePalette();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      accessibilityRole={props.onPress ? "button" : undefined}
      style={({ pressed }) => [
        styles.row,
        !props.last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
        pressed && { backgroundColor: c.fill },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: props.tone }]}>
        <Text style={styles.iconText}>{props.icon}</Text>
      </View>
      <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>
        {props.title}
      </Text>
      {props.value ? (
        <Text style={[styles.value, { color: c.inkTertiary }]} numberOfLines={1}>
          {props.value}
        </Text>
      ) : null}
      {props.onPress ? <Text style={[styles.chevron, { color: c.inkTertiary }]}>›</Text> : null}
    </Pressable>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={styles.group}>
      {title ? <Text style={[styles.groupTitle, { color: c.inkTertiary }]}>{title.toUpperCase()}</Text> : null}
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
    </View>
  );
}

/** A settings section screen: "‹ Настройки", title, content. */
export function SettingsScreen({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} hitSlop={8}>
          <Text style={[styles.back, { color: c.accent }]}>‹ Настройки</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
        {lead ? <Text style={[styles.lead, { color: c.inkSecondary }]}>{lead}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14 },
  icon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 17 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: "600" },
  value: { fontSize: 14, maxWidth: "45%" },
  chevron: { fontSize: 24, lineHeight: 26 },
  group: { gap: 7 },
  groupTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, paddingLeft: 14 },
  box: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  screen: { padding: 16, paddingBottom: 60, gap: 16 },
  back: { fontSize: 16, fontWeight: "700" },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: -6 },
  lead: { fontSize: 15, lineHeight: 21, marginTop: -8 },
});
