import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { AppSettings } from "../types";
import { darkColors, fonts, lightColors, Palette, radius, shadow, spacing, typography } from "../theme";
import { defaultSettings } from "../lib/storage";

interface Props {
  visible: boolean;
  initial: AppSettings;
  onClose: () => void;
  onSave: (s: AppSettings) => void;
}

export default function SettingsModal({ visible, initial, onClose, onSave }: Props) {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? darkColors : lightColors;

  const [model, setModel] = useState(initial.model);
  const [baseUrl, setBaseUrl] = useState(initial.base_url);
  const [apiKey, setApiKey] = useState(initial.api_key);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (visible) {
      setModel(initial.model);
      setBaseUrl(initial.base_url);
      setApiKey(initial.api_key);
      setShowKey(false);
    }
  }, [visible, initial]);

  function restoreDefaults() {
    const d = defaultSettings();
    setModel(d.model);
    setBaseUrl(d.base_url);
    setApiKey(d.api_key);
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, shadow.lg, { backgroundColor: c.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[typography.logo, { color: c.text, marginBottom: spacing.xs, fontSize: 20 }]}>Настройки</Text>
            <Text style={{ color: c.textMuted, ...typography.small, marginBottom: spacing.lg }}>
              Модель, адрес API и ключ уже встроены в приложение (личная сборка, работает без
              настройки из коробки). Меняйте только если хотите использовать другую модель или свой ключ —
              значения хранятся локально на устройстве.
            </Text>

            <Field label="Модель" c={c}>
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border, fontFamily: fonts.sans }]}
                placeholder="напр. deepseek-v4-flash-free"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                value={model}
                onChangeText={setModel}
              />
            </Field>

            <Field label="Base URL API" c={c}>
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border, fontFamily: fonts.sans }]}
                placeholder="напр. https://opencode.ai/zen/v1"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                keyboardType="url"
                value={baseUrl}
                onChangeText={setBaseUrl}
              />
            </Field>

            <Field label="API-ключ" c={c}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, flex: 1 }]}
                  placeholder="sk-…"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="none"
                  secureTextEntry={!showKey}
                  value={apiKey}
                  onChangeText={setApiKey}
                />
                <Pressable onPress={() => setShowKey((v) => !v)} style={{ marginLeft: spacing.sm }}>
                  <Text style={{ color: c.textMuted, fontSize: 12.5 }}>{showKey ? "скрыть" : "показать"}</Text>
                </Pressable>
              </View>
            </Field>
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: c.border }]}>
            <Pressable onPress={restoreDefaults}>
              <Text style={{ color: c.textMuted }}>восстановить встроенные</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: spacing.lg }}>
              <Pressable onPress={onClose}>
                <Text style={{ color: c.textMuted }}>отмена</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  onSave({
                    model: model.trim(),
                    base_url: baseUrl.trim(),
                    api_key: apiKey.trim(),
                  })
                }
              >
                <Text style={{ color: c.accent, fontWeight: "700" }}>сохранить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, c, children }: { label: string; c: Palette; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: c.textMuted, ...typography.small, marginBottom: 4 }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
  modal: { borderRadius: radius.lg, padding: spacing.lg, maxHeight: "88%" },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
