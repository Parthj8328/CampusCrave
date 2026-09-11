import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastMsg = { id: number; text: string; kind: ToastKind };

type ToastState = { show: (text: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastState | undefined>(undefined);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string, kind: ToastKind = "info") => {
      setToast({ id: Date.now(), text, kind });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
        setToast(null),
      );
    }, 2600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, opacity]);

  const bg =
    toast?.kind === "success" ? colors.success : toast?.kind === "error" ? colors.error : colors.surfaceInverse;
  const icon =
    toast?.kind === "success" ? "checkmark-circle" : toast?.kind === "error" ? "alert-circle" : "information-circle";

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { bottom: insets.bottom + 90, opacity }]}
          testID="app-toast"
        >
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={20} color={colors.onSurfaceInverse} />
            <Text style={styles.text}>{toast.text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    maxWidth: 480,
    ...StyleSheet.flatten(
      {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      } as any,
    ),
  },
  text: {
    color: colors.onSurfaceInverse,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
}));
