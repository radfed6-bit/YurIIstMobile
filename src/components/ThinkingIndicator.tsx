import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View, useColorScheme } from "react-native";
import { darkColors, lightColors, radius, shadow, spacing, typography } from "../theme";

export default function ThinkingIndicator({ steps }: { steps: string[] }) {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? darkColors : lightColors;
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 550, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={[styles.wrap, shadow.sm, { backgroundColor: c.bubbleAssistant }]}>
      {steps.slice(-4).map((s, i) => (
        <Text key={i} style={{ color: c.textMuted, ...typography.small, marginBottom: 2 }}>
          · {s}
        </Text>
      ))}
      <Animated.Text style={{ opacity: pulse, color: c.textMuted, marginTop: steps.length ? 4 : 0 }}>
        ● ● ●
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignSelf: "flex-start",
    maxWidth: "86%",
  },
});
