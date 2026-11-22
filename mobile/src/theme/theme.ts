import { useColorScheme } from "react-native";

/** The website's colours, as plain values for React Native. */
export type Palette = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  track: string;
  fill: string;
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  danger: string;
  tintWarn: string;
  tintDanger: string;
  warnInk: string;
  border: string;
  navy: string;
};

const light: Palette = {
  bg: "#f1f4fa",
  surface: "#ffffff",
  surfaceMuted: "#f6f8fc",
  track: "#e9edf6",
  fill: "rgba(0,0,0,0.05)",
  ink: "#1d1d1f",
  inkSecondary: "#6e6e73",
  inkTertiary: "#86868b",
  accent: "#007aff",
  accentSoft: "rgba(0,122,255,0.12)",
  onAccent: "#ffffff",
  success: "#34c759",
  danger: "#ff3b30",
  tintWarn: "#fff6e5",
  tintDanger: "#ffe7e4",
  warnInk: "#8a5a12",
  border: "rgba(0,0,0,0.07)",
  navy: "#182244",
};

const dark: Palette = {
  bg: "#111318",
  surface: "#1b1e24",
  surfaceMuted: "#23272f",
  track: "#2c313b",
  fill: "rgba(255,255,255,0.07)",
  ink: "#f2f3f5",
  inkSecondary: "#a8adb8",
  inkTertiary: "#7d8390",
  accent: "#4c9dff",
  accentSoft: "rgba(76,157,255,0.16)",
  onAccent: "#ffffff",
  success: "#30d158",
  danger: "#ff453a",
  tintWarn: "#3a2f17",
  tintDanger: "#3d1f1d",
  warnInk: "#ffc96b",
  border: "rgba(255,255,255,0.09)",
  navy: "#eef1f8",
};

export const radius = { lg: 18, md: 14, sm: 10, pill: 999 };

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
