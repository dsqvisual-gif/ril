import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { SITE } from "@/account/api";
import { BabyIcon, ChildChips, Empty, useChildren } from "@/components/baby/children";
import { errorText } from "@/components/dialogs";
import { Button, DateField, Segmented } from "@/components/ui";
import { buildStats, formatDuration, startOfLocalDay, type BabyEvent, type Child, type DayStat, type Growth } from "@/shared/baby";
import { fromDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

const DAY = 86_400_000;

/** The baby's last week or two in numbers and charts, plus growth — as on the website. */
export default function StatsScreen() {
  const c = usePalette();
  const { kids, child, setChildId, error } = useChildren();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {kids && kids.length > 1 ? <ChildChips kids={kids} childId={child?.id ?? null} onChange={setChildId} /> : null}
        {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
        {kids === null && !error ? <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} /> : null}
        {kids && kids.length === 0 ? <Empty text="Сначала добавьте малыша на вкладке «Малыш»." /> : null}
        {child ? <Board key={child.id} child={child} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Board({ child }: { child: Child }) {
  const c = usePalette();
  const call = useRpc();
  const [days, setDays] = useState<"7" | "14">("7");
  const [events, setEvents] = useState<BabyEvent[] | null>(null);
  const [growth, setGrowth] = useState<Growth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const n = Number(days);

  useEffect(() => {
    const from = new Date(startOfLocalDay(now) - (n - 1) * DAY).toISOString();
    call<BabyEvent[]>("baby.events", child.id, from, new Date(now + 60_000).toISOString())
      .then(setEvents)
      .catch((e) => setError(errorText(e, "Не удалось загрузить статистику")));
  }, [call, child.id, n, now]);

  useEffect(() => {
    call<Growth[]>("baby.growth", child.id).then(setGrowth).catch(() => {});
  }, [call, child.id]);

  const stats = useMemo(() => (events ? buildStats(events, n, now) : []), [events, n, now]);
  const filled = stats.filter((d) => d.daySleep + d.nightSleep + d.feeds + d.pee + d.poo > 0);
  const avg = (pick: (d: DayStat) => number) => (filled.length ? filled.reduce((s, d) => s + pick(d), 0) / filled.length : 0);
  const fmt = (x: number) => x.toFixed(1).replace(".0", "").replace(".", ",");

  return (
    <>
      <View style={styles.links}>
        <Pressable onPress={() => void Linking.openURL(`${SITE}/app/baby/report`)} style={[styles.link, { backgroundColor: c.accentSoft }]}>
          <BabyIcon name="file-document-outline" color={c.accent} />
          <Text style={{ color: c.accent, fontWeight: "800" }}>Отчёт для педиатра</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings/health")} style={[styles.link, { backgroundColor: c.accentSoft }]}>
          <BabyIcon name="needle" color={c.accent} />
          <Text style={{ color: c.accent, fontWeight: "800" }}>Прививки и визиты</Text>
        </Pressable>
      </View>

      <View style={styles.headline}>
        <Text style={[styles.h1, { color: c.ink }]}>Статистика</Text>
        <View style={{ width: 170 }}>
          <Segmented
            items={[
              { id: "7", label: "7 дней" },
              { id: "14", label: "14 дней" },
            ]}
            value={days}
            onChange={setDays}
          />
        </View>
      </View>

      <View style={styles.tiles}>
        <Tile big={formatDuration(avg((d) => d.daySleep + d.nightSleep))} sub="сна в сутки" />
        <Tile big={formatDuration(avg((d) => d.nightSleep))} sub="из них ночью" />
        <Tile big={fmt(avg((d) => d.feeds))} sub="кормлений в день" />
        <Tile big={fmt(avg((d) => d.pee + d.poo))} sub="подгузников в день" />
      </View>

      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      {events === null && !error ? <ActivityIndicator color={c.accent} /> : null}

      {events ? (
        <>
          <Chart
            icon="sleep"
            title="Сон"
            stats={stats}
            legend={[
              ["Ночью", "#6c5ce7"],
              ["Днём", "#a29bfe"],
            ]}
            parts={(d) => [
              [d.nightSleep, "#6c5ce7"],
              [d.daySleep, "#a29bfe"],
            ]}
            label={(d) => (d.daySleep + d.nightSleep ? `${Math.round((d.daySleep + d.nightSleep) / 3_600_000)}ч` : "")}
          />
          <Chart icon="baby-bottle-outline" title="Кормления" stats={stats} parts={(d) => [[d.feeds, c.accent]]} label={(d) => (d.feeds ? String(d.feeds) : "")} />
          <Chart
            icon="human-baby-changing-table"
            title="Подгузники"
            stats={stats}
            legend={[
              ["Мокрые", "#4dabf7"],
              ["Грязные", "#c08a5b"],
            ]}
            parts={(d) => [
              [d.pee, "#4dabf7"],
              [d.poo, "#c08a5b"],
            ]}
            label={(d) => (d.pee + d.poo ? String(d.pee + d.poo) : "")}
          />
        </>
      ) : null}

      <GrowthBlock childId={child.id} growth={growth} onChange={setGrowth} />
    </>
  );
}

function Tile({ big, sub }: { big: string; sub: string }) {
  const c = usePalette();
  return (
    <View style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: c.ink, fontSize: 19, fontWeight: "800" }}>{big}</Text>
      <Text style={{ color: c.inkSecondary, fontSize: 13 }}>{sub}</Text>
    </View>
  );
}

function Chart({
  icon,
  title,
  stats,
  parts,
  label,
  legend,
}: {
  icon: string;
  title: string;
  stats: DayStat[];
  parts: (d: DayStat) => [number, string][];
  label: (d: DayStat) => string;
  legend?: [string, string][];
}) {
  const c = usePalette();
  const max = Math.max(1, ...stats.map((d) => parts(d).reduce((s, [v]) => s + v, 0)));
  const narrow = stats.length > 7;
  return (
    <View style={[styles.chart, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={styles.row}>
          <BabyIcon name={icon} color={c.accent} />
          <Text style={{ color: c.ink, fontWeight: "800", fontSize: 16 }}>{title}</Text>
        </View>
        {legend ? (
          <View style={styles.row}>
            {legend.map(([name, color]) => (
              <View key={name} style={styles.row}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
                <Text style={{ color: c.inkSecondary, fontSize: 12 }}>{name}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.bars}>
        {stats.map((d) => (
          <View key={d.start} style={styles.barCol}>
            <Text style={{ color: c.inkSecondary, fontSize: narrow ? 9 : 11, fontWeight: "700" }}>{label(d)}</Text>
            <View style={[styles.bar, { backgroundColor: c.track }]}>
              {parts(d).map(([v, color], i) => (
                <View key={i} style={{ height: `${(v / max) * 100}%`, backgroundColor: color }} />
              ))}
            </View>
            <Text style={{ color: c.inkTertiary, fontSize: narrow ? 9 : 11 }}>{format(d.start, narrow ? "d" : "EEEEEE", { locale: ru })}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function GrowthBlock({ childId, growth, onChange }: { childId: string; growth: Growth[]; onChange: (g: Growth[]) => void }) {
  const c = usePalette();
  const call = useRpc();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string | null>(todayKey());
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const [error, setError] = useState<string | null>(null);
  const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);
  const weights = growth.filter((g) => g.weightG !== null);
  const maxW = Math.max(1, ...weights.map((g) => g.weightG!));
  const minW = Math.min(...weights.map((g) => g.weightG!), maxW);

  async function save() {
    try {
      const g = await call<Growth>("baby.addGrowth", childId, { date, weightKg: num(weight), heightCm: num(height), headCm: num(head) });
      onChange([...growth, g].sort((a, b) => a.date.localeCompare(b.date)));
      setOpen(false);
      setWeight("");
      setHeight("");
      setHead("");
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <View style={[styles.chart, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={styles.row}>
          <BabyIcon name="human-male-height" color={c.accent} />
          <Text style={{ color: c.ink, fontWeight: "800", fontSize: 16 }}>Рост и вес</Text>
        </View>
        {!open ? (
          <Pressable onPress={() => setOpen(true)} hitSlop={6}>
            <Text style={{ color: c.accent, fontWeight: "700" }}>+ Записать замер</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={{ gap: 8 }}>
          <DateField value={date} onChange={setDate} />
          <View style={styles.row}>
            {[
              ["Вес, кг", weight, setWeight, "6,4"],
              ["Рост, см", height, setHeight, "62"],
              ["Голова, см", head, setHead, "41"],
            ].map(([label, value, set, ph]) => (
              <View key={label as string} style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.inkSecondary, fontSize: 12, fontWeight: "700" }}>{label as string}</Text>
                <TextInput
                  value={value as string}
                  onChangeText={set as (t: string) => void}
                  placeholder={ph as string}
                  keyboardType="decimal-pad"
                  placeholderTextColor={c.inkTertiary}
                  style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
                />
              </View>
            ))}
          </View>
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
          <View style={[styles.row, { justifyContent: "flex-end" }]}>
            <Button title="Отмена" kind="ghost" small onPress={() => setOpen(false)} />
            <Button title="Сохранить" small onPress={() => void save()} disabled={!date} />
          </View>
        </View>
      ) : null}

      {weights.length >= 2 ? (
        <View style={[styles.bars, { height: 110 }]}>
          {weights.slice(-10).map((g) => (
            <View key={g.id} style={styles.barCol}>
              <Text style={{ color: c.inkSecondary, fontSize: 10, fontWeight: "700" }}>{(g.weightG! / 1000).toFixed(1).replace(".", ",")}</Text>
              <View style={[styles.bar, { backgroundColor: "transparent", justifyContent: "flex-end" }]}>
                <View style={{ height: `${25 + ((g.weightG! - minW) / Math.max(1, maxW - minW)) * 75}%`, backgroundColor: c.accent, borderRadius: 6, opacity: 0.85 }} />
              </View>
              <Text style={{ color: c.inkTertiary, fontSize: 10 }}>{format(fromDateKey(g.date), "MMM", { locale: ru })}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {growth.length ? (
        <View>
          <View style={[styles.tr, { borderBottomColor: c.border }]}>
            {["Дата", "Вес", "Рост", "Голова"].map((h) => (
              <Text key={h} style={[styles.td, { color: c.inkTertiary, fontWeight: "700" }]}>
                {h}
              </Text>
            ))}
            <View style={{ width: 20 }} />
          </View>
          {[...growth].reverse().map((g) => (
            <View key={g.id} style={[styles.tr, { borderBottomColor: c.border }]}>
              <Text style={[styles.td, { color: c.ink }]}>{format(fromDateKey(g.date), "d MMM yy", { locale: ru })}</Text>
              <Text style={[styles.td, { color: c.ink }]}>{g.weightG !== null ? `${(g.weightG / 1000).toFixed(2).replace(".", ",")} кг` : "—"}</Text>
              <Text style={[styles.td, { color: c.ink }]}>{g.heightCm !== null ? `${String(g.heightCm).replace(".", ",")} см` : "—"}</Text>
              <Text style={[styles.td, { color: c.ink }]}>{g.headCm !== null ? `${String(g.headCm).replace(".", ",")} см` : "—"}</Text>
              <Pressable
                onPress={() => void call("baby.deleteGrowth", g.id).then(() => onChange(growth.filter((x) => x.id !== g.id)))}
                hitSlop={8}
                style={{ width: 20 }}
                accessibilityLabel="Удалить замер"
              >
                <BabyIcon name="close" color={c.inkTertiary} size={15} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: c.inkSecondary, lineHeight: 19 }}>Записывайте замеры после визита к педиатру — здесь появится таблица и график веса.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  links: { gap: 8 },
  link: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, borderRadius: radius.md },
  headline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48%", flexGrow: 1, borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 2 },
  chart: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 150, gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  bar: { flex: 1, width: "80%", borderRadius: 6, overflow: "hidden", flexDirection: "column-reverse" },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  td: { flex: 1, fontSize: 13 },
});
