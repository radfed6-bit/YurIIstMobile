import React from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { darkColors, fonts, lightColors, radius, shadow, spacing, typography } from "../theme";

const EXAMPLES = [
  "Какая ответственность за незаконное увольнение?",
  "Как рассчитывается неустойка по ДДУ?",
  "Права потребителя при возврате бракованного товара",
];

export default function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? darkColors : lightColors;

  return (
    <View style={styles.wrap}>
      <Text style={[typography.logo, { color: c.text, textAlign: "center", fontSize: 26, marginBottom: spacing.sm }]}>
        ЮрИИст
      </Text>
      <Text style={{ color: c.textMuted, textAlign: "center", ...typography.body, marginBottom: spacing.xl }}>
        Задайте вопрос по законодательству — агент найдёт релевантные статьи в кодексах РФ и постановлениях
        Пленума ВС, при необходимости проверит актуальность в интернете.
      </Text>

      <Text style={[typography.smallMedium, { color: c.textMuted, marginBottom: spacing.sm, letterSpacing: 0.4 }]}>
        НАПРИМЕР
      </Text>
      {EXAMPLES.map((ex, i) => (
        <Pressable
          key={i}
          onPress={() => onPick(ex)}
          style={({ pressed }) => [
            styles.card,
            shadow.sm,
            { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[styles.accentBar, { backgroundColor: c.accent }]} />
          <Text style={[typography.bodyMedium, { color: c.text, flex: 1 }]}>{ex}</Text>
          <Text style={{ color: c.textMuted, fontSize: 16, marginLeft: spacing.sm }}>→</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingTop: spacing.xxl, alignItems: "stretch" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  accentBar: { width: 3, alignSelf: "stretch", borderRadius: 2, marginRight: spacing.md },
});
