import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import type { PropsWithChildren } from "react";

import { homeRouteFor, useAuth } from "@/src/auth/auth-context";
import { useTheme } from "@/src/theme";
import type { Role } from "@/src/types";

export function RoleGate({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!allow.includes(user.role)) return <Redirect href={homeRouteFor(user.role) as any} />;
  return <>{children}</>;
}
