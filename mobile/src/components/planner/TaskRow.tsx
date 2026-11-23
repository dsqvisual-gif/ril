import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Swipeable, { SwipeDirection, type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import type { Task, TaskItem } from "@/account/api";
import { Icon } from "@/components/ui";
import { radius, usePalette } from "@/theme/theme";

type Props = {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTomorrow: (task: Task) => void;
  onEdit: (task: Task) => void;
  onItemToggle: (task: Task, item: TaskItem) => void;
  onItemAdd: (task: Task, text: string) => void;
  onItemRemove: (task: Task, item: TaskItem) => void;
};

/**
 * A task as on the website: tap to open the list and note; swipe right — to tomorrow,
 * swipe left — done.
 */
export function TaskRow(props: Props) {
  const { task } = props;
  const c = usePalette();
  const swipe = useRef<SwipeableMethods>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const carried = !task.done && task.originDate < task.date;
  const withWhom = task.partners.map((p) => p.name).join(", ");
  const listDone = task.items.filter((i) => i.done).length;
  const listOpen = task.items.length > 0 && listDone < task.items.length;
  const tint = task.done ? null : task.urgent ? c.tintDanger : task.important ? c.tintWarn : null;
  const edge = task.done ? c.border : task.urgent ? "#ff3b30" : task.important ? "#f0b429" : c.border;
  const hasMore = Boolean(task.note) || task.items.length > 0 || task.partners.length > 0 || task.viewerIsOwner;

  function check() {
    if (!task.done && !listOpen) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (listOpen) setOpen(true);
    props.onToggle(task);
  }

  return (
    <Swipeable
      ref={swipe}
      friction={1.6}
      leftThreshold={70}
      rightThreshold={70}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(progress) =>
        task.viewerIsOwner && !task.done ? (
          <SwipeAction progress={progress} color={c.accent} side="left">
            <Icon name="arrow-forward-circle-outline" color="#fff" size={22} />
            <Text style={styles.actionText}>На завтра</Text>
          </SwipeAction>
        ) : null
      }
      renderRightActions={(progress) => (
        <SwipeAction progress={progress} color={c.success} side="right">
          <Text style={styles.actionText}>{task.done ? "Вернуть" : "Готово"}</Text>
          <Icon name={task.done ? "arrow-undo-outline" : "checkmark-circle-outline"} color="#fff" size={22} />
        </SwipeAction>
      )}
      onSwipeableOpen={(direction) => {
        swipe.current?.close();
        if (direction === SwipeDirection.RIGHT) props.onTomorrow(task);
        else check();
      }}
    >
      <View style={[styles.row, { backgroundColor: tint ?? c.surface, borderColor: edge, opacity: task.done ? 0.65 : 1 }]}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            accessibilityLabel={task.done ? "Снять отметку" : "Выполнить"}
            hitSlop={10}
            onPress={check}
            style={[styles.check, { borderColor: task.done ? c.success : listOpen ? c.accent : c.accentSoft, backgroundColor: task.done ? c.success : "transparent" }]}
          >
            {task.done ? (
              <Icon name="checkmark" color="#fff" size={16} />
            ) : task.items.length ? (
              <Text style={[styles.ring, { color: c.accent }]}>
                {listDone}/{task.items.length}
              </Text>
            ) : null}
          </Pressable>

          <Pressable style={styles.body} onPress={() => hasMore && setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <Text
              numberOfLines={open ? undefined : 2}
              style={[
                styles.title,
                { color: task.done ? c.inkTertiary : c.ink },
                task.done && styles.titleDone,
                (task.important || task.urgent) && !task.done && styles.titleStrong,
              ]}
            >
              {task.title}
            </Text>
            {task.urgent || task.important || task.time || carried || withWhom || task.note || task.items.length > 0 ? (
              <View style={styles.meta}>
                {task.urgent ? <Text style={[styles.flag, { backgroundColor: "#ff3b30", color: "#fff" }]}>СРОЧНО</Text> : null}
                {task.important ? <Text style={[styles.flag, { backgroundColor: "#ffe08a", color: "#7a4b00" }]}>ВАЖНО</Text> : null}
                {task.time ? (
                  <View style={styles.metaItem}>
                    <Icon name="time-outline" color={c.accent} size={13} />
                    <Text style={[styles.metaText, { color: c.accent }]}>{task.time}</Text>
                  </View>
                ) : null}
                {task.items.length > 0 ? (
                  <View style={styles.metaItem}>
                    <Icon name="checkbox-outline" color={listOpen ? c.inkSecondary : c.success} size={13} />
                    <Text style={[styles.metaText, { color: listOpen ? c.inkSecondary : c.success }]}>
                      {listDone} из {task.items.length}
                    </Text>
                  </View>
                ) : null}
                {task.note ? <Icon name="document-text-outline" color={c.inkSecondary} size={14} /> : null}
                {withWhom ? (
                  <View style={styles.metaItem}>
                    <Icon name="people-outline" color={c.inkSecondary} size={14} />
                    <Text style={[styles.metaText, { color: c.inkSecondary }]} numberOfLines={1}>
                      {task.viewerIsOwner ? withWhom : `от ${task.ownerName ?? withWhom}`}
                    </Text>
                  </View>
                ) : null}
                {carried ? <Text style={[styles.metaText, { color: c.inkSecondary }]}>перенесено</Text> : null}
              </View>
            ) : null}
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel="Удалить" hitSlop={10} onPress={() => props.onDelete(task)} style={styles.delete}>
            <Icon name="close" color={c.inkTertiary} size={20} />
          </Pressable>
        </View>

        {open ? (
          <View style={[styles.more, { borderTopColor: c.border }]}>
            {task.note ? (
              <Text selectable style={[styles.note, { color: c.ink, backgroundColor: c.surfaceMuted }]}>
                {task.note}
              </Text>
            ) : null}

            {task.items.length > 0 || !task.done ? (
              <View style={{ gap: 2 }}>
                {task.items.map((it) => (
                  <View key={it.id} style={styles.itemRow}>
                    <Pressable
                      onPress={() => props.onItemToggle(task, it)}
                      hitSlop={6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: it.done }}
                      accessibilityLabel={it.text}
                      style={[styles.box, { borderColor: it.done ? c.success : c.inkTertiary, backgroundColor: it.done ? c.success : "transparent" }]}
                    >
                      {it.done ? <Icon name="checkmark" color="#fff" size={13} /> : null}
                    </Pressable>
                    <Text style={[styles.itemText, { color: it.done ? c.inkTertiary : c.ink }, it.done && styles.titleDone]}>{it.text}</Text>
                    <Pressable onPress={() => props.onItemRemove(task, it)} hitSlop={8} accessibilityLabel={`Убрать «${it.text}»`}>
                      <Icon name="close" color={c.inkTertiary} size={15} />
                    </Pressable>
                  </View>
                ))}
                {!task.done ? (
                  <View style={styles.itemRow}>
                    <Icon name="add" color={c.accent} size={18} />
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      onSubmitEditing={() => {
                        if (draft.trim()) props.onItemAdd(task, draft.trim());
                        setDraft("");
                      }}
                      submitBehavior="submit"
                      placeholder={task.items.length ? "Ещё пункт" : "Добавить список"}
                      placeholderTextColor={c.inkTertiary}
                      maxLength={100}
                      style={[styles.itemInput, { color: c.ink }]}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {task.partners.length > 0 ? (
              <Text style={{ color: c.inkSecondary, fontSize: 13 }}>
                {task.viewerIsOwner ? "Вместе с: " : `Дело от ${task.ownerName ?? "друга"}. Вместе с: `}
                {task.partners.map((p) => p.name).join(", ")}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {task.viewerIsOwner ? <Link icon="create-outline" label="Изменить" onPress={() => props.onEdit(task)} /> : null}
              {task.viewerIsOwner && !task.done ? <Link icon="arrow-forward-circle-outline" label="На завтра" onPress={() => props.onTomorrow(task)} /> : null}
              <Link icon="trash-outline" label="Удалить" danger onPress={() => props.onDelete(task)} />
            </View>
          </View>
        ) : null}
      </View>
    </Swipeable>
  );
}

/** The coloured panel under a swiped task; invisible until the swipe starts. */
function SwipeAction({ progress, color, side, children }: { progress: SharedValue<number>; color: string; side: "left" | "right"; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: progress.value > 0.02 ? 1 : 0 }));
  return <Animated.View style={[styles.action, side === "left" ? styles.left : styles.right, { backgroundColor: color }, style]}>{children}</Animated.View>;
}

function Link({ icon, label, onPress, danger }: { icon: React.ComponentProps<typeof Icon>["name"]; label: string; onPress: () => void; danger?: boolean }) {
  const c = usePalette();
  const color = danger ? c.danger : c.accent;
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.link}>
      <Icon name={icon} color={color} size={16} />
      <Text style={{ color, fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: radius.md, borderWidth: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingLeft: 14, paddingRight: 6 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  ring: { fontSize: 9, fontWeight: "800" },
  body: { flex: 1, gap: 5 },
  title: { fontSize: 16, fontWeight: "500", lineHeight: 21 },
  titleStrong: { fontWeight: "700" },
  titleDone: { textDecorationLine: "line-through" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 200 },
  metaText: { fontSize: 13, fontWeight: "600" },
  flag: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  delete: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  more: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  note: { fontSize: 14, lineHeight: 20, padding: 10, borderRadius: radius.sm, overflow: "hidden" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1, fontSize: 15 },
  itemInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  link: { flexDirection: "row", alignItems: "center", gap: 5 },
  action: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, paddingHorizontal: 18 },
  left: { justifyContent: "flex-start", marginRight: -16, paddingRight: 30 },
  right: { justifyContent: "flex-end", marginLeft: -16, paddingLeft: 30 },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
