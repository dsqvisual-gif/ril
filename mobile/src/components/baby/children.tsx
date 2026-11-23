import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRpc } from "@/account/use-rpc";
import type { Child } from "@/shared/baby";
import { radius, usePalette } from "@/theme/theme";

// The chosen child is shared by the baby, food and stats tabs.
let chosen: string | null = null;

/** The person's children (own and shared), reloaded when a tab opens. */
export function useChildren() {
  const call = useRpc();
  const [kids, setKids] = useState<Child[] | null>(null);
  const [childId, setChildIdState] = useState<string | null>(chosen);
  const [error, setError] = useState<string | null>(null);

  const setChildId = useCallback((id: string | null) => {
    chosen = id;
    setChildIdState(id);
  }, []);

  const reload = useCallback(async () => {
    try {
      const rows = await call<Child[]>("baby.children");
      setKids(rows);
      setError(null);
      const keep = rows.some((k) => k.id === chosen) ? chosen : (rows[0]?.id ?? null);
      setChildId(keep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось загрузить");
    }
  }, [call, setChildId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const child = kids?.find((k) => k.id === childId) ?? null;
  return { kids, setKids, child, childId, setChildId, reload, error };
}

export function BabyIcon({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  return <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} color={color} size={size} />;
}

/** Child switcher chips; the chosen one is tapped again to edit it. */
export function ChildChips({
  kids,
  childId,
  onChange,
  onEdit,
  onAdd,
}: {
  kids: Child[];
  childId: string | null;
  onChange: (id: string) => void;
  onEdit?: (child: Child) => void;
  onAdd?: () => void;
}) {
  const c = usePalette();
  if (kids.length < 2 && !onAdd && !onEdit) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {kids.map((k) => {
        const on = k.id === childId;
        return (
          <Pressable
            key={k.id}
            onPress={() => (on ? onEdit?.(k) : onChange(k.id))}
            style={[styles.chip, { backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.accent : c.border }]}
          >
            <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700" }}>{k.name}</Text>
            {on && onEdit ? <BabyIcon name="pencil-outline" color={c.onAccent} size={14} /> : null}
          </Pressable>
        );
      })}
      {onAdd ? (
        <Pressable onPress={onAdd} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.accent, fontWeight: "700" }}>+ ребёнок</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
});

export function Empty({ text }: { text: string }) {
  const c = usePalette();
  return (
    <View style={{ padding: 24, alignItems: "center" }}>
      <Text style={{ color: c.inkSecondary, textAlign: "center", lineHeight: 21, fontSize: 15 }}>{text}</Text>
    </View>
  );
}
