import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { apiFetch, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import type { Role, User } from "@/src/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string, role: Role) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (token) {
        try {
          const me = await apiFetch<User>("/auth/me");
          setUser(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function persist(res: { access_token: string; user: User }) {
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
    return res.user;
  }

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    return persist(res);
  };

  const register = async (email: string, password: string, name: string, role: Role) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      auth: false,
      body: { email, password, name, role },
    });
    return persist(res);
  };

  const logout = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function homeRouteFor(role: Role): string {
  if (role === "KITCHEN_STAFF") return "/(kitchen)/queue";
  if (role === "ADMIN") return "/(admin)/dashboard";
  return "/(student)/menu";
}
