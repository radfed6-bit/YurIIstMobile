import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { darkColors, fonts, lightColors, radius, shadow, spacing } from "../theme";

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function Composer({ value, onChangeText, onSend, disabled }: Props) {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? darkColors : lightColors;
  const canSend = !disabled && value.trim().length > 0;

  return (
    <View style={[styles.wrap, shadow.md, { backgroundColor: c.surface }]}>
      <TextInput
        style={[styles.input, { color: c.text, fontFamily: fonts.sans }]}
        placeholder="Ваш вопрос…"
        placeholderTextColor={c.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={4096}
        editable={!disabled}
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.sendBtn,
          { backgroundColor: c.accent, opacity: !canSend ? 0.35 : pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={{ color: c.accentText, fontSize: 16, fontWeight: "600" }}>↑</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
