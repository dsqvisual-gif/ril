import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { ACHIEVEMENTS, CATEGORIES, STAT_LABELS, type StatKey, type Stats } from "@/shared/achievements";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { radius, usePalette } from "@/theme/theme";

type Overview = { stats: Stats; unlocked: { code: string; at: string }[] };

const NUMBERS: { stat: StatKey; icon: string; label: string }[] = [
  { stat: "tasksDone", icon: "✅", label: "дел сделано" },
  { stat: "bestDay", icon: "⚡", label: "рекорд за день" },
  { stat: "bestStreak", icon: "🔥", label: "дней — лучшая серия" },
  { stat: "useStreak", icon: "📅", label: "дней подряд заходите" },
  { stat: "goalsDone", icon: "🌈", label: "целей достигнуто" },
  { stat: "daysWithUs", icon: "🎂", label: "дней с нами" },
];

/** The same achievements and numbers as on the website. */
export default function AchievementsScreen() {
  const c = usePalette();
  const call = useRpc();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      call<Overview>("achievements.overview")
        .then(setData)
        .catch((e: Error) => setError(e.message));
    }, [call]),
  );

  const at = new Map((data?.unlocked ?? []).map((u) => [u.code, u.at]));
  const open = ACHIEVEMENTS.filter((a) => at.has(a.code)).length;

  return (
    <SettingsScreen title="Достижения" lead={data ? `Открыто ${open} из ${ACHIEVEMENTS.length}` : undefined}>
      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      {!data && !error ? <ActivityIndicator color={c.accent} /> : null}
      {data ? (
        <>
          <View style={styles.grid}>
            {NUMBERS.map((n) => (
              <View key={n.stat} style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={styles.tileIcon}>{n.icon}</Text>
                <Text style={[styles.tileValue, { color: c.ink }]}>{data.stats[n.stat].toLocaleString("ru-RU")}</Text>
                <Text style={[styles.tileLabel, { color: c.inkSecondary }]}>{n.label}</Text>
              </View>
            ))}
          </View>
          {CATEGORIES.map((cat) => (
            <View key={cat.id} style={{ gap: 8 }}>
              <Text style={[styles.cat, { color: c.ink }]}>{cat.title}</Text>
              {ACHIEVEMENTS.filter((a) => a.category === cat.id).map((a) => {
                const got = at.get(a.code);
                const hidden = a.secret && !got;
                const value = Math.min(data.stats[a.stat], a.target);
                return (
                  <View
                    key={a.code}
                    style={[styles.card, { backgroundColor: got ? c.tintWarn : c.surface, borderColor: c.border, opacity: got ? 1 : 0.85 }]}
                  >
                    <Text style={styles.icon}>{hidden ? "❔" : got ? a.icon : "🔒"}</Text>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.name, { color: c.ink }]}>{hidden ? "Секретное достижение" : a.title}</Text>
                      <Text style={[styles.desc, { color: c.inkSecondary }]}>
                        {hidden ? "Откроется, когда вы сделаете что-то особенное" : a.description}
                      </Text>
                      {got ? (
                        <Text style={[styles.small, { color: c.warnInk }]}>
                          Получено {format(new Date(got), "d MMMM yyyy", { locale: ru })} · {data.stats[a.stat]} {STAT_LABELS[a.stat]}
                        </Text>
                      ) : hidden ? null : (
                        <>
                          <View style={[styles.track, { backgroundColor: c.track }]}>
                            <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.round((value / a.target) * 100)}%` }]} />
                          </View>
                          <Text style={[styles.small, { color: c.inkTertiary }]}>{value} / {a.target}</Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </>
      ) : null}
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%", flexGrow: 1, borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 2 },
  tileIcon: { fontSize: 18 },
  tileValue: { fontSize: 24, fontWeight: "800" },
  tileLabel: { fontSize: 13 },
  cat: { fontSize: 20, fontWeight: "800", marginTop: 8 },
  card: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 12, alignItems: "flex-start" },
  icon: { fontSize: 28 },
  name: { fontSize: 16, fontWeight: "700" },
  desc: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 12, fontWeight: "600" },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  fill: { height: "100%" },
});
