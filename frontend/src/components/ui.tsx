import { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, Text, View, type ViewStyle } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { haptic } from "@/src/lib/haptics";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Dietary, OrderStatus, SlotStatus } from "@/src/types";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
  testID?: string;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  fullWidth,
  testID,
  style,
}: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pressScale = useRef(new Animated.Value(1)).current;

  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "danger"
        ? colors.error
        : variant === "secondary"
          ? colors.surfaceTertiary
          : "transparent";
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "danger"
        ? colors.onError
        : colors.onSurface;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.965,
      speed: 35,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 25,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: pressScale }] }, fullWidth && { alignSelf: "stretch" }]}>
      <Pressable
        testID={testID}
        onPress={() => {
          haptic("light");
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.btn,
          size === "lg" && styles.btnLg,
          { backgroundColor: bg },
          variant === "ghost" && styles.ghost,
          fullWidth && { alignSelf: "stretch" },
          (disabled || loading) && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={styles.btnInner}>
            {icon ? <Ionicons name={icon as any} size={size === "lg" ? 20 : 18} color={fg} /> : null}
            <Text style={[styles.btnText, size === "lg" && styles.btnTextLg, { color: fg }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function DietDot({ dietary, size = 14 }: { dietary: Dietary; size?: number }) {
  const { colors } = useTheme();
  const border = dietary === "VEG" ? colors.success : colors.error;
  const dot = dietary === "VEG" ? colors.success : colors.error;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        borderWidth: 1.5,
        borderColor: border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: size / 2.2, height: size / 2.2, borderRadius: size, backgroundColor: dot }} />
    </View>
  );
}

export function Badge({
  label,
  tone = "neutral",
  testID,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "error" | "brand" | "info";
  testID?: string;
}) {
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    success: { bg: colors.success, fg: colors.onSuccess },
    warning: { bg: colors.warning, fg: colors.onWarning },
    error: { bg: colors.error, fg: colors.onError },
    brand: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
    info: { bg: colors.info, fg: colors.onInfo },
  } as const;
  const c = map[tone];
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

export const STATUS_META: Record<OrderStatus, { label: string; tone: "neutral" | "warning" | "success" | "info" | "error"; icon: string }> = {
  PLACED: { label: "Placed", tone: "info", icon: "receipt-outline" },
  PREPARING: { label: "Preparing", tone: "warning", icon: "flame-outline" },
  READY_FOR_PICKUP: { label: "Ready", tone: "success", icon: "bag-check-outline" },
  COLLECTED: { label: "Collected", tone: "neutral", icon: "checkmark-done-outline" },
  CANCELLED: { label: "Cancelled", tone: "error", icon: "close-circle-outline" },
};

export function slotTone(status: SlotStatus): "success" | "warning" | "error" {
  return status === "OPEN" ? "success" : status === "FILLING" ? "warning" : "error";
}

const useStyles = makeStyles((colors) => ({
  btn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLg: {
    height: 56,
    borderRadius: radius.lg,
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  btnTextLg: {
    fontSize: 17,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
}));
