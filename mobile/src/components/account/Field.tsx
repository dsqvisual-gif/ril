import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { radius, usePalette } from "@/theme/theme";

type Props = TextInputProps & { label: string; hint?: string; secret?: boolean };

/** A labelled input; password fields get an eye to show what was typed. */
export function Field({ label, hint, secret, style, ...input }: Props) {
  const c = usePalette();
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.inkSecondary }]}>{label}</Text>
      <View style={[styles.box, { borderColor: c.border, backgroundColor: c.surface }]}>
        <TextInput
          placeholderTextColor={c.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secret && !shown}
          style={[styles.input, { color: c.ink }, style]}
          {...input}
        />
        {secret ? (
          <Pressable
            onPress={() => setShown((v) => !v)}
            hitSlop={8}
            accessibilityLabel={shown ? "Скрыть пароль" : "Показать пароль"}
            style={styles.eye}
          >
            <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={20} color={c.inkTertiary} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={[styles.hint, { color: c.inkTertiary }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  box: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  eye: { paddingHorizontal: 12 },
  hint: { fontSize: 12 },
});
