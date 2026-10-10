// Design tokens for CampusCrave.
// iOS-native dark aesthetic with curated luxury palette:
// - Primary Background: Deep Obsidian (#121212)
// - Elevated Surface: Charcoal Lift (#1C1C1E)
// - Interactive Surface: Slate Gray (#2C2C2E)
// - Primary Text: Soft Chalk (#F2F2F7)
// - Secondary Text: Muted Silver (#8E8E93)
// - Primary Accent: Rich Truffle / Warm Gold (#D4AF37 / #E5A93B)
// - Appetite Accent: Saffron Coral (#FF6B4A)
// - Success / Status: Sage Mint (#30D158)

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

export const dark = {
  // Named iOS Palette Tokens
  deepObsidian: "#121212",
  charcoalLift: "#1C1C1E",
  slateGray: "#2C2C2E",
  softChalk: "#F2F2F7",
  mutedSilver: "#8E8E93",
  warmGold: "#E5A93B",
  richTruffle: "#D4AF37",
  saffronCoral: "#FF6B4A",
  sageMint: "#30D158",
  primaryAccent: "#E5A93B",
  appetiteAccent: "#FF6B4A",

  // Surfaces
  surface: "#121212", // Deep Obsidian: Main app background
  onSurface: "#F2F2F7", // Soft Chalk: Primary text
  surfaceSecondary: "#1C1C1E", // Charcoal Lift: Cards, bottom sheets, navigation bars, modals
  onSurfaceSecondary: "#F2F2F7",
  surfaceTertiary: "#2C2C2E", // Slate Gray: Secondary containers, inactive toggles, search fields
  onSurfaceTertiary: "#8E8E93", // Muted Silver: Descriptions, captions, metadata
  surfaceInverse: "#F2F2F7",
  onSurfaceInverse: "#121212",
  muted: "#8E8E93",

  // Brand & Accents
  brand: "#FF6B4A", // Appetite Accent: Saffron Coral
  onBrand: "#FFFFFF",
  brandPrimary: "#FF6B4A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E5A93B", // Warm Gold
  onBrandSecondary: "#121212",
  brandTertiary: "#2A231C",
  onBrandTertiary: "#E5A93B",

  // Status
  success: "#30D158", // Sage Mint
  onSuccess: "#121212",
  warning: "#E5A93B", // Warm Gold
  onWarning: "#121212",
  error: "#FF453A", // iOS system red
  onError: "#FFFFFF",
  info: "#64D2FF",
  onInfo: "#121212",

  // Lines & Borders
  border: "#2C2C2E",
  borderStrong: "#3A3A3C",
  borderFocus: "#E5A93B",
  divider: "#232326",
};

export const light: typeof dark = {
  ...dark,
  // Surfaces
  surface: "#FDFBF7",
  onSurface: "#1C1917",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C1917",
  surfaceTertiary: "#F2EFEA",
  onSurfaceTertiary: "#44403C",
  surfaceInverse: "#1C1917",
  onSurfaceInverse: "#FFFFFF",
  muted: "#78716C",

  // Brand
  brand: "#E04F26",
  onBrand: "#FFFFFF",
  brandPrimary: "#E04F26",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F4A261",
  onBrandSecondary: "#1C1917",
  brandTertiary: "#F9E4DE",
  onBrandTertiary: "#9A3415",

  // Status
  success: "#2A9D8F",
  onSuccess: "#FFFFFF",
  warning: "#E9C46A",
  onWarning: "#1C1917",
  error: "#E63946",
  onError: "#FFFFFF",
  info: "#84A59D",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E7E5E4",
  borderStrong: "#D6D3D1",
  borderFocus: "#E04F26",
  divider: "#F5F5F4",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: Record<ColorScheme, ThemeColors> = { dark, light };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 22,
  xl: 32,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

export function setColorScheme(scheme: ColorScheme | null) {
  if (scheme) {
    Appearance.setColorScheme?.(scheme);
  }
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "light" ? "light" : "dark";
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
