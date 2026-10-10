import { Tabs } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { RoleGate } from "@/src/auth/role-gate";
import { FloatingGlassTabBar } from "@/src/components/floating-tab-bar";

export default function KitchenLayout() {
  return (
    <RoleGate allow={["KITCHEN_STAFF"]}>
      <Tabs
        tabBar={(props) => <FloatingGlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="queue"
          options={{
            title: "Queue",
            tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stock"
          options={{
            title: "Stock",
            tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </RoleGate>
  );
}
