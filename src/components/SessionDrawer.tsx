import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Session } from "../types";
import { darkColors, fonts, lightColors, radius, shadow, spacing, typography } from "../theme";

const DRAWER_WIDTH = Math.min(320, Dimensions.get("window").width * 0.84);

interface Props {
  open: boolean;
  sessions: Session[];
  currentId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onOpenSettings: () => void;
}

export default function SessionDrawer({
  open,
  sessions,
  currentId,
  onClose,
  onSelect,
  onDelete,
  onNew,
  onOpenSettings,
}: Props) {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? darkColors : lightColors;
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: open ? 0 : -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [open, translateX, fade]);

  return (
    <>
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fade }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          shadow.lg,
          { width: DRAWER_WIDTH, backgroundColor: c.surface, transform: [{ translateX }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={[typography.logo, { color: c.text, fontSize: 22 }]}>ЮрИИст</Text>
          <Text style={{ color: c.textMuted, ...typography.small }}>архив дел</Text>
        </View>

        <Pressable
          onPress={onNew}
          style={({ pressed }) => [styles.newBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[typography.bodyMedium, { color: c.accentText }]}>+ новое дело</Text>
        </Pressable>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {sessions.length === 0 && (
            <Text style={{ color: c.textMuted, padding: spacing.md, ...typography.small }}>дел пока нет</Text>
          )}
          {sessions.map((s) => {
            const active = s.id === currentId;
            return (
              <Pressable
                key={s.id}
                onPress={() => onSelect(s.id)}
                style={[
                  styles.item,
                  active && shadow.sm,
                  { backgroundColor: active ? c.surface : "transparent" },
                ]}
              >
                {active && <View style={[styles.activeBar, { backgroundColor: c.accent }]} />}
                <Text numberOfLines={1} style={[typography.bodyMedium, { color: c.text, flex: 1 }]}>
                  {s.title}
                </Text>
                <Pressable hitSlop={10} onPress={() => onDelete(s.id)}>
                  <Text style={{ color: c.textMuted, fontSize: 17, paddingHorizontal: 4 }}>×</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.settingsBtn, { borderTopColor: c.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: c.textMuted }}>⚙  настройки модели</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: "rgba(0,0,0,0.4)", zIndex: 10 },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  header: { marginBottom: spacing.lg },
  newBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: 4,
    overflow: "hidden",
  },
  activeBar: { position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2 },
  settingsBtn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
});
