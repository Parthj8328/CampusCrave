import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";

import { homeRouteFor, useAuth } from "@/src/auth/auth-context";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(homeRouteFor(user.role) as any);
    } else {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}
