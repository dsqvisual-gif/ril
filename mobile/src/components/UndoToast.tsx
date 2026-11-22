import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius } from "@/theme/theme";

type Props = { text: string; onUndo?: () => void; onClose: () => void; duration?: number };

/** A short dark notice at the bottom, with "Отменить" while it lasts. */
export function UndoToast({ text, onUndo, onClose, duration = 5000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <View style={styles.toast} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{text}</Text>
      {onUndo ? (
        <Pressable
          hitSlop={8}
          onPress={() => {
            onUndo();
            onClose();
          }}
        >
          <Text style={styles.undo}>Отменить</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: "#1d1f27",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600" },
  undo: { color: "#8fb4ff", fontSize: 14, fontWeight: "800" },
});
