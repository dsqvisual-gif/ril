import { useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { useAccount } from "@/account/account-context";
import { usePalette } from "@/theme/theme";

/** The account photo (uploaded photos need the sign-in token), or the first letter. */
export function AccountAvatar({ name, uri, size }: { name: string; uri?: string | null; size: number }) {
  const c = usePalette();
  const { token } = useAccount();
  const [broken, setBroken] = useState<string | null>(null);
  const letter = (name.trim() || "?").slice(0, 1).toUpperCase();
  // The browser version cannot send the token with images, so photos uploaded to
  // the site (which need it) show as the letter there; Google photos still load.
  const needsToken = Boolean(uri?.includes("/api/avatar/"));
  if (uri && broken !== uri && !(needsToken && Platform.OS === "web")) {
    return (
      <Image
        source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill }}
        onError={() => setBroken(uri)}
      />
    );
  }
  return (
    <View style={[styles.letter, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent }]}>
      <Text style={[styles.letterText, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  letter: { alignItems: "center", justifyContent: "center" },
  letterText: { color: "#fff", fontWeight: "800" },
});
