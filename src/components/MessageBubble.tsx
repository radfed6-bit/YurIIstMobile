import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, useColorScheme } from "react-native";
import Markdown from "react-native-markdown-display";
import { DisplayMessage } from "../types";
import { darkColors, fonts, lightColors, Palette, radius, shadow, spacing, typography } from "../theme";

// Тот же паттерн, что подсвечивал ссылки на статьи в веб-версии
// ("ст. 123 ГК РФ" и т.п.) — здесь подкрашиваем их тем же приглушённым
// золотом, без иконок и рамок.
const CITE_RE_TEST = /ст(?:атья|атьи)?\.?\s*\d[\d.]*\s+[А-ЯЁ][А-ЯЁ\s]{1,30}[А-ЯЁ]/;
const CITE_RE_G = /ст(?:атья|атьи)?\.?\s*\d[\d.]*\s+[А-ЯЁ][А-ЯЁ\s]{1,30}[А-ЯЁ]/g;

export default function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? darkColors : lightColors;
  const [thoughtsOpen, setThoughtsOpen] = useState(false);

  if (msg.role === "user") {
    return (
      <View style={[styles.row, { justifyContent: "flex-end" }]}>
        <View style={[styles.bubble, shadow.sm, { backgroundColor: c.bubbleUser, borderBottomRightRadius: radius.sm }]}>
          <Text style={{ color: c.bubbleUserText, ...typography.body }}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  if (msg.role === "error") {
    return (
      <View style={[styles.row, { justifyContent: "flex-start" }]}>
        <View style={[styles.bubble, { backgroundColor: "transparent", borderWidth: 1, borderColor: c.danger }]}>
          <Text style={{ color: c.danger, ...typography.body }}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { justifyContent: "flex-start" }]}>
      <View
        style={[
          styles.bubble,
          shadow.sm,
          { backgroundColor: c.bubbleAssistant, borderBottomLeftRadius: radius.sm },
        ]}
      >
        {!!msg.thoughts?.length && (
          <Pressable onPress={() => setThoughtsOpen((o) => !o)} style={styles.thoughtsToggle} hitSlop={6}>
            <Text style={{ color: c.textMuted, ...typography.small }}>
              {thoughtsOpen ? "▾" : "▸"} ход поиска ({msg.thoughts.length})
            </Text>
          </Pressable>
        )}
        {thoughtsOpen &&
          msg.thoughts?.map((t, i) => (
            <Text key={i} style={{ color: c.textMuted, ...typography.small, marginBottom: 2 }}>
              · {t}
            </Text>
          ))}

        <Markdown style={markdownStyles(c)} rules={{ text: makeCiteTextRule(c) }}>
          {msg.text}
        </Markdown>

        {!!msg.sources?.length && (
          <View style={styles.sources}>
            {msg.sources.map((s, i) => (
              <View key={i} style={[styles.sourceChip, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
                <Text style={{ color: c.gold, ...typography.small }}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function makeCiteTextRule(c: Palette) {
  return function textRule(node: any, _children: any, _parent: any, styles: any) {
    const content: string = node.content ?? "";
    if (!CITE_RE_TEST.test(content)) {
      return (
        <Text key={node.key} style={styles.text}>
          {content}
        </Text>
      );
    }
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let i = 0;
    CITE_RE_G.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CITE_RE_G.exec(content))) {
      if (m.index > lastIndex) parts.push(content.slice(lastIndex, m.index));
      parts.push(
        <Text key={`cite-${i++}`} style={[styles.text, { color: c.gold, fontFamily: fonts.sansSemiBold }]}>
          {m[0]}
        </Text>
      );
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return (
      <Text key={node.key} style={styles.text}>
        {parts}
      </Text>
    );
  };
}

function markdownStyles(c: Palette) {
  return StyleSheet.create({
    body: { color: c.bubbleAssistantText, fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 22 },
    heading1: { fontFamily: fonts.sansSemiBold, fontSize: 18, marginTop: 4, marginBottom: 4, color: c.bubbleAssistantText },
    heading2: { fontFamily: fonts.sansSemiBold, fontSize: 16, marginTop: 4, marginBottom: 4, color: c.bubbleAssistantText },
    strong: { fontFamily: fonts.sansBold },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    code_inline: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 4,
      paddingHorizontal: 4,
      fontFamily: "monospace",
    },
    fence: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm },
    code_block: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm },
    hr: { backgroundColor: c.border, height: 1, marginVertical: spacing.sm },
    link: { color: c.accent, textDecorationLine: "underline" },
  });
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: spacing.lg, marginVertical: spacing.xs },
  bubble: { maxWidth: "86%", paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  thoughtsToggle: { marginBottom: spacing.xs },
  sources: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  sourceChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
});
