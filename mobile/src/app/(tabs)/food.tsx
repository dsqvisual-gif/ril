import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { BabyIcon, ChildChips, Empty, useChildren } from "@/components/baby/children";
import { confirmAsk, errorText } from "@/components/dialogs";
import { Button, DateField, Tag } from "@/components/ui";
import {
  childMonths,
  FOOD_CATEGORIES,
  FOOD_REACTIONS,
  FOOD_STATUS,
  FOOD_SUGGESTIONS,
  NEW_FOOD_GAP_DAYS,
  nextNewFoodDate,
  type Child,
  type Food,
  type FoodCategory,
  type FoodReaction,
  type FoodStatus,
} from "@/shared/baby";
import { fromDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

/** Complementary foods, as on the website: one new product every few days, tries and reactions. */
export default function FoodScreen() {
  const c = usePalette();
  const { kids, child, setChildId, error } = useChildren();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {kids && kids.length > 1 ? <ChildChips kids={kids} childId={child?.id ?? null} onChange={setChildId} /> : null}
        {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
        {kids === null && !error ? <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} /> : null}
        {kids && kids.length === 0 ? <Empty text="Сначала добавьте малыша на вкладке «Малыш»." /> : null}
        {child ? <FoodBoard key={child.id} child={child} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function FoodBoard({ child }: { child: Child }) {
  const c = usePalette();
  const call = useRpc();
  const today = todayKey();
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tips, setTips] = useState(false);

  useEffect(() => {
    call<Food[]>("baby.foods", child.id).then(setFoods).catch((e) => setError(errorText(e, "Не удалось загрузить прикорм")));
  }, [call, child.id]);

  const months = childMonths(child.birthDate, today);
  const next = nextNewFoodDate((foods ?? []).map((f) => f.startDate));
  const canStart = !next || next <= today;
  const groups = useMemo(() => {
    const g: Record<FoodStatus, Food[]> = { trying: [], reaction: [], ok: [], later: [] };
    for (const f of foods ?? []) g[f.status].push(f);
    return g;
  }, [foods]);
  const replace = (f: Food) => setFoods((prev) => prev?.map((x) => (x.id === f.id ? f : x)) ?? prev);

  async function run<T>(task: () => Promise<T>): Promise<T | null> {
    try {
      setError(null);
      return await task();
    } catch (e) {
      setError(errorText(e));
      return null;
    }
  }

  return (
    <>
      <View style={styles.headline}>
        <Text style={[styles.h1, { color: c.ink }]}>Прикорм</Text>
        <Tag tone="accent" text={`${child.name} · ${months} мес`} />
      </View>

      <View style={[styles.banner, { backgroundColor: canStart ? "rgba(47,158,68,0.1)" : c.tintWarn }]}>
        {canStart ? (
          <Text style={{ color: c.ink, lineHeight: 21 }}>
            <Text style={{ fontWeight: "800" }}>Можно пробовать новый продукт</Text>
            {foods && foods.length > 0 ? " — прошло достаточно дней после прошлого." : "."}
          </Text>
        ) : (
          <Text style={{ color: c.ink, lineHeight: 21 }}>
            <Text style={{ fontWeight: "800" }}>
              Новый продукт — с {format(fromDateKey(next!), "d MMMM", { locale: ru })} ({differenceInCalendarDays(fromDateKey(next!), fromDateKey(today))} дн.)
            </Text>
            . Пока продолжайте давать то, что уже вводите, и наблюдайте за реакцией.
          </Text>
        )}
        <Pressable onPress={() => setTips((v) => !v)} hitSlop={6}>
          <Text style={{ color: c.accent, fontWeight: "700" }}>{tips ? "Скрыть советы" : "Как вводить прикорм?"}</Text>
        </Pressable>
        {tips ? (
          <View style={{ gap: 6 }}>
            {[
              "Обычно прикорм начинают около 6 месяцев — когда малыш уверенно сидит с опорой и интересуется едой.",
              `Один новый продукт — раз в ${NEW_FOOD_GAP_DAYS} дня, чтобы было понятно, на что реакция.`,
              "Давайте новое утром или днём: так проще заметить реакцию до ночи.",
              "Начинайте с ½–1 ложечки и понемногу увеличивайте.",
              "Сыпь, покраснение, беспокойство или изменения стула — отметьте реакцию и отложите продукт.",
              "Сроки и порядок продуктов обсудите с педиатром — у каждого малыша свой план.",
            ].map((t) => (
              <Text key={t} style={{ color: c.inkSecondary, lineHeight: 19 }}>
                •  {t}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {months < 4 ? <Text style={{ color: c.inkSecondary }}>Малышу {months} мес — обычно прикорм начинают позже. Раздел будет ждать вас здесь.</Text> : null}
      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}

      {adding ? (
        <NewFood
          existing={(foods ?? []).map((f) => f.product.toLowerCase())}
          warn={!canStart}
          onCancel={() => setAdding(false)}
          onSave={async (input) => {
            const created = await run(() => call<Food>("baby.addFood", child.id, input));
            if (created) {
              setFoods((prev) => [created, ...(prev ?? [])]);
              setAdding(false);
              setOpenId(created.id);
            }
          }}
        />
      ) : (
        <Button title="Новый продукт" icon="add" full onPress={() => setAdding(true)} />
      )}

      {foods === null ? <ActivityIndicator color={c.accent} /> : null}
      {foods && foods.length === 0 && !adding ? <Empty text="Здесь появятся продукты, которые вы вводите. Начните с первого." /> : null}

      {(["trying", "reaction", "ok", "later"] as FoodStatus[]).map((st) =>
        groups[st].length ? (
          <View key={st} style={{ gap: 8 }}>
            <View style={styles.row}>
              <BabyIcon name={FOOD_STATUS[st].icon} color={FOOD_STATUS[st].color} size={18} />
              <Text style={{ color: c.ink, fontWeight: "800", fontSize: 15 }}>
                {FOOD_STATUS[st].label} · {groups[st].length}
              </Text>
            </View>
            {groups[st].map((f) => (
              <FoodCard
                key={f.id}
                food={f}
                today={today}
                open={openId === f.id}
                onToggle={() => setOpenId((id) => (id === f.id ? null : f.id))}
                onTry={async (input) => {
                  const u = await run(() => call<Food>("baby.addFoodTry", f.id, input));
                  if (u) replace(u);
                  return Boolean(u);
                }}
                onDeleteTry={async (id) => {
                  const u = await run(() => call<Food>("baby.deleteFoodTry", id));
                  if (u) replace(u);
                }}
                onStatus={async (s) => {
                  const u = await run(() => call<Food>("baby.setFoodStatus", f.id, s));
                  if (u) replace(u);
                }}
                onDelete={() =>
                  confirmAsk(`Удалить «${f.product}» со всеми пробами?`, undefined, "Удалить", async () => {
                    if ((await run(() => call("baby.deleteFood", f.id))) !== null) setFoods((p) => p?.filter((x) => x.id !== f.id) ?? p);
                  })
                }
              />
            ))}
          </View>
        ) : null,
      )}
    </>
  );
}

function NewFood({
  existing,
  warn,
  onSave,
  onCancel,
}: {
  existing: string[];
  warn: boolean;
  onSave: (input: { product: string; category: string; startDate: string; amount: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const c = usePalette();
  const [category, setCategory] = useState<FoodCategory>("veg");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("½ ложечки");
  const [date, setDate] = useState<string | null>(todayKey());
  const [busy, setBusy] = useState(false);
  const suggestions = FOOD_SUGGESTIONS[category].filter((p) => !existing.includes(p.toLowerCase()));

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.ink }]}>Новый продукт</Text>
      {warn ? (
        <Text style={{ color: c.warnInk, backgroundColor: c.tintWarn, padding: 10, borderRadius: radius.sm, lineHeight: 19, overflow: "hidden" }}>
          С прошлого нового продукта прошло меньше {NEW_FOOD_GAP_DAYS} дней — если начнёте сейчас, будет сложнее понять, на что реакция.
        </Text>
      ) : null}
      <View style={styles.wrap}>
        {FOOD_CATEGORIES.map((cat) => {
          const on = cat.id === category;
          return (
            <Pressable key={cat.id} onPress={() => setCategory(cat.id)} style={[styles.chip, { backgroundColor: on ? c.accent : c.surfaceMuted, borderColor: on ? c.accent : c.border }]}>
              <BabyIcon name={cat.icon} color={on ? c.onAccent : cat.color} size={16} />
              <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700", fontSize: 13 }}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {suggestions.length ? (
        <View style={styles.wrap}>
          {suggestions.map((p) => (
            <Pressable key={p} onPress={() => setProduct(p)} style={[styles.chip, { backgroundColor: product === p ? c.accentSoft : "transparent", borderColor: product === p ? c.accent : c.border }]}>
              <Text style={{ color: product === p ? c.accent : c.inkSecondary, fontWeight: "600", fontSize: 13 }}>{p}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput value={product} onChangeText={setProduct} placeholder="Продукт — или впишите свой" placeholderTextColor={c.inkTertiary} maxLength={40} style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]} />
      <Text style={[styles.label, { color: c.inkSecondary }]}>Первая проба</Text>
      <DateField value={date} onChange={setDate} />
      <Text style={[styles.label, { color: c.inkSecondary }]}>Сколько дали</Text>
      <TextInput value={amount} onChangeText={setAmount} maxLength={30} style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]} />
      <View style={[styles.row, { justifyContent: "flex-end" }]}>
        <Button title="Отмена" kind="ghost" small onPress={onCancel} />
        <Button
          title="Начать вводить"
          small
          busy={busy}
          disabled={!product.trim() || !date}
          onPress={() => {
            setBusy(true);
            void onSave({ product: product.trim(), category, startDate: date!, amount }).finally(() => setBusy(false));
          }}
        />
      </View>
    </View>
  );
}

function FoodCard(props: {
  food: Food;
  today: string;
  open: boolean;
  onToggle: () => void;
  onTry: (input: { date: string; amount: string; reaction: FoodReaction; note: string }) => Promise<boolean>;
  onDeleteTry: (id: string) => Promise<void>;
  onStatus: (s: FoodStatus) => Promise<void>;
  onDelete: () => void;
}) {
  const { food, today, open } = props;
  const c = usePalette();
  const [amount, setAmount] = useState(food.tries[food.tries.length - 1]?.amount ?? "");
  const [reaction, setReaction] = useState<FoodReaction>("none");
  const [note, setNote] = useState("");
  const cat = FOOD_CATEGORIES.find((x) => x.id === food.category) ?? FOOD_CATEGORIES[5];
  const day = differenceInCalendarDays(fromDateKey(today), fromDateKey(food.startDate)) + 1;
  const reactions = food.tries.filter((t) => t.reaction !== "none").length;

  return (
    <View style={[styles.food, { backgroundColor: c.surface, borderColor: open ? c.accent : c.border }]}>
      <Pressable onPress={props.onToggle} style={styles.foodHead}>
        <View style={[styles.foodIcon, { backgroundColor: `${cat.color}1c` }]}>
          <BabyIcon name={cat.icon} color={cat.color} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontWeight: "800", fontSize: 16 }}>{food.product}</Text>
          <Text style={{ color: c.inkSecondary, fontSize: 13 }}>
            {food.status === "trying" ? `день ${Math.max(1, day)} · проб: ${food.tries.length}` : `с ${format(fromDateKey(food.startDate), "d MMM", { locale: ru })} · проб: ${food.tries.length}`}
            {reactions ? ` · реакций: ${reactions}` : ""}
          </Text>
        </View>
        <BabyIcon name={open ? "chevron-up" : "chevron-down"} color={c.inkTertiary} />
      </Pressable>

      {open ? (
        <View style={{ gap: 10, paddingTop: 4 }}>
          <Text style={[styles.label, { color: c.inkSecondary }]}>Сегодняшняя проба</Text>
          <TextInput value={amount} onChangeText={setAmount} placeholder="Сколько: 1 ложечка, 30 г…" placeholderTextColor={c.inkTertiary} maxLength={30} style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]} />
          <View style={styles.wrap}>
            {(Object.keys(FOOD_REACTIONS) as FoodReaction[]).map((r) => {
              const on = r === reaction;
              return (
                <Pressable key={r} onPress={() => setReaction(r)} style={[styles.chip, { backgroundColor: on ? (r === "none" ? "#2f9e44" : "#e03131") : c.surfaceMuted, borderColor: c.border }]}>
                  <BabyIcon name={r === "none" ? "emoticon-happy-outline" : "alert-outline"} color={on ? "#fff" : c.inkSecondary} size={15} />
                  <Text style={{ color: on ? "#fff" : c.ink, fontWeight: "700", fontSize: 13 }}>{FOOD_REACTIONS[r]}</Text>
                </Pressable>
              );
            })}
          </View>
          {reaction !== "none" ? <TextInput value={note} onChangeText={setNote} placeholder="Что заметили" placeholderTextColor={c.inkTertiary} maxLength={300} style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]} /> : null}
          <Button title="Записать пробу" small onPress={() => void props.onTry({ date: today, amount, reaction, note }).then((ok) => ok && setNote(""))} />

          {food.tries.length ? (
            <View style={{ gap: 6 }}>
              {[...food.tries].reverse().map((t) => (
                <View key={t.id} style={styles.row}>
                  <Text style={{ color: c.inkTertiary, width: 60 }}>{format(fromDateKey(t.date), "d MMM", { locale: ru })}</Text>
                  <Text style={{ flex: 1, color: c.ink }}>
                    {t.amount || "—"}
                    {t.reaction !== "none" ? <Text style={{ color: "#e03131" }}> · {FOOD_REACTIONS[t.reaction]}</Text> : null}
                    {t.note ? ` · ${t.note}` : ""}
                  </Text>
                  <Pressable onPress={() => void props.onDeleteTry(t.id)} hitSlop={8} accessibilityLabel="Удалить пробу">
                    <BabyIcon name="close" color={c.inkTertiary} size={16} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.wrap}>
            {(Object.keys(FOOD_STATUS) as FoodStatus[])
              .filter((s) => s !== food.status)
              .map((s) => (
                <Pressable key={s} onPress={() => void props.onStatus(s)} style={[styles.chip, { borderColor: c.border }]}>
                  <BabyIcon name={FOOD_STATUS[s].icon} color={FOOD_STATUS[s].color} size={15} />
                  <Text style={{ color: c.ink, fontWeight: "600", fontSize: 13 }}>
                    {s === "ok" ? "Подходит" : s === "trying" ? "Снова вводим" : s === "reaction" ? "Была реакция" : "Отложить"}
                  </Text>
                </Pressable>
              ))}
            <Pressable onPress={props.onDelete} style={styles.chip}>
              <Text style={{ color: c.danger, fontWeight: "700", fontSize: 13 }}>Удалить</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  headline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  banner: { borderRadius: radius.lg, padding: 14, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  food: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 6 },
  foodHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  foodIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
