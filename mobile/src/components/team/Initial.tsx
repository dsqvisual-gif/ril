import { Text, View } from "react-native";
import { usePalette } from "@/theme/theme";

const TONES = ["#4263eb", "#0ca678", "#e8590c", "#ae3ec9", "#1971c2", "#c2255c", "#2b8a3e", "#f08c00"];

/** A person's initials in a coloured circle; the colour stays the same for the same person. */
export function Initial({ name, id, size = 26 }: { name: string; id?: string | null; size?: number }) {
  const c = usePalette();
  const key = id ?? name;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const color = id === null ? c.inkTertiary : TONES[h % TONES.length];
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color, fontWeight: "800", fontSize: size * 0.38 }}>{letters}</Text>
    </View>
  );
}
