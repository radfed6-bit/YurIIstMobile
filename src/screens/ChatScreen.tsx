import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import MessageBubble from "../components/MessageBubble";
import Composer from "../components/Composer";
import SessionDrawer from "../components/SessionDrawer";
import SettingsModal from "../components/SettingsModal";
import EmptyState from "../components/EmptyState";
import ThinkingIndicator from "../components/ThinkingIndicator";

import { AppSettings, DisplayMessage, Session } from "../types";
import * as storage from "../lib/storage";
import { initDatabase } from "../lib/database";
import { runAgent } from "../lib/agent";
import { darkColors, fonts, lightColors, radius, shadow, spacing, typography } from "../theme";

export default function ChatScreen() {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? darkColors : lightColors;

  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [currentId, setCurrentId] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [dbStatus, setDbStatus] = useState("Запуск…");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(storage.defaultSettings());

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveSteps, setLiveSteps] = useState<string[] | null>(null);

  const listRef = useRef<FlatList>(null);

  // ---------- начальная загрузка: сессии/настройки + подготовка БД ----------
  useEffect(() => {
    (async () => {
      let s = await storage.loadSessions();
      let cid = await storage.loadCurrentId();
      if (!cid || !s[cid]) {
        const ns = storage.newSession();
        s = { ...s, [ns.id]: ns };
        cid = ns.id;
      }
      setSessions(s);
      setCurrentId(cid);
      setSettings(await storage.loadSettings());

      try {
        await initDatabase((status) => setDbStatus(status));
      } catch (e: any) {
        setDbStatus(`Ошибка базы данных: ${e?.message ?? e}`);
        return;
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    storage.saveSessions(sessions);
  }, [sessions, ready]);

  useEffect(() => {
    if (!ready || !currentId) return;
    storage.saveCurrentId(currentId);
  }, [currentId, ready]);

  const current = sessions[currentId];

  const patchSession = useCallback((id: string, patch: Partial<Session>) => {
    setSessions((prev) => {
      const s = prev[id];
      if (!s) return prev;
      return { ...prev, [id]: { ...s, ...patch, updatedAt: Date.now() } };
    });
  }, []);

  function openSettings() {
    setDrawerOpen(false);
    setSettingsOpen(true);
  }

  function handleSaveSettings(s: AppSettings) {
    setSettings(s);
    storage.saveSettings(s);
    setSettingsOpen(false);
  }

  function newSession() {
    const ns = storage.newSession();
    setSessions((prev) => ({ ...prev, [ns.id]: ns }));
    setCurrentId(ns.id);
    setDrawerOpen(false);
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const next = { ...prev };
      delete next[id];
      if (id === currentId) {
        const remaining = Object.values(next).sort((a, b) => b.updatedAt - a.updatedAt);
        if (remaining.length) {
          setCurrentId(remaining[0].id);
        } else {
          const ns = storage.newSession();
          next[ns.id] = ns;
          setCurrentId(ns.id);
        }
      }
      return next;
    });
  }

  function confirmDeleteSession(id: string) {
    Alert.alert("Удалить дело", "Удалить это дело безвозвратно?", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: () => deleteSession(id) },
    ]);
  }

  function resetCurrent() {
    if (!current || busy) return;
    patchSession(current.id, { display: [], history: [], title: "Новое дело" });
  }

  async function send(overrideText?: string) {
    const query = (overrideText ?? input).trim();
    if (!query || busy || !current) return;

    if (!settings.api_key || !settings.base_url || !settings.model) {
      Alert.alert("Не заданы параметры модели", "Проверьте настройки — не хватает ключа, адреса API или модели.");
      setSettingsOpen(true);
      return;
    }

    const userMsg: DisplayMessage = { role: "user", text: query };
    const newDisplay = [...current.display, userMsg];
    const newTitle = current.display.length === 0 ? storage.deriveTitle(newDisplay) : current.title;
    patchSession(current.id, { display: newDisplay, title: newTitle });

    setInput("");
    setBusy(true);
    setLiveSteps([]);

    const sessionId = current.id;
    const historyAtSend = current.history;

    try {
      const result = await runAgent(
        query,
        historyAtSend,
        { apiKey: settings.api_key, baseUrl: settings.base_url, model: settings.model },
        (step) => setLiveSteps((prev) => [...(prev || []), step])
      );

      const assistantMsg: DisplayMessage = {
        role: "assistant",
        text: result.answer,
        sources: result.sources,
        thoughts: result.thoughts,
      };
      setSessions((prev) => {
        const s = prev[sessionId];
        if (!s) return prev;
        return {
          ...prev,
          [sessionId]: { ...s, display: [...s.display, assistantMsg], history: result.history, updatedAt: Date.now() },
        };
      });
    } catch (err: any) {
      const errMsg: DisplayMessage = { role: "error", text: `Ошибка: ${err?.message ?? err}` };
      setSessions((prev) => {
        const s = prev[sessionId];
        if (!s) return prev;
        return { ...prev, [sessionId]: { ...s, display: [...s.display, errMsg], updatedAt: Date.now() } };
      });
    } finally {
      setLiveSteps(null);
      setBusy(false);
    }
  }

  if (!ready || !current) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
        <Text style={{ color: c.textMuted, marginTop: spacing.md, ...typography.small }}>{dbStatus}</Text>
      </SafeAreaView>
    );
  }

  const orderedSessions = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={["top", "left", "right"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      <View style={[styles.header, { backgroundColor: c.headerBg }]}>
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={10} style={styles.headerBtn}>
          <Text style={{ fontSize: 19, color: c.headerText }}>☰</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text numberOfLines={1} style={[typography.h1, { color: c.headerText, fontFamily: fonts.serif, fontSize: 17 }]}>
            {current.title}
          </Text>
          <Text style={{ color: c.headerTextMuted, ...typography.small }}>консультации по законодательству РФ</Text>
        </View>
        <Pressable onPress={resetCurrent} hitSlop={10} style={styles.headerBtn}>
          <Text style={{ color: c.headerTextMuted, ...typography.smallMedium, fontSize: 12.5 }}>очистить</Text>
        </Pressable>
      </View>

      <Text style={[styles.disclaimer, { color: c.textMuted, backgroundColor: c.surfaceAlt }]}>
        Ответы формирует ИИ по базе кодексов РФ и открытым источникам. Это не замена консультации юриста —
        сверяйте ссылки на статьи перед тем, как на них полагаться.
      </Text>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={current.display}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          ListEmptyComponent={<EmptyState onPick={(t) => send(t)} />}
          ListFooterComponent={liveSteps ? <ThinkingIndicator steps={liveSteps} /> : null}
          contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.footerRow}>
          <Text style={{ color: c.textMuted, ...typography.small }}>модель: {settings.model || "—"} · всё локально, сервер не нужен</Text>
        </View>

        <Composer value={input} onChangeText={setInput} onSend={() => send()} disabled={busy} />
      </KeyboardAvoidingView>

      <SessionDrawer
        open={drawerOpen}
        sessions={orderedSessions}
        currentId={currentId}
        onClose={() => setDrawerOpen(false)}
        onSelect={(id) => {
          setCurrentId(id);
          setDrawerOpen(false);
        }}
        onDelete={confirmDeleteSession}
        onNew={newSession}
        onOpenSettings={openSettings}
      />

      <SettingsModal
        visible={settingsOpen}
        initial={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBtn: { width: 44, alignItems: "center" },
  disclaimer: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.sans,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    opacity: 0.9,
  },
  footerRow: { paddingHorizontal: spacing.lg, paddingBottom: 2 },
});
