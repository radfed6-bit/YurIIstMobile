// Дизайн-система v2: минимализм, но с характером — не "стандартный
// материал-дизайн", а собственная пара шрифтов (редакционный serif для
// заголовков/логотипа + чистый Inter для интерфейса), выраженная глубина
// через elevation, и один насыщенный акцент вместо плоских тонких рамок.

export const fonts = {
  serif: "Newsreader_600SemiBold",
  serifMedium: "Newsreader_500Medium",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
};

export const lightColors = {
  bg: "#F5F4F1",
  surface: "#FFFFFF",
  surfaceAlt: "#ECEAE4",
  headerBg: "#16233A",
  headerText: "#F6F4EE",
  headerTextMuted: "#A7B3C7",
  text: "#15171C",
  textMuted: "#6B7280",
  border: "#E4E2DB",
  accent: "#1F3A5C",
  accentSoft: "#E9EEF4",
  accentText: "#FFFFFF",
  gold: "#9C7A3F",
  danger: "#B3261E",
  bubbleUser: "#1F3A5C",
  bubbleUserText: "#FFFFFF",
  bubbleAssistant: "#FFFFFF",
  bubbleAssistantText: "#15171C",
};

export const darkColors = {
  bg: "#0E0F12",
  surface: "#1B1D22",
  surfaceAlt: "#24272E",
  headerBg: "#0B121F",
  headerText: "#F1EFE7",
  headerTextMuted: "#8593A8",
  text: "#EDEDEF",
  textMuted: "#9CA3AF",
  border: "#2A2D33",
  accent: "#6E9BC7",
  accentSoft: "#1E2A36",
  accentText: "#0B1220",
  gold: "#C9A15D",
  danger: "#E5847C",
  bubbleUser: "#2A4A6E",
  bubbleUserText: "#F2F5F8",
  bubbleAssistant: "#1F2127",
  bubbleAssistantText: "#EDEDEF",
};

export type Palette = typeof lightColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

// Android-таргет — используем elevation, этого достаточно для реальной
// глубины на устройстве (в отличие от плоских 1px-рамок, которые были
// раньше).
export const shadow = {
  sm: { elevation: 2 },
  md: { elevation: 6 },
  lg: { elevation: 14 },
};

export const typography = {
  logo: { fontFamily: fonts.serif, fontSize: 20, letterSpacing: -0.2 },
  h1: { fontFamily: fonts.sansSemiBold, fontSize: 16.5, letterSpacing: -0.1 },
  body: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  smallMedium: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16 },
};
