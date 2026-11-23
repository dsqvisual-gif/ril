import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useStore } from "@/db/store-types";
import { Button, IconBadge, Icon } from "@/components/ui";
import { radius, usePalette } from "@/theme/theme";
import { askPermission, notifyChanged, NOTIFY_SUPPORTED, permission } from "./notify";

const DISMISSED = "notify_prompt_dismissed";

/** A one-time card on the planner: allow notifications so tasks are not missed. */
export function NotifyPrompt() {
  const c = usePalette();
  const store = useStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!NOTIFY_SUPPORTED) return;
    let alive = true;
    void (async () => {
      const [p, dismissed] = await Promise.all([permission(), store.getSetting(DISMISSED)]);
      if (alive) setShow(p === "undetermined" && !dismissed);
    })();
    return () => {
      alive = false;
    };
  }, [store]);

  if (!show) return null;
  const hide = () => {
    setShow(false);
    void store.setSetting(DISMISSED, "1");
  };
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.accent }]}>
      <View style={styles.row}>
        <IconBadge name="notifications" color={c.accent} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontWeight: "800", fontSize: 16 }}>Включите уведомления</Text>
          <Text style={{ color: c.inkSecondary, fontSize: 14, lineHeight: 19 }}>Напомним о делах со временем, покажем план на утро и сроки задач команды.</Text>
        </View>
        <Pressable onPress={hide} hitSlop={10} accessibilityLabel="Скрыть">
          <Icon name="close" color={c.inkTertiary} />
        </Pressable>
      </View>
      <Button
        title="Разрешить уведомления"
        full
        onPress={() =>
          void askPermission().then((p) => {
            hide();
            if (p === "granted") notifyChanged();
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: 14, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});
