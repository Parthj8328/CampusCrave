import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/toast";
import { AuthProvider } from "@/src/auth/auth-context";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: "fade",
                    animationDuration: 220,
                  }}
                >
                  <Stack.Screen name="index" options={{ animation: "fade" }} />
                  <Stack.Screen name="login" options={{ animation: "fade" }} />
                  <Stack.Screen name="(student)" options={{ animation: "fade" }} />
                  <Stack.Screen name="(kitchen)" options={{ animation: "fade" }} />
                  <Stack.Screen name="(admin)" options={{ animation: "fade" }} />
                  <Stack.Screen
                    name="checkout"
                    options={{
                      presentation: "modal",
                      animation: "slide_from_bottom",
                      animationDuration: 280,
                    }}
                  />
                  <Stack.Screen
                    name="order/[id]"
                    options={{
                      presentation: "card",
                      animation: "slide_from_right",
                      animationDuration: 260,
                    }}
                  />
                </Stack>
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
