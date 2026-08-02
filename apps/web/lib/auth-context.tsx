"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import Cookies from "js-cookie";
import * as api from "@/lib/api";

interface AuthState {
  user: api.User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  updateUser: (newData: Partial<api.User>) => void;
}

const AuthContext = createContext<AuthState>({} as AuthState);

const TOKEN_KEY = "bl_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<api.User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from cookie
  useEffect(() => {
    const saved = Cookies.get(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      api
        .getMe(saved)
        .then(setUser)
        .catch(() => {
          Cookies.remove(TOKEN_KEY);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    Cookies.set(TOKEN_KEY, res.token.access_token, { expires: 30, sameSite: "Lax" });
    setToken(res.token.access_token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await api.register(email, password, displayName);
      Cookies.set(TOKEN_KEY, res.token.access_token, { expires: 30, sameSite: "Lax" });
      setToken(res.token.access_token);
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(() => {
    Cookies.remove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((newData: Partial<api.User>) => {
    setUser((prev) => (prev ? { ...prev, ...newData } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
