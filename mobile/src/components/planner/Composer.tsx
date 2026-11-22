import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { TITLE_MAX, type TaskInput } from "@/db/tasks";
import { radius, usePalette } from "@/theme/theme";

type Props = {
  date: string;
  onSubmit: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
};

/** The "new task" form under the list. */
export function Composer({ date, onSubmit, onCancel }: Props) {
  const c = usePalette();
  const [title, setTitle] = useState("");
  const [important, setImportant] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({ title, date, important, urgent });
      setTitle("");
      setImportant(false);
      setUrgent(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.inkSecondary }]}>Что сделать</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Например: позвонить маме"
        placeholderTextColor={c.inkTertiary}
        maxLength={TITLE_MAX}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
      />
      <Text style={[styles.label, { color: c.inkSecondary }]}>Приоритет</Text>
      <View style={styles.flags}>
        <Chip on={important} onPress={() => setImportant((v) => !v)} dot="#f0b429" label="Важно" onBg="#ffe08a" onInk="#7a4b00" />
        <Chip on={urgent} onPress={() => setUrgent((v) => !v)} dot="#ff3b30" label="Срочно" onBg="#ff3b30" onInk="#ffffff" />
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={[styles.btn, { borderColor: c.border }]}>
          <Text style={[styles.btnText, { color: c.ink }]}>Отмена</Text>
        </Pressable>
        <Pressable
          onPress={() => void submit()}
          disabled={!title.trim() || busy}
          style={[styles.btn, styles.primary, { backgroundColor: c.accent, opacity: title.trim() ? 1 : 0.5 }]}
        >
          <Text style={[styles.btnText, { color: c.onAccent }]}>Добавить</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Chip(props: { on: boolean; onPress: () => void; dot: string; label: string; onBg: string; onInk: string }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: props.on }}
      style={[
        styles.chip,
        { backgroundColor: props.on ? props.onBg : c.surfaceMuted, borderColor: props.on ? props.onBg : c.border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: props.on && props.onInk === "#ffffff" ? "#fff" : props.dot }]} />
      <Text style={[styles.chipText, { color: props.on ? props.onInk : c.inkSecondary }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  flags: { flexDirection: "row", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.pill, borderWidth: 1 },
  primary: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: "700" },
});
