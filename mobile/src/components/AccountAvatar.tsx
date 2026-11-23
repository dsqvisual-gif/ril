import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { useAccount } from "@/account/account-context";
import { usePalette } from "@/theme/theme";

/**
 * In the browser an <img> cannot send the sign-in token, so photos uploaded to
 * the site are fetched with it and shown from memory.
 */
const webCache = new Map<string, string>();

function useWebPhoto(uri: string | null | undefined, token: string | null): string | null | undefined {
  const needsFetch = Platform.OS === "web" && Boolean(uri?.includes("/api/avatar/")) && Boolean(token);
  const [blobUrl, setBlobUrl] = useState<string | null>(() => (uri && webCache.get(uri)) || null);
  useEffect(() => {
    if (!needsFetch || !uri || webCache.has(uri)) return;
    let alive = true;
    fetch(uri, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("no photo"))))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        webCache.set(uri, url);
        if (alive) setBlobUrl(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [needsFetch, uri, token]);
  if (!needsFetch) return uri;
  return (uri && webCache.get(uri)) || blobUrl;
}

/** The account photo (uploaded photos need the sign-in token), or the first letter. */
export function AccountAvatar({ name, uri, size }: { name: string; uri?: string | null; size: number }) {
  const c = usePalette();
  const { token } = useAccount();
  const [broken, setBroken] = useState<string | null>(null);
  const shown = useWebPhoto(uri, token);
  const letter = (name.trim() || "?").slice(0, 1).toUpperCase();
  if (shown && broken !== shown) {
    return (
      <Image
        source={{ uri: shown, headers: token && Platform.OS !== "web" ? { Authorization: `Bearer ${token}` } : undefined }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill }}
        onError={() => setBroken(shown)}
      />
    );
  }
  return (
    <View style={[styles.letter, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent }]}>
      <Text style={[styles.letterText, { fontSize: size * 0.42, color: c.onAccent }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  letter: { alignItems: "center", justifyContent: "center" },
  letterText: { fontWeight: "800" },
});
