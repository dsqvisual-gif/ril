import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { confirmAsk } from "@/components/dialogs";
import { Button, DateField, Icon, Segmented, Tag } from "@/components/ui";
import { fromDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";
import { Initial } from "./Initial";
import { dueInfo, isManager, personName, STATUSES, type CTask, type Run, type Status, type TeamView } from "./types";

/** People to choose an assignee from. */
export function PeoplePicker({ view, value, onChange }: { view: TeamView; value: string | null; onChange: (id: string | null) => void }) {
  const c = usePalette();
  const people = view.members.filter((m) => m.status === "active");
  return (
    <View style={styles.people}>
      {[...people.map((m) => ({ id: m.userId as string | null, name: m.name })), { id: null, name: "Не назначен" }].map((p) => {
        const on = p.id === value;
        return (
          <Pressable
            key={p.id ?? "none"}
            onPress={() => onChange(p.id)}
            style={[styles.person, { backgroundColor: on ? c.accentSoft : c.surfaceMuted, borderColor: on ? c.accent : c.border }]}
          >
            <Initial name={p.name} id={p.id} size={22} />
            <Text style={{ color: on ? c.accent : c.ink, fontWeight: "700", fontSize: 14 }}>
              {p.id === null ? p.name : p.id === view.me.userId ? `${p.name.split(" ")[0]} (я)` : p.name.split(" ")[0]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === "web"}>
      <View style={[styles.sheetWrap, Platform.OS === "web" && { backgroundColor: "rgba(0,0,0,0.35)", paddingTop: 40 }]}>
        <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: c.bg }]}>
          <View style={[styles.sheetHead, { borderBottomColor: c.border }]}>
            <Text style={[styles.sheetTitle, { color: c.ink }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Закрыть">
              <Text style={{ color: c.accent, fontWeight: "800", fontSize: 16 }}>Готово</Text>
            </Pressable>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.inkSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

/** A team task opened in full: status for the assignee; everything for admins. */
export function TaskSheet({ task, view, onView, run, onClose }: { task: CTask; view: TeamView; onView: (v: TeamView) => void; run: Run; onClose: () => void }) {
  const c = usePalette();
  const call = useRpc();
  const manager = isManager(view.me.role);
  const canMove = manager || task.assigneeId === view.me.userId;
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const patch = (p: Partial<CTask>) => void run(async () => onView(await call<TeamView>("company.updateTask", task.id, p)));
  const due = dueInfo(task.deadline, task.status === "done");
  const creator = view.members.find((m) => m.userId === task.creatorId);

  return (
    <Sheet visible title="Задача" onClose={onClose}>
      {manager ? (
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={() => title.trim() && title.trim() !== task.title && patch({ title: title.trim() })}
          multiline
          maxLength={140}
          style={[styles.titleInput, { color: c.ink }]}
        />
      ) : (
        <Text style={[styles.titleInput, { color: c.ink }]}>{task.title}</Text>
      )}
      <View style={styles.tags}>
        {task.important ? <Tag tone="warn" text="Важно" /> : null}
        {due ? <Tag tone={due.tone} text={due.text} /> : null}
      </View>

      <Field label="Статус">
        {canMove ? (
          <Segmented items={STATUSES.map((s) => ({ id: s.id, label: s.label }))} value={task.status} onChange={(s: Status) => patch({ status: s })} />
        ) : (
          <Text style={{ color: c.ink, fontWeight: "700" }}>{STATUSES.find((s) => s.id === task.status)!.label}</Text>
        )}
      </Field>

      <Field label="Исполнитель">
        {manager ? (
          <PeoplePicker view={view} value={task.assigneeId} onChange={(id) => patch({ assigneeId: id })} />
        ) : (
          <View style={styles.row}>
            <Initial name={personName(view, task.assigneeId)} id={task.assigneeId} />
            <Text style={{ color: c.ink, fontWeight: "600" }}>{personName(view, task.assigneeId)}</Text>
          </View>
        )}
      </Field>

      {manager ? (
        <>
          <Field label="Начало">
            <DateField value={task.startDate} onChange={(d) => d && patch({ startDate: d })} />
          </Field>
          <Field label="Срок">
            <DateField value={task.deadline} onChange={(d) => patch({ deadline: d })} min={task.startDate} placeholder="Без срока" />
          </Field>
          <View style={styles.switchRow}>
            <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>Важная задача</Text>
            <Switch value={task.important} onValueChange={(v) => patch({ important: v })} />
          </View>
          <Field label="Описание">
            <TextInput
              value={note}
              onChangeText={setNote}
              onBlur={() => note !== (task.note ?? "") && patch({ note: note.trim() || null })}
              placeholder="Что именно нужно сделать, ссылки, контакты"
              placeholderTextColor={c.inkTertiary}
              multiline
              maxLength={1000}
              style={[styles.input, styles.multiline, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Сроки">
            <Text style={{ color: c.ink }}>
              с {format(fromDateKey(task.startDate), "d MMMM", { locale: ru })}
              {task.deadline ? ` до ${format(fromDateKey(task.deadline), "d MMMM", { locale: ru })}` : ", без срока"}
            </Text>
          </Field>
          {task.note ? (
            <Field label="Описание">
              <Text selectable style={{ color: c.ink, lineHeight: 21 }}>
                {task.note}
              </Text>
            </Field>
          ) : null}
        </>
      )}

      <Text style={{ color: c.inkTertiary, fontSize: 13 }}>
        Поставил(а): {creator ? creator.name : "участник команды"}
        {task.doneAt ? ` · выполнено ${format(new Date(task.doneAt), "d MMMM", { locale: ru })}` : ""}
      </Text>

      {manager ? (
        <Button
          title="Удалить задачу"
          kind="danger"
          icon="trash-outline"
          full
          onPress={() =>
            confirmAsk(`Удалить задачу «${task.title}»?`, undefined, "Удалить", () =>
              void run(async () => {
                onView(await call<TeamView>("company.deleteTask", task.id));
                onClose();
              }),
            )
          }
        />
      ) : null}
    </Sheet>
  );
}

/** Adding a task: admins only. */
export function NewTaskSheet({ view, onView, run, onClose }: { view: TeamView; onView: (v: TeamView) => void; run: Run; onClose: () => void }) {
  const c = usePalette();
  const call = useRpc();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(todayKey());
  const [deadline, setDeadline] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [important, setImportant] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add(more: boolean) {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await run(async () =>
      onView(
        await call<TeamView>("company.createTask", view.company.id, {
          title: title.trim(),
          note: note.trim() || null,
          assigneeId: assignee,
          startDate: start ?? todayKey(),
          deadline,
          important,
        }),
      ),
    );
    setBusy(false);
    if (!ok) return;
    if (more) {
      setTitle("");
      setNote("");
    } else onClose();
  }

  return (
    <Sheet visible title="Новая задача" onClose={onClose}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Что нужно сделать"
        placeholderTextColor={c.inkTertiary}
        maxLength={140}
        autoFocus
        multiline
        style={[styles.titleInput, { color: c.ink }]}
      />
      <Field label="Исполнитель">
        <PeoplePicker view={view} value={assignee} onChange={setAssignee} />
      </Field>
      <Field label="Начало">
        <DateField value={start} onChange={setStart} />
      </Field>
      <Field label="Срок">
        <DateField value={deadline} onChange={setDeadline} min={start ?? todayKey()} />
      </Field>
      <View style={styles.switchRow}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>Важная задача</Text>
        <Switch value={important} onValueChange={setImportant} />
      </View>
      <Field label="Описание">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Подробности (необязательно)"
          placeholderTextColor={c.inkTertiary}
          multiline
          maxLength={1000}
          style={[styles.input, styles.multiline, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
        />
      </Field>
      <Button title="Создать задачу" full onPress={() => void add(false)} disabled={!title.trim()} busy={busy} />
      <Button title="Создать и добавить ещё" kind="ghost" full onPress={() => void add(true)} disabled={!title.trim() || busy} />
      <View style={styles.row}>
        <Icon name="information-circle-outline" color={c.inkTertiary} size={16} />
        <Text style={{ color: c.inkTertiary, fontSize: 13, flex: 1 }}>Исполнитель увидит задачу у себя и сможет менять её статус.</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  people: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  person: { flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 5, paddingRight: 12, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  sheetWrap: { flex: 1 },
  sheet: { flex: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  sheetBody: { padding: 18, gap: 18, paddingBottom: 40 },
  titleInput: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3, lineHeight: 28 },
  tags: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: -8 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
});
