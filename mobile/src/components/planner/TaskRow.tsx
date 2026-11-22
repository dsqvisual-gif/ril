import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Task } from "@/db/tasks";
import { radius, usePalette } from "@/theme/theme";

type Props = {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskRow({ task, onToggle, onDelete }: Props) {
  const c = usePalette();
  const carried = !task.done && task.originDate < task.date;
  const tint = task.done ? null : task.urgent ? c.tintDanger : task.important ? c.tintWarn : null;
  const edge = task.done ? c.border : task.urgent ? "#ff3b30" : task.important ? "#f0b429" : c.border;

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: tint ?? c.surface, borderColor: edge, opacity: task.done ? 0.6 : 1 },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.done ? "Снять отметку" : "Выполнить"}
        hitSlop={10}
        onPress={() => {
          if (!task.done) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onToggle(task);
        }}
        style={[
          styles.check,
          { borderColor: task.done ? c.success : c.accentSoft, backgroundColor: task.done ? c.success : "transparent" },
        ]}
      >
        {task.done ? <Text style={styles.tick}>✓</Text> : null}
      </Pressable>

      <View style={styles.body}>
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            { color: task.done ? c.inkTertiary : c.ink },
            task.done && styles.titleDone,
            (task.important || task.urgent) && !task.done && styles.titleStrong,
          ]}
        >
          {task.title}
        </Text>
        {task.urgent || task.important || task.time || carried ? (
          <View style={styles.meta}>
            {task.urgent ? (
              <Text style={[styles.flag, { backgroundColor: "#ff3b30", color: "#fff" }]}>СРОЧНО</Text>
            ) : null}
            {task.important ? (
              <Text style={[styles.flag, { backgroundColor: "#ffe08a", color: "#7a4b00" }]}>ВАЖНО</Text>
            ) : null}
            {task.time ? <Text style={[styles.time, { color: c.accent }]}>{task.time}</Text> : null}
            {carried ? <Text style={[styles.carried, { color: c.inkSecondary }]}>перенесено</Text> : null}
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Удалить"
        hitSlop={10}
        onPress={() => onDelete(task)}
        style={styles.delete}
      >
        <Text style={[styles.deleteText, { color: c.inkTertiary }]}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: { color: "#fff", fontWeight: "800", fontSize: 14 },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: "500" },
  titleStrong: { fontWeight: "700" },
  titleDone: { textDecorationLine: "line-through" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  flag: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  time: { fontSize: 13, fontWeight: "600" },
  carried: { fontSize: 13, fontWeight: "600" },
  delete: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  deleteText: { fontSize: 24, lineHeight: 26 },
});
