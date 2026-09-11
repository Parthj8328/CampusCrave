// Design tokens for CampusCrave. Light theme only for now.
//
// The keys match the "color" block of /app/design_guidelines.json. Colors come
// from the design guidelines. Build sheets with makeStyles and read
// useTheme().colors for color props. Never write color literals in components.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
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
  divider: "#F5F5F4",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

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
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
